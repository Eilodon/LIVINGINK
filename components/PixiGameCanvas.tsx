import React, { useEffect, useRef } from 'react';
import { Application, Graphics, Container, Text, TextStyle, Mesh, Geometry, Shader, Texture } from 'pixi.js';
import { GameState } from '../types';
import { MAP_RADIUS, COLOR_PALETTE } from '../constants';
import { RING_RADII } from '../services/cjr/cjrConstants';
import { ShapeId, Emotion, PigmentVec3 } from '../services/cjr/cjrTypes';
import { getEmotionDuration } from '../services/cjr/emotions';
import { pigmentToHex } from '../services/cjr/colorMath';
import { JELLY_VERTEX } from '../services/cjr/shaders';

// Constants for Grid/Map
const GRID_SIZE = 100;

interface PixiGameCanvasProps {
  gameStateRef: React.MutableRefObject<GameState | null>;
  inputEnabled: boolean;
}

const PixiGameCanvas: React.FC<PixiGameCanvasProps> = ({ gameStateRef, inputEnabled }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<Application | null>(null);

  // Entity Containers
  const entitiesRef = useRef<Map<string, Container>>(new Map());
  const entityMetaRef = useRef<Map<string, {
    body: Graphics;
    face: Graphics | null;
    lastEmotion: Emotion | null;
    lastRadius: number;
    lastColor: string;
  }>>(new Map());

  // Input State
  const inputEnabledRef = useRef(inputEnabled);
  useEffect(() => { inputEnabledRef.current = inputEnabled; }, [inputEnabled]);

  // Init Pixi
  useEffect(() => {
    if (!containerRef.current || appRef.current) return;

    const app = new Application();

    app.init({
      background: COLOR_PALETTE.background,
      resizeTo: window,
      antialias: true,
      resolution: window.devicePixelRatio || 1,
    }).then(() => {
      if (!containerRef.current) return;
      containerRef.current.appendChild(app.canvas);
      appRef.current = app;

      // --- LAYERS ---
      // 1. World (Everything scales/moves here)
      const world = new Container();
      world.label = 'World';
      world.x = app.screen.width / 2;
      world.y = app.screen.height / 2;
      app.stage.addChild(world);

      // 2. Map Layer (Grid + Rings)
      const mapLayer = new Container();
      world.addChild(mapLayer);
      drawStaticMap(mapLayer);

      // 3. Membrane Layer (Animated Rings)
      const membraneLayer = new Container();
      world.addChild(membraneLayer);

      // 4. Entities Layer (Players, Food)
      const entitiesLayer = new Container();
      world.addChild(entitiesLayer);

      // 5. VFX/Particles Layer
      const vfxLayer = new Container();
      world.addChild(vfxLayer);

      // 6. Floating UI Layer (Damage numbers, Emotes)
      const uiLayer = new Container();
      world.addChild(uiLayer);

      // --- EVENTS ---
      app.stage.eventMode = 'static';
      app.stage.hitArea = app.screen;

      app.stage.on('pointermove', (e) => {
        if (!inputEnabledRef.current) return;
        const state = gameStateRef.current;
        if (state && state.player) {
          // Camera is at center of screen, offset by world position
          // Mouse Screen Pos -> World Pos
          // World.position = ScreenCenter - CameraPos
          // MouseWorld = (MouseScreen - ScreenCenter) + CameraPos
          const centerX = app.screen.width / 2;
          const centerY = app.screen.height / 2;
          const dx = e.global.x - centerX;
          const dy = e.global.y - centerY;

          state.player.targetPosition = {
            x: state.camera.x + dx,
            y: state.camera.y + dy
          };
        }
      });

      app.stage.on('pointerdown', () => {
        if (inputEnabledRef.current && gameStateRef.current) {
          gameStateRef.current.inputs.space = true;
        }
      });

      app.stage.on('pointerup', () => {
        if (gameStateRef.current) {
          gameStateRef.current.inputs.space = false;
        }
      });

      // --- TICKER ---
      app.ticker.add((ticker) => {
        const state = gameStateRef.current;
        if (!state || !state.player) return;

        const dt = ticker.deltaTime; // Scalar (1 = 60fps)
        const time = state.gameTime;

        // 1. Camera Follow (Lerp)
        const targetX = -state.camera.x + app.screen.width / 2;
        const targetY = -state.camera.y + app.screen.height / 2;

        // Snap if too far (teleport), else lerp
        const dist = Math.hypot(world.x - targetX, world.y - targetY);
        if (dist > 500) {
          world.x = targetX;
          world.y = targetY;
        } else {
          world.x += (targetX - world.x) * 0.1;
          world.y += (targetY - world.y) * 0.1;
        }

        // 2. Membrane Animation
        updateMembranes(membraneLayer, time);

        // 3. Sync Entities
        syncEntities(entitiesLayer, state, time);

        // 4. VFX (Particles)
        syncParticles(vfxLayer, uiLayer, state, dt);
      });
    });

    return () => {
      appRef.current?.destroy(true, { children: true });
      appRef.current = null;
    };
  }, []);

  // --- PARTICLE SYSTEM ---
  const particlesRef = useRef<Map<string, Container>>(new Map());

  const syncParticles = (vfxContainer: Container, uiContainer: Container, state: GameState, dt: number) => {
    const activeIds = new Set<string>();

    // Process Particles
    state.particles.forEach(p => {
      activeIds.add(p.id);

      let pContainer = particlesRef.current.get(p.id);
      if (!pContainer) {
        pContainer = new Container();
        pContainer.label = `P_${p.id}`;

        // Initial Draw
        const g = new Graphics();
        pContainer.addChild(g);

        // Text Handling
        if ((p as any).isText) {
          const style = new TextStyle({
            fontFamily: 'Sora',
            fontSize: (p as any).fontSize || 20,
            fill: (p as any).textColor || '#ffffff',
            stroke: { width: 4, color: '#000000' },
            fontWeight: 'bold',
            dropShadow: {
              color: '#000000',
              blur: 2,
              distance: 2,
              alpha: 0.5
            },
          });
          const text = new Text({ text: (p as any).textContent || '', style });
          text.anchor.set(0.5);
          pContainer.addChild(text);
          // Hide graphics for text particles usually, or use it for background?
          g.visible = false;
        }

        if ((p as any).isText) {
          uiContainer.addChild(pContainer);
        } else {
          vfxContainer.addChild(pContainer);
        }
        particlesRef.current.set(p.id, pContainer);
      }

      // Update Position
      pContainer.x = p.position.x;
      pContainer.y = p.position.y;
      pContainer.rotation = (p.angle || 0);

      // Visuals Update (Redraw if needed or just scale/fade)
      const g = pContainer.children[0] as Graphics;
      const alpha = Math.min(1, p.life / (p.maxLife * 0.2)); // Fade out last 20%
      pContainer.alpha = (p as any).fadeOut ? Math.min(alpha, 1) : 1;

      const scale = (p as any).scale ?? 1;
      pContainer.scale.set(scale);

      // Dynamic Redraws for specialized particles
      if ((p as any).isRipple) {
        g.clear();
        g.circle(0, 0, (p as any).rippleRadius || 0);
        g.stroke({ width: 4, color: (p as any).rippleColor || '#ffffff', alpha: 0.5 });
      } else if ((p as any).isPulse) {
        g.clear();
        g.circle(0, 0, (p as any).pulseRadius || 0);
        g.fill({ color: (p as any).pulseColor || '#ffffff', alpha: (p as any).glowIntensity || 0.5 });
      } else if ((p as any).isShockwave) {
        g.clear();
        g.circle(0, 0, (p as any).shockwaveRadius || 0);
        g.stroke({ width: 8, color: (p as any).shockwaveColor || '#ffffff', alpha: 0.8 });
      } else if ((p as any).isLightRay) {
        g.clear();
        const len = (p as any).rayLength || 100;
        const width = (p as any).rayWidth || 2;
        g.rect(0, -width / 2, len, width);
        g.fill({ color: p.color || '#fff' });
      } else if (!(p as any).isText) {
        // Standard Particle
        // Only draw once if static shape? For now redraw to be safe or optimize later.
        // If radius changes?
        g.clear();
        g.circle(0, 0, p.radius || 3);
        g.fill(p.color || '#fff');
      }
    });

    // Cleanup
    for (const [id, c] of particlesRef.current) {
      if (!activeIds.has(id)) {
        c.parent.removeChild(c);
        c.destroy({ children: true });
        particlesRef.current.delete(id);
      }
    }

    // Also sync Floating Texts into UI Layer (if separate list)
    // state.floatingTexts is separate list
    syncFloatingTexts(uiContainer, state);
  };

  const textsRef = useRef<Map<string, Text>>(new Map());
  const syncFloatingTexts = (container: Container, state: GameState) => {
    const activeIds = new Set<string>();
    state.floatingTexts.forEach(t => {
      activeIds.add(t.id);
      let textObj = textsRef.current.get(t.id);
      if (!textObj) {
        const style = new TextStyle({
          fontFamily: 'Sora',
          fontSize: t.size,
          fill: t.color,
          stroke: { width: 3, color: '#000000' },
          fontWeight: 'bold',
        });
        textObj = new Text({ text: t.text, style });
        textObj.anchor.set(0.5);
        container.addChild(textObj);
        textsRef.current.set(t.id, textObj);
      }
      textObj.x = t.position.x;
      textObj.y = t.position.y;
      textObj.alpha = Math.min(1, t.life * 2);
      textObj.scale.set(1 + (1 - t.life) * 0.5); // Pop effect
    });

    for (const [id, t] of textsRef.current) {
      if (!activeIds.has(id)) {
        container.removeChild(t);
        t.destroy();
        textsRef.current.delete(id);
      }
    }
  };


  // --- HELPERS ---

  const drawStaticMap = (container: Container) => {
    const g = new Graphics();

    // Background Grid
    g.beginPath();
    g.strokeStyle = { width: 1, color: COLOR_PALETTE.grid, alpha: 0.1 };

    // Simple large grid for performance
    const steps = Math.floor(MAP_RADIUS / GRID_SIZE);
    for (let i = -steps; i <= steps; i++) {
      const p = i * GRID_SIZE;
      g.moveTo(p, -MAP_RADIUS);
      g.lineTo(p, MAP_RADIUS);
      g.moveTo(-MAP_RADIUS, p);
      g.lineTo(MAP_RADIUS, p);
    }
    g.stroke();

    // Map Boundary
    g.beginPath();
    g.circle(0, 0, MAP_RADIUS);
    g.stroke({ width: 8, color: '#ffffff', alpha: 0.2 });

    container.addChild(g);
  };

  const updateMembranes = (container: Container, time: number) => {
    // Lazy Init
    if (container.children.length === 0) {
      const g = new Graphics();
      g.label = 'MembranesGraphics';
      container.addChild(g);
    }

    const g = container.children[0] as Graphics;
    g.clear();

    const pulse = Math.sin(time * 2) * 20;

    // R3 (Death Zone)
    g.circle(0, 0, RING_RADII.R3 + pulse * 0.5);
    g.fill({ color: '#ef4444', alpha: 0.1 });
    g.stroke({ width: 4, color: '#ef4444', alpha: 0.5 });

    // R2 (Mid)
    g.circle(0, 0, RING_RADII.R2 + pulse);
    g.stroke({ width: 2, color: '#3b82f6', alpha: 0.3 });
  };

  const syncEntities = (container: Container, state: GameState, time: number) => {
    const activeIds = new Set<string>();

    // Gather all entities
    const entities = [state.player, ...state.bots, ...state.food];

    entities.forEach(e => {
      if (e.isDead) return;
      activeIds.add(e.id);

      // Get or Create Container
      let eContainer = entitiesRef.current.get(e.id);
      if (!eContainer) {
        eContainer = new Container();
        eContainer.label = e.id;

        const body = new Graphics();
        body.label = 'Body';
        eContainer.addChild(body);

        // Setup Face for non-food
        let face: Graphics | null = null;
        if ('emotion' in e) {
          face = new Graphics();
          face.label = 'Face';
          eContainer.addChild(face);

          // Name Tag
          const text = new Text({ text: (e as any).name, style: { fontSize: 12, fill: 0xffffff, fontFamily: 'Sora' } });
          text.resolution = 2; // Sharp text
          text.anchor.set(0.5, 1.5);
          text.y = -20;
          eContainer.addChild(text);
        }

        container.addChild(eContainer);
        entitiesRef.current.set(e.id, eContainer);
        entityMetaRef.current.set(e.id, {
          body,
          face,
          lastEmotion: null,
          lastRadius: 0,
          lastColor: ''
        });
      }

      // Update Position
      eContainer.x = e.position.x;
      eContainer.y = e.position.y;

      // Visual Jiggle (Jelly Effect Lite)
      if ('emotion' in e) {
        const speed = Math.hypot(e.velocity.x, e.velocity.y);
        const stretch = Math.min(0.2, speed / 500);
        const wobble = Math.sin(time * 10 + e.position.x * 0.01) * 0.05;
        eContainer.scale.set(1 + stretch - wobble, 1 - stretch + wobble);
        eContainer.rotation = Math.atan2(e.velocity.y, e.velocity.x) * 0.1; // Slight tilt
      }

      // Update Graphics if changed
      const meta = entityMetaRef.current.get(e.id)!;
      const color = e.color || '#fff'; // Assuming e.color is updated from pigment elsewhere or we compute it
      // TODO: Use pigmentToHex if color is not pre-computed or if we want exact pigment rendering

      const radius = e.radius;
      const emotion = (e as any).emotion as Emotion;

      if (meta.lastRadius !== radius || meta.lastColor !== color) {
        meta.body.clear();

        if ('kind' in e) {
          // Pickup
          drawPickup(meta.body, e as any, radius, color);
        } else {
          // Player/Bot
          // TODO: Shape support
          meta.body.circle(0, 0, radius);
          meta.body.fill({ color });
          meta.body.stroke({ width: 2, color: '#000000', alpha: 0.2 });
        }

        meta.lastRadius = radius;
        meta.lastColor = color;
      }

      if (meta.face && emotion !== meta.lastEmotion) {
        drawFace(meta.face, emotion, radius);
        meta.lastEmotion = emotion;
      }
    });

    // Cleanup Dead
    for (const [id, c] of entitiesRef.current) {
      if (!activeIds.has(id)) {
        container.removeChild(c);
        c.destroy({ children: true });
        entitiesRef.current.delete(id);
        entityMetaRef.current.delete(id);
      }
    }
  };

  const drawPickup = (g: Graphics, e: any, r: number, c: string) => {
    const kind = e.kind;
    if (kind === 'pigment') {
      g.circle(0, 0, r).fill(c);
    } else if (kind === 'neutral') {
      g.rect(-r / 2, -r / 2, r, r).fill('#9ca3af').stroke({ width: 1, color: '#fff' });
    } else if (kind === 'solvent') {
      g.star(0, 0, 4, r, r / 2).fill('#a5b4fc');
    } else if (kind === 'candy_vein') {
      g.star(0, 0, 5, r * 1.5, r).fill('#fbbf24').stroke({ width: 2, color: '#fff' });
    } else {
      g.circle(0, 0, r).fill('#555');
    }
  };

  const drawFace = (g: Graphics, emotion: Emotion, r: number) => {
    g.clear();
    // Simple Face drawing logic based on emotion
    const eyeOff = r * 0.35;
    const eyeSize = r * 0.15;

    g.fillStyle = 0x000000;

    // Eyes
    if (emotion === 'panic' || emotion === 'ko') {
      // X eyes for KO? or Big O for panic
      g.circle(-eyeOff, -eyeOff / 2, eyeSize * 1.2).fill();
      g.circle(eyeOff, -eyeOff / 2, eyeSize * 1.2).fill();
    } else if (emotion === 'focus') {
      // Narrow eyes
      g.rect(-eyeOff - eyeSize, -eyeOff / 2, eyeSize * 2, eyeSize / 2).fill();
      g.rect(eyeOff - eyeSize, -eyeOff / 2, eyeSize * 2, eyeSize / 2).fill();
    } else {
      g.circle(-eyeOff, -eyeOff / 2, eyeSize).fill();
      g.circle(eyeOff, -eyeOff / 2, eyeSize).fill();
    }

    // Mouth
    g.beginPath();
    if (emotion === 'happy') {
      g.arc(0, 0, r * 0.3, 0.2, Math.PI - 0.2);
      g.stroke({ width: 2, color: 0x000000 });
    } else if (emotion === 'hungry') {
      g.arc(0, r * 0.2, r * 0.1, 0, Math.PI * 2);
      g.fill();
    } else if (emotion === 'yum') {
      g.moveTo(-r * 0.2, r * 0.2);
      g.quadraticCurveTo(0, r * 0.4, r * 0.2, r * 0.2);
      g.stroke({ width: 2, color: 0x000000 });
      // Tongue
      g.fillStyle = 0xffaaaa;
      g.arc(r * 0.1, r * 0.3, r * 0.1, 0, Math.PI);
      g.fill();
    } else {
      // Neutral line
      g.moveTo(-r * 0.2, r * 0.2);
      g.lineTo(r * 0.2, r * 0.2);
      g.stroke({ width: 2, color: 0x000000 });
    }
  };

  return <div ref={containerRef} className="absolute inset-0 overflow-hidden">
    {/* DEBUG INFO OVERLAY */}
    <div className="absolute top-4 left-4 bg-black/80 text-white p-2 rounded text-xs font-mono z-50">
      <div>🎮 Game Debug Info (CJR)</div>
      <div>Player: {gameStateRef.current?.player?.name || 'N/A'}</div>
      <div>Counts: {gameStateRef.current?.bots?.length || 0} bots / {gameStateRef.current?.food?.length || 0} food</div>
      <div>Time: {gameStateRef.current?.gameTime?.toFixed(1) || '0.0'}</div>
      <div className="mt-2 text-yellow-400">PixiJS v8</div>
    </div>
  </div>;
};

export default PixiGameCanvas;
