import React, { useRef, useEffect } from 'react';
import { GameState, Faction, Player, Bot, SizeTier } from '../types';
import { COLOR_PALETTE, WORLD_WIDTH, WORLD_HEIGHT, MAP_RADIUS, EAT_THRESHOLD_RATIO, DANGER_THRESHOLD_RATIO, ELEMENTAL_ADVANTAGE, FACTION_CONFIG, CENTER_RADIUS } from '../constants';

const distSq = (v1: { x: number; y: number }, v2: { x: number; y: number }) => {
  const dx = v1.x - v2.x;
  const dy = v1.y - v2.y;
  return dx * dx + dy * dy;
};

interface GameCanvasProps {
  gameState: GameState;
  onMouseMove: (x: number, y: number) => void;
  onMouseDown: () => void;
  onMouseUp: () => void;
  enablePointerInput?: boolean;
}

const GameCanvas: React.FC<GameCanvasProps> = ({ gameState, onMouseMove, onMouseDown, onMouseUp, enablePointerInput = true }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mapCacheRef = useRef<HTMLCanvasElement | null>(null);
  const sizeRef = useRef({ width: 0, height: 0, dpr: 1 });
  const gradientCacheRef = useRef(new Map<string, CanvasGradient>());

  const hexToRgb = (hex: string) => {
    const clean = hex.replace('#', '');
    const r = parseInt(clean.slice(0, 2), 16);
    const g = parseInt(clean.slice(2, 4), 16);
    const b = parseInt(clean.slice(4, 6), 16);
    return { r, g, b };
  };

  const tint = (value: number, delta: number) => Math.max(0, Math.min(255, value + delta));

  const getBodyGradient = (ctx: CanvasRenderingContext2D, color: string, radius: number) => {
    const bucket = Math.max(8, Math.round(radius / 6) * 6);
    const key = `${color}-${bucket}`;
    const cache = gradientCacheRef.current;
    const cached = cache.get(key);
    if (cached) return cached;

    const { r, g, b } = hexToRgb(color);
    const gradient = ctx.createRadialGradient(-bucket * 0.3, -bucket * 0.3, 0, 0, 0, bucket);
    gradient.addColorStop(0, `rgb(${tint(r, 35)}, ${tint(g, 35)}, ${tint(b, 35)})`);
    gradient.addColorStop(0.55, color);
    gradient.addColorStop(1, `rgb(${tint(r, -25)}, ${tint(g, -25)}, ${tint(b, -25)})`);
    cache.set(key, gradient);
    return gradient;
  };

  useEffect(() => {
    const offscreen = document.createElement('canvas');
    offscreen.width = WORLD_WIDTH;
    offscreen.height = WORLD_HEIGHT;
    const ctx = offscreen.getContext('2d');
    
    if (ctx) {
        prerenderStaticMap(ctx);
        mapCacheRef.current = offscreen;
    }
  }, []); 

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const updateSize = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      sizeRef.current = { width, height, dpr };
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    updateSize();
    window.addEventListener('resize', updateSize);

    let animationFrameId: number;
    let frameCount = 0;

    const render = () => {
      frameCount++;
      const { width, height, dpr } = sizeRef.current;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const { camera, player, food, bots, creeps, boss, powerUps, hazards, landmarks, particles, projectiles, zoneRadius, floatingTexts, kingId, lavaZones, hazardTimers } = gameState;
      const playerZone = getZoneFromPosition(player.position);
      let visionRadius = Infinity;
      const visionFactor = player.visionMultiplier * player.statusEffects.visionBoost;
      if (playerZone === Faction.Wood && player.faction !== Faction.Wood) visionRadius = 380 * visionFactor;
      if (playerZone === Faction.Earth && hazardTimers?.dustStormActive && player.faction !== Faction.Water) {
        visionRadius = 320 * visionFactor;
      }
      const visionRadiusSq = visionRadius === Infinity ? Infinity : visionRadius * visionRadius;
      const inVision = (pos: { x: number; y: number }) => {
        if (visionRadiusSq === Infinity) return true;
        return distSq(pos, player.position) <= visionRadiusSq;
      };

      // Clear
      ctx.fillStyle = COLOR_PALETTE.background;
      ctx.fillRect(0, 0, width, height);

      // A. Draw Cached Map
      if (mapCacheRef.current) {
          ctx.save();
          const camOffsetX = -camera.x + width / 2;
          const camOffsetY = -camera.y + height / 2;
          ctx.translate(camOffsetX, camOffsetY);
          
          ctx.drawImage(mapCacheRef.current, 0, 0);

          drawAbyss(ctx, frameCount);
          
          // Draw Lava Zones (On top of map, below entities)
          if (lavaZones) {
             lavaZones.forEach(zone => {
                 ctx.save();
                 ctx.globalAlpha = 0.5 + Math.sin(frameCount * 0.1) * 0.2;
                 ctx.fillStyle = '#f97316';
                 ctx.beginPath();
                 ctx.arc(zone.position.x, zone.position.y, zone.radius, 0, Math.PI * 2);
                 ctx.fill();
                 
                 ctx.strokeStyle = '#7c2d12';
                 ctx.lineWidth = 3;
                 ctx.beginPath();
                 ctx.arc(zone.position.x, zone.position.y, zone.radius * (0.5 + Math.random()*0.5), 0, Math.PI*2);
                 ctx.stroke();

                 // Bubbles
                 if (frameCount % 10 === 0 && Math.random() > 0.5) {
                    ctx.fillStyle = '#fef08a';
                    ctx.beginPath();
                    ctx.arc(zone.position.x + (Math.random()-0.5)*zone.radius*1.5, zone.position.y + (Math.random()-0.5)*zone.radius*1.5, zone.radius * 0.1, 0, Math.PI*2);
                    ctx.fill();
                 }
                 ctx.restore();
             });
          }

          drawZone(ctx, zoneRadius);

          if (landmarks) {
            landmarks.forEach(landmark => {
              ctx.save();
              ctx.globalAlpha = 0.6;
              ctx.strokeStyle = '#facc15';
              ctx.lineWidth = 3;
              ctx.beginPath();
              ctx.arc(landmark.position.x, landmark.position.y, landmark.radius, 0, Math.PI * 2);
              ctx.stroke();
              ctx.globalAlpha = 0.8;
              ctx.fillStyle = '#e2e8f0';
              ctx.font = 'bold 16px "Cinzel", serif';
              ctx.textAlign = 'center';
              const label = landmark.type === 'fire_furnace' ? 'LÒ LỬA' :
                landmark.type === 'wood_tree' ? 'CÂY MẸ' :
                landmark.type === 'water_statue' ? 'TƯỢNG BĂNG' :
                landmark.type === 'metal_altar' ? 'ĐÀI KIẾM' : 'KIM TỰ THÁP';
              ctx.fillText(label, landmark.position.x, landmark.position.y - landmark.radius - 10);
              ctx.restore();
            });
          }

          if (hazards) {
            hazards.forEach(hazard => {
              if (!hazard.active && hazard.duration <= 0 && (hazard.type === 'lightning' || hazard.type === 'geyser' || hazard.type === 'icicle')) return;
              if (!inVision(hazard.position)) return;
              ctx.save();
              if (hazard.type === 'lightning') {
                ctx.strokeStyle = hazard.active ? 'rgba(239,68,68,0.8)' : 'rgba(250,204,21,0.9)';
                ctx.lineWidth = 3;
                ctx.setLineDash(hazard.active ? [10, 8] : []);
              }
              if (hazard.type === 'geyser') {
                ctx.strokeStyle = 'rgba(249,115,22,0.8)';
                ctx.lineWidth = 3;
              }
              if (hazard.type === 'icicle') {
                ctx.strokeStyle = 'rgba(56,189,248,0.8)';
                ctx.lineWidth = 3;
              }
              if (hazard.type === 'vines') {
                ctx.fillStyle = 'rgba(34,197,94,0.2)';
                ctx.beginPath();
                ctx.arc(hazard.position.x, hazard.position.y, hazard.radius, 0, Math.PI * 2);
                ctx.fill();
              }
              if (hazard.type === 'thin_ice') {
                ctx.fillStyle = 'rgba(125,211,252,0.2)';
                ctx.beginPath();
                ctx.arc(hazard.position.x, hazard.position.y, hazard.radius, 0, Math.PI * 2);
                ctx.fill();
              }
              if (hazard.type === 'wind') {
                ctx.strokeStyle = 'rgba(148,163,184,0.6)';
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.arc(hazard.position.x, hazard.position.y, hazard.radius, 0, Math.PI * 2);
                ctx.stroke();
              }
              if (hazard.type === 'mushroom') {
                ctx.strokeStyle = 'rgba(168,85,247,0.6)';
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.arc(hazard.position.x, hazard.position.y, hazard.radius, 0, Math.PI * 2);
                ctx.stroke();
              }
              if (hazard.type === 'spear') {
                ctx.strokeStyle = 'rgba(148,163,184,0.5)';
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.arc(hazard.position.x, hazard.position.y, hazard.radius, 0, Math.PI * 2);
                ctx.stroke();
              }
              if (hazard.type === 'lightning' || hazard.type === 'geyser' || hazard.type === 'icicle') {
                ctx.beginPath();
                ctx.arc(hazard.position.x, hazard.position.y, hazard.radius, 0, Math.PI * 2);
                ctx.stroke();
              }
              ctx.setLineDash([]);
              ctx.restore();
            });
          }

          ctx.restore();
      }

      // B. Draw Objects
      ctx.save();
      ctx.translate(-camera.x + width / 2, -camera.y + height / 2);

      // 1. Food
      const viewBuffer = 100;
      food.forEach(f => {
         if (f.position.x < camera.x - width/2 - viewBuffer || f.position.x > camera.x + width/2 + viewBuffer ||
             f.position.y < camera.y - height/2 - viewBuffer || f.position.y > camera.y + height/2 + viewBuffer) return;
         if (!inVision(f.position)) return;

         const isRelic = f.kind === 'relic';
         if (isRelic) {
             ctx.save();
             ctx.shadowColor = '#facc15';
             ctx.shadowBlur = 20;
             ctx.fillStyle = '#facc15';
             ctx.beginPath();
             ctx.arc(f.position.x, f.position.y, f.radius, 0, Math.PI * 2);
             ctx.fill();
             ctx.shadowBlur = 0;
             ctx.strokeStyle = '#78350f';
             ctx.lineWidth = 3;
             ctx.beginPath();
             ctx.arc(f.position.x, f.position.y, f.radius * 1.2, 0, Math.PI * 2);
             ctx.stroke();
             ctx.restore();
         } else {
             ctx.fillStyle = f.color;
             ctx.beginPath();
             ctx.arc(f.position.x, f.position.y, f.radius, 0, Math.PI * 2);
             ctx.fill();
             ctx.fillStyle = 'rgba(255,255,255,0.4)';
             ctx.beginPath();
             ctx.arc(f.position.x - f.radius*0.3, f.position.y - f.radius*0.3, f.radius*0.2, 0, Math.PI*2);
             ctx.fill();
         }
      });

      // 1.5 Power-ups
      powerUps.forEach(p => {
         if (p.position.x < camera.x - width/2 - viewBuffer || p.position.x > camera.x + width/2 + viewBuffer ||
             p.position.y < camera.y - height/2 - viewBuffer || p.position.y > camera.y + height/2 + viewBuffer) return;
         if (!inVision(p.position)) return;

         ctx.save();
         ctx.shadowColor = p.color;
         ctx.shadowBlur = 15;
         ctx.fillStyle = p.color;
         ctx.beginPath();
         ctx.arc(p.position.x, p.position.y, p.radius, 0, Math.PI * 2);
         ctx.fill();
         ctx.shadowBlur = 0;
         ctx.restore();
      });

      const renderEntities = [player, ...bots, ...creeps, ...(boss ? [boss] : [])];

      // 2. Trails
      renderEntities.forEach(entity => {
          if (entity.isDead || !entity.trail.length) return;
          if (!inVision(entity.position)) return;
          const config = FACTION_CONFIG[entity.faction];
          ctx.beginPath();
          ctx.strokeStyle = config.color;
          ctx.globalAlpha = 0.2;
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';
          entity.trail.forEach((pos, i) => {
              const radius = entity.radius * (0.2 + (0.5 * (i / entity.trail.length)));
              ctx.lineWidth = radius * 2;
              if (i === 0) ctx.moveTo(pos.x, pos.y);
              else ctx.lineTo(pos.x, pos.y);
          });
          ctx.stroke();
          ctx.globalAlpha = 1.0;
      });

      // 3. Projectiles
      projectiles.forEach(p => {
          ctx.fillStyle = p.color;
          ctx.beginPath();
          ctx.arc(p.position.x, p.position.y, 10, 0, Math.PI*2);
          ctx.fill();
          ctx.fillStyle = p.color;
          ctx.globalAlpha = 0.4;
          ctx.beginPath();
          ctx.arc(p.position.x, p.position.y, 16, 0, Math.PI*2);
          ctx.fill();
          ctx.globalAlpha = 1.0;
      });

      // 4. Entities
      const entities = renderEntities.sort((a, b) => a.radius - b.radius);
      entities.forEach(entity => {
          if (entity.isDead) return;
          if (entity.position.x < camera.x - width/2 - entity.radius*3 || entity.position.x > camera.x + width/2 + entity.radius*3 ||
              entity.position.y < camera.y - height/2 - entity.radius*3 || entity.position.y > camera.y + height/2 + entity.radius*3) return;
          if (!inVision(entity.position)) return;

          drawEntity(
            ctx, 
            entity, 
            entity.id === 'player', 
            player.radius, player.faction, 
            frameCount,
            gameState.gameTime,
            entity.id === kingId
          );
      });

      // 5. Particles
      particles.forEach(p => {
          const lifeRatio = p.maxLife > 0 ? p.life / p.maxLife : p.life;
          if (p.style === 'ring') {
              const progress = 1 - Math.max(0, lifeRatio);
              const ringRadius = p.radius * (1 + progress * 1.6);
              ctx.globalAlpha = Math.max(0, lifeRatio);
              ctx.strokeStyle = p.color;
              ctx.lineWidth = p.lineWidth ?? Math.max(2, p.radius * 0.15);
              ctx.beginPath();
              ctx.arc(p.position.x, p.position.y, ringRadius, 0, Math.PI * 2);
              ctx.stroke();
          } else if (p.style === 'line') {
              const angle = p.angle ?? Math.atan2(p.velocity.y, p.velocity.x);
              const length = p.lineLength ?? p.radius * 4;
              ctx.globalAlpha = Math.max(0, lifeRatio);
              ctx.strokeStyle = p.color;
              ctx.lineWidth = p.lineWidth ?? Math.max(2, p.radius * 0.2);
              ctx.beginPath();
              ctx.moveTo(
                  p.position.x - Math.cos(angle) * length * 0.5,
                  p.position.y - Math.sin(angle) * length * 0.5
              );
              ctx.lineTo(
                  p.position.x + Math.cos(angle) * length * 0.5,
                  p.position.y + Math.sin(angle) * length * 0.5
              );
              ctx.stroke();
          } else {
              ctx.globalAlpha = p.life;
              ctx.fillStyle = p.color;
              ctx.beginPath();
              ctx.arc(p.position.x, p.position.y, p.radius, 0, Math.PI * 2);
              ctx.fill();
          }
      });
      ctx.globalAlpha = 1.0;

      // 6. Floating Texts (Damage Numbers)
      ctx.font = 'bold 20px "Roboto", sans-serif';
      ctx.textAlign = 'center';
      floatingTexts.forEach(t => {
          ctx.globalAlpha = Math.min(1, t.life * 2);
          ctx.fillStyle = t.color;
          ctx.strokeStyle = 'black';
          ctx.lineWidth = 2;
          
          const scale = 1 + (1 - t.life) * 0.5; // Slight grow effect
          ctx.save();
          ctx.translate(t.position.x, t.position.y);
          ctx.scale(scale, scale);
          ctx.strokeText(t.text, 0, 0);
          ctx.fillText(t.text, 0, 0);
          ctx.restore();
      });
      ctx.globalAlpha = 1.0;

      ctx.restore(); 

      if (playerZone === Faction.Earth && hazardTimers?.dustStormActive && player.faction !== Faction.Water) {
          ctx.fillStyle = 'rgba(120, 80, 50, 0.18)';
          ctx.fillRect(0, 0, width, height);
      }
      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener('resize', updateSize);
      cancelAnimationFrame(animationFrameId);
    };
  }, [gameState]);

  // --- MAP GENERATION LOGIC ---

  const prerenderStaticMap = (ctx: CanvasRenderingContext2D) => {
      const cx = WORLD_WIDTH / 2;
      const cy = WORLD_HEIGHT / 2;

      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, MAP_RADIUS, 0, Math.PI * 2);
      ctx.clip(); 

      const SECTOR = (Math.PI * 2) / 5;
      const START_ANGLE = -Math.PI / 2 - (SECTOR / 2); 

      const zones = [
          { id: Faction.Wood, label: 'MỘC', base: '#064e3b', light: '#10b981' }, 
          { id: Faction.Water, label: 'THỦY', base: '#1e3a8a', light: '#93c5fd' }, 
          { id: Faction.Earth, label: 'THỔ', base: '#451a03', light: '#b45309' }, 
          { id: Faction.Metal, label: 'KIM', base: '#1c1917', light: '#a8a29e' }, 
          { id: Faction.Fire, label: 'HỎA', base: '#450a0a', light: '#ef4444' }, 
      ];

      zones.forEach((z, i) => {
          const start = START_ANGLE + i * SECTOR;
          const end = START_ANGLE + (i + 1) * SECTOR;

          ctx.save();
          ctx.beginPath();
          ctx.moveTo(cx, cy);
          ctx.arc(cx, cy, MAP_RADIUS, start, end);
          ctx.closePath();
          ctx.clip(); 

          ctx.fillStyle = z.base;
          ctx.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);

          if (z.id === Faction.Wood) {
               ctx.fillStyle = '#065f46';
               for(let k=0; k<200; k++) {
                   const x = Math.random() * WORLD_WIDTH;
                   const y = Math.random() * WORLD_HEIGHT;
                   ctx.beginPath(); ctx.arc(x, y, 15 + Math.random()*20, 0, Math.PI*2); ctx.fill();
               }
               ctx.strokeStyle = '#10b981';
               ctx.lineWidth = 2;
               ctx.globalAlpha = 0.3;
               for(let k=0; k<50; k++) {
                   ctx.beginPath();
                   ctx.moveTo(Math.random()*WORLD_WIDTH, Math.random()*WORLD_HEIGHT);
                   ctx.bezierCurveTo(Math.random()*WORLD_WIDTH, Math.random()*WORLD_HEIGHT, Math.random()*WORLD_WIDTH, Math.random()*WORLD_HEIGHT, Math.random()*WORLD_WIDTH, Math.random()*WORLD_HEIGHT);
                   ctx.stroke();
               }
          } 
          else if (z.id === Faction.Fire) {
               ctx.strokeStyle = '#dc2626';
               ctx.lineWidth = 3;
               for(let k=0; k<80; k++) {
                   const x = Math.random() * WORLD_WIDTH;
                   const y = Math.random() * WORLD_HEIGHT;
                   ctx.beginPath();
                   ctx.moveTo(x, y);
                   ctx.lineTo(x + Math.random()*60 - 30, y + Math.random()*60 - 30);
                   ctx.stroke();
               }
               ctx.fillStyle = '#7f1d1d';
               for(let k=0; k<50; k++) {
                   ctx.beginPath(); ctx.arc(Math.random()*WORLD_WIDTH, Math.random()*WORLD_HEIGHT, 40, 0, Math.PI*2); ctx.fill();
               }
          } 
          else if (z.id === Faction.Water) {
               ctx.fillStyle = '#3b82f6';
               ctx.globalAlpha = 0.2;
               for(let k=0; k<100; k++) {
                   const x = Math.random() * WORLD_WIDTH;
                   const y = Math.random() * WORLD_HEIGHT;
                   ctx.beginPath(); ctx.moveTo(x,y); ctx.lineTo(x+40, y+10); ctx.lineTo(x+20, y+50); ctx.fill();
               }
               ctx.fillStyle = 'white';
               ctx.globalAlpha = 0.4;
               for(let k=0; k<50; k++) {
                   ctx.beginPath(); ctx.arc(Math.random()*WORLD_WIDTH, Math.random()*WORLD_HEIGHT, 2, 0, Math.PI*2); ctx.fill();
               }
          } 
          else if (z.id === Faction.Metal) {
               ctx.strokeStyle = '#57534e';
               ctx.lineWidth = 4;
               for(let k=0; k<150; k++) {
                   const x = Math.random() * WORLD_WIDTH;
                   const y = Math.random() * WORLD_HEIGHT;
                   ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y-40); ctx.stroke();
                   ctx.fillStyle = '#78716c';
                   ctx.fillRect(x-5, y-30, 10, 4);
               }
          } 
          else if (z.id === Faction.Earth) {
               ctx.fillStyle = '#78350f';
               for(let k=0; k<100; k++) {
                   const x = Math.random() * WORLD_WIDTH;
                   const y = Math.random() * WORLD_HEIGHT;
                   const s = 20 + Math.random() * 30;
                   ctx.fillRect(x, y, s, s);
               }
          }

          ctx.restore(); 

          const midAngle = start + SECTOR / 2;
          const textDist = MAP_RADIUS * 0.8;
          const tx = cx + Math.cos(midAngle) * textDist;
          const ty = cy + Math.sin(midAngle) * textDist;
          ctx.fillStyle = 'rgba(255,255,255,0.2)';
          ctx.font = '900 60px "Cinzel", serif';
          ctx.textAlign = 'center';
          ctx.fillText(z.label, tx, ty);
      });

      ctx.strokeStyle = '#64748b';
      ctx.lineWidth = 20;
      ctx.beginPath();
      ctx.arc(cx, cy, MAP_RADIUS, 0, Math.PI * 2);
      ctx.stroke();

      ctx.restore(); 
  };

  const getZoneFromPosition = (pos: { x: number; y: number }): Faction | 'Center' => {
      const cx = WORLD_WIDTH / 2;
      const cy = WORLD_HEIGHT / 2;
      const dx = pos.x - cx;
      const dy = pos.y - cy;
      const dSq = dx*dx + dy*dy;

      if (dSq < CENTER_RADIUS * CENTER_RADIUS) return 'Center';

      let angle = Math.atan2(dy, dx); 
      if (angle < 0) angle += 2 * Math.PI;

      const sector = (Math.PI * 2) / 5;
      const adjustedAngle = (angle + (Math.PI / 2) + (sector / 2)) % (Math.PI * 2);
      const index = Math.floor(adjustedAngle / sector);
      const zones = [Faction.Wood, Faction.Water, Faction.Earth, Faction.Metal, Faction.Fire];
      return zones[index] || Faction.Fire;
  };

  const drawAbyss = (ctx: CanvasRenderingContext2D, frameCount: number) => {
    const cx = WORLD_WIDTH / 2;
    const cy = WORLD_HEIGHT / 2;
    
    const abyssGradient = ctx.createRadialGradient(cx, cy, 50, cx, cy, CENTER_RADIUS);
    abyssGradient.addColorStop(0, '#000000');
    abyssGradient.addColorStop(0.5, '#4c1d95'); 
    abyssGradient.addColorStop(1, 'rgba(76, 29, 149, 0)');

    ctx.fillStyle = abyssGradient;
    ctx.beginPath();
    ctx.arc(cx, cy, CENTER_RADIUS, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(frameCount * 0.005);
    ctx.strokeStyle = 'rgba(167, 139, 250, 0.3)';
    ctx.lineWidth = 3;
    ctx.setLineDash([20, 15]);
    ctx.beginPath();
    ctx.arc(0, 0, CENTER_RADIUS * 0.8, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
    
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.font = 'bold 24px "Cinzel", serif';
    ctx.textAlign = 'center';
    ctx.fillText("VỰC VẠN CỔ", cx, cy + 10);
  };

  const drawZone = (ctx: CanvasRenderingContext2D, radius: number) => {
      const cx = WORLD_WIDTH / 2;
      const cy = WORLD_HEIGHT / 2;
      
      ctx.fillStyle = COLOR_PALETTE.zone;
      ctx.beginPath();
      ctx.rect(0, 0, WORLD_WIDTH, WORLD_HEIGHT); 
      ctx.arc(cx, cy, radius, 0, Math.PI * 2, true); 
      ctx.fill();

      ctx.strokeStyle = COLOR_PALETTE.zoneBorder;
      ctx.lineWidth = 6;
      ctx.setLineDash([10, 10]);
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
  };

  // --- ENTITY VISUAL EVOLUTION LOGIC ---
  const drawTransformation = (ctx: CanvasRenderingContext2D, entity: Player | Bot, layer: 'under' | 'over', frameCount: number) => {
    const config = FACTION_CONFIG[entity.faction];
    const r = entity.radius;

    switch(entity.faction) {
      case Faction.Metal: // Bạo Vũ Thiết Phong
        if (layer === 'under') {
            const wingFlap = Math.sin(frameCount * 0.2) * 0.2;
            ctx.fillStyle = config.secondary;
            
            // Left Wing
            ctx.save();
            ctx.rotate(-0.2 + wingFlap); // Slight angle + animation
            ctx.beginPath();
            ctx.moveTo(-r * 0.5, 0);
            ctx.quadraticCurveTo(-r * 1.8, -r * 0.8, -r * 2.2, -r * 0.2); // Wing tip
            ctx.quadraticCurveTo(-r * 1.5, r * 0.2, -r * 0.5, 0);
            ctx.fill();
            // Mechanical Details
            ctx.strokeStyle = '#94a3b8';
            ctx.lineWidth = 2;
            ctx.stroke();
            ctx.restore();

            // Right Wing (Mirror)
            ctx.save();
            ctx.scale(1, -1); // Mirror Y
            ctx.rotate(-0.2 + wingFlap);
            ctx.beginPath();
            ctx.moveTo(-r * 0.5, 0);
            ctx.quadraticCurveTo(-r * 1.8, -r * 0.8, -r * 2.2, -r * 0.2);
            ctx.quadraticCurveTo(-r * 1.5, r * 0.2, -r * 0.5, 0);
            ctx.fill();
            ctx.stroke();
            ctx.restore();
        }
        break;
        
      case Faction.Wood: // Thanh Phược Yêu Xà
        if (layer === 'under') {
            // Draw undulating energy tails
            ctx.strokeStyle = config.secondary; // Light green
            ctx.lineWidth = r * 0.15;
            ctx.lineCap = 'round';
            const tailCount = 5;
            
            for(let i=0; i<tailCount; i++) {
                const sway = Math.sin(frameCount * 0.1 + i) * 0.2;
                const spread = (Math.PI / 3) * ((i - (tailCount-1)/2) / tailCount); // Fan out back
                
                ctx.save();
                ctx.rotate(Math.PI + spread + sway); // Face backwards
                
                ctx.beginPath();
                ctx.moveTo(r * 0.5, 0);
                // Bezier curve for organic tail look
                ctx.bezierCurveTo(r * 1.5, r * 0.5, r * 2.5, -r * 0.5, r * 3.5, 0);
                
                // Glow effect
                ctx.shadowColor = config.color;
                ctx.shadowBlur = 10;
                ctx.stroke();
                ctx.shadowBlur = 0;
                ctx.restore();
            }
        }
        break;
        
      case Faction.Fire: // Nham Hỏa Xích Cáp
        if (layer === 'over') {
            // Magma Veins
            ctx.strokeStyle = '#fbbf24'; // Hot yellow/orange
            ctx.lineWidth = r * 0.08;
            ctx.lineCap = 'round';
            const pulse = 0.5 + Math.sin(frameCount * 0.1) * 0.5; // 0 to 1
            ctx.globalAlpha = 0.6 + (pulse * 0.4);

            const veins = 6;
            for(let i=0; i<veins; i++) {
                const angle = (Math.PI * 2 / veins) * i;
                ctx.save();
                ctx.rotate(angle);
                ctx.beginPath();
                ctx.moveTo(r * 0.2, 0);
                ctx.lineTo(r * 0.5, r * 0.1);
                ctx.lineTo(r * 0.7, -r * 0.1);
                ctx.lineTo(r * 0.9, 0);
                ctx.stroke();
                ctx.restore();
            }
            ctx.globalAlpha = 1.0;
        }
        break;
        
      case Faction.Water: // Hàn Băng Cổ Tằm
        if (layer === 'over') {
            // Orbiting Ice Crystals
            ctx.fillStyle = '#bae6fd';
            const crystals = 5;
            const orbitSpeed = frameCount * 0.03;
            
            for(let i=0; i<crystals; i++) {
                const angle = (Math.PI * 2 / crystals) * i + orbitSpeed;
                const dist = r * 1.3;
                
                ctx.save();
                // We are in Local Entity Space.
                // Translate to orbit position
                ctx.translate(Math.cos(angle) * dist, Math.sin(angle) * dist);
                // Rotate crystal to point outward
                ctx.rotate(angle);
                
                ctx.beginPath();
                ctx.moveTo(0, -r * 0.15);
                ctx.lineTo(r * 0.1, 0);
                ctx.lineTo(0, r * 0.15);
                ctx.lineTo(-r * 0.1, 0);
                ctx.closePath();
                ctx.fill();
                
                // Shine
                ctx.fillStyle = 'white';
                ctx.globalAlpha = 0.6;
                ctx.beginPath();
                ctx.arc(0, -r*0.05, r*0.02, 0, Math.PI*2);
                ctx.fill();
                ctx.globalAlpha = 1.0;
                ctx.fillStyle = '#bae6fd'; // Reset
                
                ctx.restore();
            }
        }
        break;
        
      case Faction.Earth: // Kim Cang Độc Hạt
        if (layer === 'over') {
            // Heavy Plated Armor
            ctx.fillStyle = '#fde047';
            ctx.strokeStyle = '#713f12';
            ctx.lineWidth = 2;
            const plates = 6;
            
            for(let i=0; i<plates; i++) {
                const angle = (Math.PI * 2 / plates) * i;
                ctx.save();
                ctx.rotate(angle);
                ctx.translate(r * 0.75, 0); // Move to edge
                
                // Draw Rectangular Plate
                ctx.beginPath();
                ctx.rect(-r*0.15, -r*0.15, r*0.3, r*0.3);
                ctx.fill();
                ctx.stroke();
                
                // Rivet
                ctx.fillStyle = '#451a03';
                ctx.beginPath();
                ctx.arc(0, 0, r*0.03, 0, Math.PI*2);
                ctx.fill();
                ctx.fillStyle = '#fde047'; // Reset
                
                ctx.restore();
            }
        }
        break;
    }
  };

  const drawTierFeatures = (ctx: CanvasRenderingContext2D, entity: Player | Bot, type: 'elder', frameCount: number) => {
      const r = entity.radius;
      if (type === 'elder') {
        // Draw Spikes / Horns
        ctx.fillStyle = FACTION_CONFIG[entity.faction].stroke;
        const spikeCount = 3;
        
        for(let i=0; i<spikeCount; i++) { 
            // -1 to 1 spread
            const spikeAngle = -0.8 + (i * 0.8); 
            ctx.save();
            ctx.rotate(spikeAngle);
            
            ctx.beginPath();
            ctx.moveTo(r * 0.7, -r * 0.15);
            ctx.lineTo(r * 1.25, 0); // Stick out further
            ctx.lineTo(r * 0.7, r * 0.15);
            ctx.fill();
            
            // Highlight on spike
            ctx.strokeStyle = 'rgba(255,255,255,0.3)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(r * 0.7, 0);
            ctx.lineTo(r * 1.2, 0);
            ctx.stroke();
            
            ctx.restore();
        }
      }
  };

  const drawFactionUnderlay = (ctx: CanvasRenderingContext2D, entity: Player | Bot, r: number) => {
      const config = FACTION_CONFIG[entity.faction as Faction];
      if (entity.faction === Faction.Metal) {
          ctx.save();
          ctx.globalAlpha = 0.45;
          ctx.fillStyle = '#e2e8f0';
          ctx.beginPath();
          ctx.ellipse(-r * 0.1, -r * 0.8, r * 0.7, r * 0.25, -0.2, 0, Math.PI * 2);
          ctx.ellipse(-r * 0.1, r * 0.8, r * 0.7, r * 0.25, 0.2, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = config.secondary;
          ctx.lineWidth = Math.max(1, r * 0.05);
          ctx.stroke();
          ctx.restore();
      }
  };

  const drawFactionOverlay = (ctx: CanvasRenderingContext2D, entity: Player | Bot, r: number) => {
      const config = FACTION_CONFIG[entity.faction as Faction];
      if (entity.faction === Faction.Fire) {
          // Frog mouth + warts
          ctx.strokeStyle = config.stroke;
          ctx.lineWidth = Math.max(2, r * 0.1);
          ctx.beginPath();
          ctx.arc(r * 0.35, 0, r * 0.45, -0.2 * Math.PI, 0.2 * Math.PI);
          ctx.stroke();

          ctx.fillStyle = config.secondary;
          const warts = [
              { x: -0.35, y: -0.25 },
              { x: -0.1, y: 0.15 },
              { x: 0.1, y: -0.35 },
              { x: 0.35, y: 0.25 },
          ];
          warts.forEach((spot) => {
              ctx.beginPath();
              ctx.arc(r * spot.x, r * spot.y, r * 0.08, 0, Math.PI * 2);
              ctx.fill();
          });
      } else if (entity.faction === Faction.Metal) {
          // Bee stinger + stripes + antennae
          ctx.fillStyle = config.stroke;
          ctx.beginPath();
          ctx.moveTo(-r * 1.05, 0);
          ctx.lineTo(-r * 0.75, -r * 0.2);
          ctx.lineTo(-r * 0.75, r * 0.2);
          ctx.closePath();
          ctx.fill();

          ctx.strokeStyle = config.secondary;
          ctx.lineWidth = Math.max(2, r * 0.08);
          for (let i = -0.35; i <= 0.35; i += 0.35) {
              ctx.beginPath();
              ctx.ellipse(0, r * i, r * 0.9, r * 0.22, 0, 0, Math.PI * 2);
              ctx.stroke();
          }

          ctx.strokeStyle = config.stroke;
          ctx.lineWidth = Math.max(2, r * 0.08);
          ctx.beginPath();
          ctx.moveTo(r * 0.6, -r * 0.3);
          ctx.lineTo(r * 0.9, -r * 0.6);
          ctx.moveTo(r * 0.6, r * 0.3);
          ctx.lineTo(r * 0.9, r * 0.6);
          ctx.stroke();
      } else if (entity.faction === Faction.Wood) {
          // Snake tongue + tail fin + scale line
          ctx.strokeStyle = config.secondary;
          ctx.lineWidth = Math.max(2, r * 0.07);
          ctx.beginPath();
          ctx.moveTo(r * 0.9, 0);
          ctx.lineTo(r * 1.2, -r * 0.12);
          ctx.moveTo(r * 0.9, 0);
          ctx.lineTo(r * 1.2, r * 0.12);
          ctx.stroke();

          ctx.fillStyle = config.stroke;
          ctx.beginPath();
          ctx.moveTo(-r * 1.05, 0);
          ctx.lineTo(-r * 0.65, -r * 0.25);
          ctx.lineTo(-r * 0.65, r * 0.25);
          ctx.closePath();
          ctx.fill();

          ctx.strokeStyle = config.secondary;
          ctx.lineWidth = Math.max(1, r * 0.05);
          ctx.beginPath();
          ctx.arc(0, 0, r * 0.75, -0.6, 0.6);
          ctx.stroke();
      } else if (entity.faction === Faction.Water) {
          // Silkworm segments + silk tuft
          ctx.strokeStyle = config.secondary;
          ctx.lineWidth = Math.max(2, r * 0.08);
          for (let i = -0.4; i <= 0.4; i += 0.4) {
              ctx.beginPath();
              ctx.ellipse(0, r * i, r * 0.85, r * 0.25, 0, 0, Math.PI * 2);
              ctx.stroke();
          }
          ctx.strokeStyle = '#e0f2fe';
          ctx.lineWidth = Math.max(1, r * 0.05);
          ctx.beginPath();
          ctx.moveTo(-r * 0.9, -r * 0.2);
          ctx.lineTo(-r * 1.15, -r * 0.45);
          ctx.moveTo(-r * 0.9, r * 0.2);
          ctx.lineTo(-r * 1.15, r * 0.45);
          ctx.stroke();
      } else if (entity.faction === Faction.Earth) {
          // Scorpion claws + tail + stinger
          ctx.fillStyle = config.stroke;
          ctx.beginPath();
          ctx.arc(r * 0.75, -r * 0.45, r * 0.22, 0, Math.PI * 2);
          ctx.arc(r * 0.75, r * 0.45, r * 0.22, 0, Math.PI * 2);
          ctx.fill();

          ctx.strokeStyle = config.stroke;
          ctx.lineWidth = Math.max(2, r * 0.1);
          ctx.beginPath();
          ctx.moveTo(-r * 0.6, 0);
          ctx.quadraticCurveTo(-r * 1.2, -r * 0.8, -r * 0.2, -r * 1.25);
          ctx.stroke();

          ctx.fillStyle = config.stroke;
          ctx.beginPath();
          ctx.moveTo(-r * 0.2, -r * 1.25);
          ctx.lineTo(-r * 0.05, -r * 1.05);
          ctx.lineTo(-r * 0.35, -r * 1.05);
          ctx.closePath();
          ctx.fill();
      }
  };

  const drawEntity = (
      ctx: CanvasRenderingContext2D, 
      entity: Player | Bot, 
      isPlayer: boolean, 
      playerR: number, playerFaction: Faction,
      frameCount: number,
      gameTime: number,
      isKing: boolean
  ) => {
      const config = FACTION_CONFIG[entity.faction as Faction];
      const r = entity.radius;
      const x = entity.position.x;
      const y = entity.position.y;
      const stealthAlpha = entity.statusEffects.stealthed && !isPlayer ? 0.2 : 1;
      const spawnDuration = 0.7;
      const timeSinceSpawn = Math.max(0, gameTime - entity.spawnTime);
      const spawnProgress = Math.min(1, timeSinceSpawn / spawnDuration);
      const spawnAlpha = spawnProgress;
      const spawnScale = 0.6 + spawnProgress * 0.4;

      // --- 1. DETERMINE VISUAL TIER ---
      let visualMultiplier = 1.0;
      let glowColor = '';
      let glowBlur = 0;
      
      switch(entity.tier) {
        case SizeTier.Larva:       // 0-20%
          visualMultiplier = 1.0;
          break;
        case SizeTier.Juvenile:    // 20-40%
          visualMultiplier = 1.1;
          glowColor = 'rgba(255,255,255,0.15)';
          glowBlur = 10;
          break;
        case SizeTier.Adult:       // 40-60%
          visualMultiplier = 1.15;
          glowColor = 'rgba(100,200,255,0.25)';
          glowBlur = 15;
          break;
        case SizeTier.Elder:       // 60-80%
          visualMultiplier = 1.2;
          glowColor = 'rgba(200,100,255,0.35)';
          glowBlur = 20;
          break;
        case SizeTier.AncientKing: // 80-100%
          visualMultiplier = 1.3;
          glowColor = 'rgba(255,215,0,0.6)'; // Strong Gold aura
          glowBlur = 30;
          break;
      }

      // Poison indicator (Green Bubble)
      if (entity.statusEffects.poisoned) {
          ctx.save();
          ctx.globalAlpha = 0.4;
          ctx.fillStyle = '#84cc16';
          ctx.beginPath();
          ctx.arc(x, y, r * 1.5, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
      }

      // --- 2. DRAW GLOW (World Space) ---
      if (glowColor) {
        ctx.shadowBlur = glowBlur;
        ctx.shadowColor = glowColor;
        ctx.fillStyle = glowColor;
        ctx.globalAlpha = stealthAlpha * spawnAlpha;
        ctx.beginPath();
        ctx.arc(x, y, r * visualMultiplier * 1.1, 0, Math.PI*2);
        ctx.fill();
        ctx.shadowBlur = 0; // Reset
        ctx.globalAlpha = 1.0;
      }

      if (entity.statusEffects.kingForm > 0) {
        ctx.save();
        ctx.strokeStyle = '#f59e0b';
        ctx.lineWidth = 4;
        ctx.globalAlpha = 0.6;
        ctx.beginPath();
        ctx.arc(x, y, r * 1.4, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }

      // --- SETUP LOCAL COORDINATE SYSTEM ---
      // Move to entity center and rotate to face velocity
      const angle = Math.atan2(entity.velocity.y, entity.velocity.x);
      ctx.save();
      ctx.translate(x, y);
      ctx.globalAlpha = stealthAlpha * spawnAlpha;
      ctx.scale(spawnScale, spawnScale);
      
      // FIRE JUMP VISUAL (Scaling)
      if (entity.statusEffects.airborne) {
         const scale = 1.5 + Math.sin(frameCount * 0.2) * 0.2;
         ctx.scale(scale, scale);
         ctx.shadowColor = 'black';
         ctx.shadowBlur = 30; // High elevation shadow
      }

      ctx.rotate(angle);
      
      // Optional: Squash and Stretch based on speed
      const speed = Math.sqrt(entity.velocity.x**2 + entity.velocity.y**2);
      const stretch = Math.min(1.15, 1 + speed * 0.005);
      const squash = 1 / stretch;
      ctx.scale(stretch, squash);

      // --- 3. TRANSFORMATION UNDERLAY (Wings/Tails) ---
      if (entity.tier === SizeTier.AncientKing) {
          drawTransformation(ctx, entity, 'under', frameCount);
      }
      drawFactionUnderlay(ctx, entity, r);

      // --- 4. BODY RENDERING (Local Space 0,0) ---
      
      if (entity.statusEffects.damageFlash > 0) {
        ctx.save();
        ctx.globalAlpha = Math.min(1, entity.statusEffects.damageFlash * 0.7);
        ctx.fillStyle = '#ef4444';
        ctx.beginPath();
        ctx.ellipse(0, 0, r * 1.1, r * 0.95, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      // Main Body
      ctx.fillStyle = getBodyGradient(ctx, config.color, r);
      ctx.beginPath();
      ctx.ellipse(0, 0, r, r*0.9, 0, 0, Math.PI*2);
      ctx.fill();
      
      drawFactionOverlay(ctx, entity, r);

      // Eyes
      const eyeX = r * 0.35;
      const eyeY = r * 0.3;
      const eyeSize = r * 0.28;

      ctx.fillStyle = 'white';
      ctx.beginPath();
      ctx.ellipse(eyeX, -eyeY, eyeSize, eyeSize*1.1, 0, 0, Math.PI*2); 
      ctx.ellipse(eyeX, eyeY, eyeSize, eyeSize*1.1, 0, 0, Math.PI*2);  
      ctx.fill();

      // Pupils
      ctx.fillStyle = config.stroke;
      ctx.beginPath();
      ctx.arc(eyeX + 2, -eyeY, eyeSize*0.6, 0, Math.PI*2);
      ctx.arc(eyeX + 2, eyeY, eyeSize*0.6, 0, Math.PI*2);
      ctx.fill();

      ctx.fillStyle = 'black';
      ctx.beginPath();
      ctx.arc(eyeX + 2, -eyeY, eyeSize*0.3, 0, Math.PI*2);
      ctx.arc(eyeX + 2, eyeY, eyeSize*0.3, 0, Math.PI*2);
      ctx.fill();
      
      // Eye Shine
      ctx.fillStyle = 'white'; 
      ctx.beginPath();
      ctx.arc(eyeX + eyeSize*0.4, -eyeY - eyeSize*0.3, eyeSize*0.2, 0, Math.PI*2);
      ctx.arc(eyeX + eyeSize*0.4, eyeY - eyeSize*0.3, eyeSize*0.2, 0, Math.PI*2);
      ctx.fill();

      // --- 5. TRANSFORMATION OVERLAY (Armor/Cracks/Crystals) ---
      if (entity.tier === SizeTier.AncientKing) {
          drawTransformation(ctx, entity, 'over', frameCount);
      } else if (entity.tier === SizeTier.Elder) {
          // Elder Spikes
          drawTierFeatures(ctx, entity, 'elder', frameCount);
      }

      // Shield Effect (Overlay)
      if (entity.statusEffects?.shielded) {
          ctx.strokeStyle = '#eab308';
          ctx.lineWidth = 5;
          ctx.globalAlpha = 0.6 + Math.sin(frameCount * 0.2) * 0.2;
          ctx.beginPath();
          ctx.arc(0, 0, r + 5, 0, Math.PI*2);
          ctx.stroke();
          ctx.globalAlpha = 1.0;
      }

      // Restore coordinate system for Text/UI elements
      ctx.restore(); 
      ctx.globalAlpha = 1.0;

      // --- 6. INDICATOR RING (World Space) ---
      if (!isPlayer && !entity.isDead) {
          const ratio = entity.radius / playerR;
          let ringColor = '';
          if (ratio >= DANGER_THRESHOLD_RATIO) ringColor = COLOR_PALETTE.indicatorDanger;
          else if (ratio <= EAT_THRESHOLD_RATIO) ringColor = COLOR_PALETTE.indicatorSafe;
          else {
              if (ELEMENTAL_ADVANTAGE[playerFaction] === entity.faction) ringColor = COLOR_PALETTE.indicatorCounter;
              else if (ELEMENTAL_ADVANTAGE[entity.faction] === playerFaction) ringColor = COLOR_PALETTE.indicatorCountered;
              else ringColor = COLOR_PALETTE.indicatorCombat;
          }

          if (ringColor) {
              ctx.strokeStyle = ringColor;
              ctx.lineWidth = 4;
              ctx.beginPath();
              ctx.arc(x, y, r + 8, 0, Math.PI*2);
              ctx.stroke();
          }
      }

      // --- 7. KING CROWN (Top UI) ---
      if (isKing) {
          ctx.save();
          ctx.translate(x, y - r - 25);
          ctx.fillStyle = '#f59e0b'; // Gold
          ctx.strokeStyle = '#78350f';
          ctx.lineWidth = 2;
          ctx.beginPath();
          // Crown shape
          ctx.moveTo(-15, 0);
          ctx.lineTo(-15, -15);
          ctx.lineTo(-5, -5);
          ctx.lineTo(0, -20);
          ctx.lineTo(5, -5);
          ctx.lineTo(15, -15);
          ctx.lineTo(15, 0);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
          ctx.restore();
      }

      // --- 8. NAME TAG ---
      if (entity.radius > 20) {
        ctx.save();
        ctx.globalAlpha = spawnAlpha * stealthAlpha;
        ctx.fillStyle = '#fff';
        ctx.shadowColor = 'black';
        ctx.shadowBlur = 4;
        ctx.font = `bold ${Math.max(12, entity.radius * 0.35)}px "Roboto", sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillText(entity.name || 'Bot', x, y - entity.radius - 8);
        ctx.shadowBlur = 0;
        ctx.restore();
      }
  };

  const handleInput = (e: React.MouseEvent) => {
    if (!enablePointerInput) return;
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    onMouseMove(e.clientX - rect.left, e.clientY - rect.top);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!enablePointerInput) return;
    const touch = e.touches[0];
    if (!touch) return;
    onMouseMove(touch.clientX, touch.clientY);
  };

  const handleTouchStart = () => {
    if (!enablePointerInput) return;
    onMouseDown();
  };

  const handleTouchEnd = () => {
    if (!enablePointerInput) return;
    onMouseUp();
  };

  return (
    <canvas 
      ref={canvasRef}
      className="block cursor-crosshair"
      onMouseMove={handleInput}
      onMouseDown={onMouseDown}
      onMouseUp={onMouseUp}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onTouchMove={handleTouchMove}
    />
  );
};

export default GameCanvas;
