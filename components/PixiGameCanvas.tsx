import React, { useEffect, useRef } from 'react';
import { Application, Graphics, Container, Text, TextStyle } from 'pixi.js';
import { GameState, Player, Bot, Entity, Food } from '../types';
import { MAP_RADIUS, COLOR_PALETTE, RING_RADII } from '../constants';
import { ShapeId, Emotion } from '../services/cjr/cjrTypes';

interface PixiGameCanvasProps {
  gameStateRef: React.MutableRefObject<GameState | null>;
  inputEnabled: boolean;
}

const PixiGameCanvas: React.FC<PixiGameCanvasProps> = ({ gameStateRef, inputEnabled }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<Application | null>(null);
  const entitiesRef = useRef<Map<string, Container>>(new Map());
  const inputEnabledRef = useRef(inputEnabled);
  const entitiesLayerRef = useRef<Container | null>(null);
  const particlesGraphicsRef = useRef<Graphics | null>(null);
  const floatingTextLayerRef = useRef<Container | null>(null);
  const floatingTextMapRef = useRef<Map<string, Text>>(new Map());
  const iconTextMapRef = useRef<Map<string, Text>>(new Map());
  useEffect(() => {
    inputEnabledRef.current = inputEnabled;
  }, [inputEnabled]);

  const membranesRef = useRef<{
    layer: Container;
    r2: Graphics;
    r3Stroke: Graphics;
    r3Fill: Graphics;
    center: Graphics;
  } | null>(null);

  // PERFORMANCE FIX: Metadata map for entity rendering state
  const entityMetaRef = useRef<Map<string, {
    body: Graphics;
    face: Graphics | null;
    lastEmotion: any;
    lastRadius: number;
  }>>(new Map());

  // Init Pixi
  useEffect(() => {
    if (!containerRef.current || appRef.current) return;

    const app = new Application();

    // Init async
    app.init({
      background: COLOR_PALETTE.background,
      resizeTo: window,
      antialias: true,
      resolution: window.devicePixelRatio || 1,
    }).then(() => {
      containerRef.current?.appendChild(app.canvas);
      appRef.current = app;

      // Setup World Container
      const world = new Container();
      world.label = 'World';
      world.x = app.screen.width / 2;
      world.y = app.screen.height / 2;
      app.stage.addChild(world);

      // Input Handling (Mouse/Pointer)
      app.stage.eventMode = 'static';
      app.stage.hitArea = app.screen;
      app.stage.on('pointermove', (e) => {
        if (!inputEnabledRef.current) return;
        const state = gameStateRef.current;
        if (state && state.player) {
          // Convert screen to world space
          // Camera is at center of screen (screen.width/2, height/2)
          // Player is at camera.x, camera.y
          // Mouse relative to center: e.global.x - width/2
          const screenCenterX = app.screen.width / 2;
          const screenCenterY = app.screen.height / 2;
          const dx = e.global.x - screenCenterX;
          const dy = e.global.y - screenCenterY;

          state.player.targetPosition = {
            x: state.player.position.x + dx,
            y: state.player.position.y + dy
          };
        }
      });
      // Click implies skill trigger or generic action
      app.stage.on('pointerdown', () => {
        if (!inputEnabledRef.current) return;
        const state = gameStateRef.current;
        if (state) state.inputs.space = true;
      });
      app.stage.on('pointerup', () => {
        const state = gameStateRef.current;
        if (state) state.inputs.space = false;
      });

      // Setup Map Graphics
      const map = new Graphics();
      map.label = 'Map';
      world.addChild(map);

      // Draw Map Static
      drawMap(map);

      // Entities + VFX layers
      const entitiesLayer = new Container();
      entitiesLayer.label = 'Entities';
      world.addChild(entitiesLayer);
      entitiesLayerRef.current = entitiesLayer;

      const particlesGraphics = new Graphics();
      particlesGraphics.label = 'Particles';
      world.addChild(particlesGraphics);
      particlesGraphicsRef.current = particlesGraphics;

      const floatingTextLayer = new Container();
      floatingTextLayer.label = 'FloatingText';
      world.addChild(floatingTextLayer);
      floatingTextLayerRef.current = floatingTextLayer;

      // Render Loop
      app.ticker.add(() => {
        const currentGameState = gameStateRef.current;
        if (!currentGameState || !currentGameState.player) return;

        // Camera Follow (Smooth Lerp?)
        const targetX = app.screen.width / 2 - currentGameState.camera.x;
        const targetY = app.screen.height / 2 - currentGameState.camera.y;

        // Simple lerp for smoothness
        world.x += (targetX - world.x) * 0.1;
        world.y += (targetY - world.y) * 0.1;

        // VFX POLISH: Update membrane pulse
        updateMembranes(world, currentGameState.gameTime);

        // VFX: Draw particles + floating texts
        if (particlesGraphicsRef.current) {
          drawParticles(particlesGraphicsRef.current, currentGameState);
        }
        if (floatingTextLayerRef.current) {
          syncFloatingTexts(floatingTextLayerRef.current, currentGameState);
          syncIconParticles(floatingTextLayerRef.current, currentGameState);
        }

        // Sync Entities
        const entityLayer = entitiesLayerRef.current || world;
        syncEntities(entityLayer, currentGameState);
      });
    });

    return () => {
      appRef.current?.destroy(true, { children: true });
      appRef.current = null;
    };
  }, []);

  const drawMap = (g: Graphics) => {
    g.clear();
    // Background Grid
    g.rect(-MAP_RADIUS, -MAP_RADIUS, MAP_RADIUS * 2, MAP_RADIUS * 2).stroke({ width: 4, color: COLOR_PALETTE.grid, alpha: 0.1 });

    // Outer Boundary (Dead Zone)
    g.circle(0, 0, MAP_RADIUS).stroke({ width: 8, color: '#ffffff', alpha: 0.2 });

    // NOTE: Ring membranes will be animated separately in render loop
  };

  // VFX POLISH: Membrane living pulse animation
  const updateMembranes = (world: Container, gameTime: number) => {
    if (!membranesRef.current) {
      const layer = new Container();
      layer.label = 'Membranes';
      world.addChildAt(layer, 0);

      const r2 = new Graphics();
      r2.circle(0, 0, RING_RADII.R2_BOUNDARY).stroke({ width: 6, color: '#3b82f6', alpha: 1 });

      const r3Stroke = new Graphics();
      r3Stroke.circle(0, 0, RING_RADII.R3_BOUNDARY).stroke({ width: 8, color: '#ef4444', alpha: 1 });

      const r3Fill = new Graphics();
      r3Fill.circle(0, 0, RING_RADII.R3_BOUNDARY).fill({ color: '#ef4444', alpha: 1 });

      const center = new Graphics();
      center.circle(0, 0, RING_RADII.CENTER).fill({ color: '#ffd700', alpha: 1 });

      layer.addChild(r2, r3Fill, r3Stroke, center);
      membranesRef.current = { layer, r2, r3Stroke, r3Fill, center };
    }

    const { r2, r3Stroke, r3Fill, center } = membranesRef.current;

    const pulseSpeed = 2.0;
    const pulsePhase = gameTime * pulseSpeed * Math.PI * 2;
    const pulseAlpha = 0.3 + Math.sin(pulsePhase) * 0.2;

    r2.alpha = pulseAlpha;
    r3Stroke.alpha = pulseAlpha * 1.3;
    r3Fill.alpha = 0.05;
    center.alpha = pulseAlpha * 0.3;
  };

  const syncEntities = (world: Container, state: GameState) => {
    const currentIds = new Set<string>();
    const allEntities = [
      state.player,
      ...state.bots,
      ...state.food,
      ...state.projectiles
    ];

    allEntities.forEach((e: any) => {
      if (e.isDead) return;
      currentIds.add(e.id);

      let container = entitiesRef.current.get(e.id);
      if (!container) {
        container = new Container();

        // Body Graphics
        const body = new Graphics();
        body.label = 'Body';
        container.addChild(body);

        // Emotion/Face Graphics (only for players/bots)
        if (e.shape || e.targetPigment) {
          const face = new Graphics();
          face.label = 'Face';
          container.addChild(face);
        }

        // Name Label
        if (e.name) {
          const label = new Text({
            text: e.name,
            style: {
              fontFamily: 'Sora',
              fontSize: 12,
              fill: 0xffffff,
              align: 'center',
            }
          });
          label.anchor.set(0.5, 1.5); // Position above
          label.y = -e.radius;
          container.addChild(label);
        }

        // PERFORMANCE FIX: Store direct references in metadata map (O(1) access)
        // Instead of using find() every frame (O(N) per entity)
        entityMetaRef.current.set(e.id, {
          body,
          face: container.children.find(c => c.label === 'Face') as Graphics || null,
          lastEmotion: null,
          lastRadius: 0,
        });

        world.addChild(container);
        entitiesRef.current.set(e.id, container);
      }

      // Update Position
      container.x = e.position.x;
      container.y = e.position.y;
      container.rotation = e.rotation || 0;

      if (!e.kind) {
        const speed = Math.hypot(e.velocity?.x || 0, e.velocity?.y || 0);
        const stretch = Math.min(0.15, speed / 400);
        const wobble = Math.sin(state.gameTime * 6 + e.position.x * 0.01) * 0.03;
        container.scale.set(1 + stretch + wobble, 1 - stretch + wobble);
      } else {
        container.scale.set(1, 1);
      }

      // PERFORMANCE FIX: Direct access from metadata map instead of find()
      const meta = entityMetaRef.current.get(e.id);
      if (!meta) return;

      const body = meta.body;
      const face = meta.face;

      // Only update visuals if needed
      if (body) {
        // Always update body (color/size can change)
        updateBodyVisuals(body, e);
      }

      if (face) {
        // Only update face if emotion or size changed
        const emotionChanged = e.emotion !== meta.lastEmotion;
        const sizeChanged = Math.abs(e.radius - meta.lastRadius) > 5;

        if (emotionChanged || sizeChanged) {
          updateFaceVisuals(face, e);
          meta.lastEmotion = e.emotion;
          meta.lastRadius = e.radius;
        }
      }
    });

    // Cleanup
    for (const [id, container] of entitiesRef.current) {
      if (!currentIds.has(id)) {
        world.removeChild(container);
        container.destroy({ children: true });
        entitiesRef.current.delete(id);
        entityMetaRef.current.delete(id);
      }
    }
  };

  const updateBodyVisuals = (g: Graphics, e: any) => {
    g.clear();
    const color = e.color || '#ffffff';
    const r = e.radius || 10;

    // Check if food
    if (e.kind) { // Food
      if (e.kind === 'pigment') {
        g.circle(0, 0, r).fill({ color });
      } else if (e.kind === 'neutral') {
        g.circle(0, 0, r * 0.9).fill({ color: '#9ca3af' });
      } else if (e.kind === 'solvent') {
        g.rect(-r * 0.7, -r * 0.7, r * 1.4, r * 1.4).fill({ color: '#a5b4fc' });
      } else if (e.kind === 'catalyst') {
        g.poly(getPolygonPoints(6, r)).fill({ color: '#d946ef' });
      } else if (e.kind === 'shield') {
        g.poly(getPolygonPoints(3, r)).fill({ color: '#fbbf24' }); // Triangle
      } else {
        g.circle(0, 0, r * 0.8).fill({ color: '#888' }); // Dot
      }
      return;
    }

    // Player/Bot Shape
    const shape = e.shape as ShapeId || ShapeId.Circle;

    switch (shape) {
      case ShapeId.Square:
        g.rect(-r, -r, r * 2, r * 2).fill({ color });
        break;
      case ShapeId.Triangle:
        g.poly(getPolygonPoints(3, r)).fill({ color });
        break;
      case ShapeId.Hex:
        g.poly(getPolygonPoints(6, r)).fill({ color });
        break;
      case ShapeId.Circle:
      default:
        g.circle(0, 0, r).fill({ color });
        break;
    }

    // Stroke for contrast
    g.stroke({ width: 2, color: '#000000', alpha: 0.3 });
  };

  const updateFaceVisuals = (g: Graphics, e: any) => {
    g.clear();
    // Only draw face if radius is big enough
    if (e.radius < 15) return;

    const emotion = e.emotion as Emotion || Emotion.Neutral;
    const eyeOffset = e.radius * 0.4;
    const eyeSize = e.radius * 0.15;
    const mouthY = e.radius * 0.3;

    // Eyes
    g.circle(-eyeOffset, -eyeOffset * 0.5, eyeSize).fill({ color: '#000' });
    g.circle(eyeOffset, -eyeOffset * 0.5, eyeSize).fill({ color: '#000' });

    // Highlights
    g.circle(-eyeOffset - eyeSize * 0.3, -eyeOffset * 0.5 - eyeSize * 0.3, eyeSize * 0.4).fill({ color: '#fff' });
    g.circle(eyeOffset - eyeSize * 0.3, -eyeOffset * 0.5 - eyeSize * 0.3, eyeSize * 0.4).fill({ color: '#fff' });

    // Mouth based on Emotion
    g.moveTo(-eyeOffset, mouthY);

    switch (emotion) {
      case Emotion.Happy:
      case Emotion.Win:
      case Emotion.Victory:
        // Big smile
        g.quadraticCurveTo(0, mouthY + e.radius * 0.3, eyeOffset, mouthY).stroke({ width: 2, color: '#000' });
        break;
      case Emotion.Yum:
        // Open mouth (eating)
        g.moveTo(-eyeOffset * 0.5, mouthY).lineTo(eyeOffset * 0.5, mouthY).stroke({ width: 2, color: '#000' });
        g.arc(0, mouthY, eyeOffset * 0.5, 0, Math.PI).stroke({ width: 2, color: '#000' });
        break;
      case Emotion.Greed:
        // Wide grin with dollar sign eyes
        g.quadraticCurveTo(0, mouthY + e.radius * 0.4, eyeOffset, mouthY).stroke({ width: 2, color: '#000' });
        // Dollar sign eyes using small circles
        g.circle(-eyeOffset, -eyeOffset, eyeSize * 0.3).fill({ color: '#000' });
        g.circle(eyeOffset, -eyeOffset, eyeSize * 0.3).fill({ color: '#000' });
        break;
      case Emotion.Sad:
      case Emotion.Despair:
      case Emotion.Ko:
        // Frown
        g.quadraticCurveTo(0, mouthY - e.radius * 0.2, eyeOffset, mouthY).stroke({ width: 2, color: '#000' });
        break;
      case Emotion.Angry:
        // Angry eyebrows + frown
        g.moveTo(-eyeOffset - eyeSize, -eyeOffset - eyeSize).lineTo(-eyeOffset + eyeSize / 2, -eyeOffset * 0.5).stroke({ width: 2, color: '#000' });
        g.moveTo(eyeOffset + eyeSize, -eyeOffset - eyeSize).lineTo(eyeOffset - eyeSize / 2, -eyeOffset * 0.5).stroke({ width: 2, color: '#000' });
        g.quadraticCurveTo(0, mouthY - e.radius * 0.1, eyeOffset, mouthY).stroke({ width: 2, color: '#000' });
        break;
      case Emotion.Focus:
        // Concentrated eyebrows + neutral mouth
        g.moveTo(-eyeOffset - eyeSize * 0.5, -eyeOffset - eyeSize * 0.5).lineTo(-eyeOffset + eyeSize / 2, -eyeOffset * 0.7).stroke({ width: 2, color: '#000' });
        g.moveTo(eyeOffset + eyeSize * 0.5, -eyeOffset - eyeSize * 0.5).lineTo(eyeOffset - eyeSize / 2, -eyeOffset * 0.7).stroke({ width: 2, color: '#000' });
        g.moveTo(-eyeOffset, mouthY).lineTo(eyeOffset, mouthY).stroke({ width: 2, color: '#000' });
        break;
      case Emotion.Panic:
        // Wide eyes + open mouth
        g.circle(-eyeOffset, -eyeOffset, eyeSize * 1.2).stroke({ width: 2, color: '#000' });
        g.circle(eyeOffset, -eyeOffset, eyeSize * 1.2).stroke({ width: 2, color: '#000' });
        g.moveTo(-eyeOffset * 0.7, mouthY + eyeSize).lineTo(eyeOffset * 0.7, mouthY + eyeSize).stroke({ width: 2, color: '#000' });
        break;
      case Emotion.Hungry:
        // Droopy eyes + small open mouth
        g.moveTo(-eyeOffset, -eyeOffset - eyeSize * 0.5).lineTo(-eyeOffset, -eyeOffset + eyeSize * 0.5).stroke({ width: 2, color: '#000' });
        g.moveTo(eyeOffset, -eyeOffset - eyeSize * 0.5).lineTo(eyeOffset, -eyeOffset + eyeSize * 0.5).stroke({ width: 2, color: '#000' });
        g.arc(0, mouthY, eyeSize * 0.3, 0, Math.PI).stroke({ width: 2, color: '#000' });
        break;
      case Emotion.Neutral:
      default:
        // Simple line mouth
        g.lineTo(eyeOffset, mouthY).stroke({ width: 2, color: '#000' });
        break;
    }
  };

  const drawParticles = (g: Graphics, state: GameState) => {
    g.clear();

    state.particles.forEach((p: any) => {
      if (p.isDead || p.isIcon) return;

      const baseAlpha = p.fadeOut ? (p.life / p.maxLife) : 1;
      const opacity = p.bubbleOpacity ?? p.waveOpacity ?? p.auraIntensity ?? 1;
      const alpha = Math.max(0, Math.min(1, baseAlpha * opacity));
      const color = toPixiColor(
        p.color ||
          p.rippleColor ||
          p.pulseColor ||
          p.shockwaveColor ||
          p.waveColor ||
          p.auraColor ||
          p.bubbleColor ||
          p.shieldColor ||
          p.fieldColor ||
          p.orbColor
      );

      if (p.style === 'line') {
        const len = p.lineLength || p.radius * 2;
        const angle = p.angle || 0;
        g.moveTo(p.position.x, p.position.y);
        g.lineTo(
          p.position.x + Math.cos(angle) * len,
          p.position.y + Math.sin(angle) * len
        );
        g.stroke({ width: p.lineWidth || 2, color, alpha });
        return;
      }

      const ringRadius =
        p.rippleRadius ||
        p.pulseRadius ||
        p.shockwaveRadius ||
        (p.isCleansingWave ? p.radius : 0);

      if (p.style === 'ring' || p.isRipple || p.isPulse || p.isShockwave || p.isCleansingWave) {
        g.circle(p.position.x, p.position.y, ringRadius || p.radius).stroke({
          width: p.lineWidth || 2,
          color,
          alpha
        });
        return;
      }

      const sides = p.geometricSides || (p.isHexagonShield ? 6 : 0);
      if (p.isGeometric || p.isHexagonShield || sides > 0) {
        const radius = p.geometricRadius || p.radius;
        const points = getPolygonPointsAt(sides, radius, p.position.x, p.position.y, p.angle || 0);
        if (p.isHexagonShield) {
          g.poly(points).stroke({ width: 2, color, alpha });
        } else {
          g.poly(points).fill({ color, alpha });
        }
        return;
      }

      g.circle(p.position.x, p.position.y, p.radius).fill({ color, alpha });
    });
  };

  const syncFloatingTexts = (layer: Container, state: GameState) => {
    const map = floatingTextMapRef.current;
    const alive = new Set<string>();

    state.floatingTexts.forEach((t) => {
      alive.add(t.id);
      let text = map.get(t.id);
      if (!text) {
        const style = new TextStyle({
          fontFamily: 'Sora',
          fontSize: t.size,
          fill: t.color,
          align: 'center',
        });
        text = new Text({ text: t.text, style });
        text.anchor.set(0.5);
        layer.addChild(text);
        map.set(t.id, text);
      }
      text.text = t.text;
      text.style.fill = t.color;
      text.style.fontSize = t.size;
      text.x = t.position.x;
      text.y = t.position.y;
      text.alpha = Math.max(0, Math.min(1, t.life));
    });

    for (const [id, text] of map.entries()) {
      if (!alive.has(id)) {
        layer.removeChild(text);
        text.destroy();
        map.delete(id);
      }
    }
  };

  const syncIconParticles = (layer: Container, state: GameState) => {
    const map = iconTextMapRef.current;
    const alive = new Set<string>();

    state.particles.forEach((p: any) => {
      if (!p.isIcon || !p.iconSymbol) return;
      alive.add(p.id);
      let text = map.get(p.id);
      if (!text) {
        const style = new TextStyle({
          fontFamily: 'Cinzel',
          fontSize: p.fontSize || 24,
          fill: p.iconColor || '#ffffff',
          align: 'center',
        });
        text = new Text({ text: p.iconSymbol, style });
        text.anchor.set(0.5);
        layer.addChild(text);
        map.set(p.id, text);
      }
      text.text = p.iconSymbol;
      text.style.fill = p.iconColor || '#ffffff';
      text.style.fontSize = p.fontSize || 24;
      text.x = p.position.x;
      text.y = p.position.y;
      const baseAlpha = p.fadeOut ? (p.life / p.maxLife) : 1;
      text.alpha = Math.max(0, Math.min(1, baseAlpha));
    });

    for (const [id, text] of map.entries()) {
      if (!alive.has(id)) {
        layer.removeChild(text);
        text.destroy();
        map.delete(id);
      }
    }
  };

  const toPixiColor = (color?: string): number => {
    if (!color) return 0xffffff;
    if (color.startsWith('#')) {
      const hex = color.slice(1);
      return Number.parseInt(hex.length === 3
        ? hex.split('').map(c => c + c).join('')
        : hex, 16);
    }
    const match = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
    if (match) {
      const r = Number.parseInt(match[1], 10);
      const g = Number.parseInt(match[2], 10);
      const b = Number.parseInt(match[3], 10);
      return (r << 16) + (g << 8) + b;
    }
    return 0xffffff;
  };

  const getPolygonPointsAt = (sides: number, radius: number, cx: number, cy: number, rotation: number = 0): number[] => {
    const points = [];
    for (let i = 0; i < sides; i++) {
      const angle = (i / sides) * Math.PI * 2 - Math.PI / 2 + rotation;
      points.push(cx + Math.cos(angle) * radius, cy + Math.sin(angle) * radius);
    }
    return points;
  };

  const getPolygonPoints = (sides: number, radius: number): number[] => {
    const points = [];
    for (let i = 0; i < sides; i++) {
      const angle = (i / sides) * Math.PI * 2 - Math.PI / 2; // Start at top
      points.push(Math.cos(angle) * radius, Math.sin(angle) * radius);
    }
    return points;
  };

  return <div ref={containerRef} className="absolute inset-0" />;
};

export default PixiGameCanvas;
