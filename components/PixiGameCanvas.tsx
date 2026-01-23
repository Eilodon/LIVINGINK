import React, { useEffect, useRef } from 'react';
import { Application, Graphics, Container, Text, TextStyle } from 'pixi.js';
import { GameState, Player, Bot, Entity, Food } from '../types';
import { MAP_RADIUS, COLOR_PALETTE, RING_RADII } from '../constants';
import { ShapeId, Emotion } from '../services/cjr/cjrTypes';

interface PixiGameCanvasProps {
  gameState: GameState;
  isTouchInput?: boolean;
}

const PixiGameCanvas: React.FC<PixiGameCanvasProps> = ({ gameState }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<Application | null>(null);
  const entitiesRef = useRef<Map<string, Container>>(new Map()); // Changed to Container for complex objects

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

      // Setup Map Graphics
      const map = new Graphics();
      map.label = 'Map';
      world.addChild(map);

      // Draw Map Static
      drawMap(map);

      // Render Loop
      app.ticker.add(() => {
        if (!gameState || !gameState.player) return;

        // Camera Follow (Smooth Lerp?)
        const targetX = app.screen.width / 2 - gameState.camera.x;
        const targetY = app.screen.height / 2 - gameState.camera.y;

        // Simple lerp for smoothness
        world.x += (targetX - world.x) * 0.1;
        world.y += (targetY - world.y) * 0.1;

        // Sync Entities
        syncEntities(world, gameState);
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

    // R1 Boundary (Standard)
    // g.circle(0, 0, RING_RADII.R1_BOUNDARY).stroke({ width: 2, color: '#3b82f6', alpha: 0.1 });

    // R2 Boundary (Elite) - Blue Membrane
    g.circle(0, 0, RING_RADII.R2_BOUNDARY).stroke({ width: 4, color: '#3b82f6', alpha: 0.5 });
    // Dotted effect simulation? (Pixi doesn't support native dash easily without texture, keep solid for now)

    // R3 Boundary (Boss/King) - Red Membrane
    g.circle(0, 0, RING_RADII.R3_BOUNDARY).stroke({ width: 6, color: '#ef4444', alpha: 0.8 });
    g.circle(0, 0, RING_RADII.R3_BOUNDARY).fill({ color: '#ef4444', alpha: 0.05 }); // Danger zone tint
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
              fontFamily: 'Arial',
              fontSize: 12,
              fill: 0xffffff,
              align: 'center',
            }
          });
          label.anchor.set(0.5, 1.5); // Position above
          label.y = -e.radius;
          container.addChild(label);
        }

        world.addChild(container);
        entitiesRef.current.set(e.id, container);
      }

      // Update Position
      container.x = e.position.x;
      container.y = e.position.y;
      container.rotation = e.rotation || 0;

      // Update Visuals
      const body = container.children.find(c => c.label === 'Body') as Graphics;
      const face = container.children.find(c => c.label === 'Face') as Graphics;

      if (body) updateBodyVisuals(body, e);
      if (face) updateFaceVisuals(face, e);
    });

    // Cleanup
    for (const [id, container] of entitiesRef.current) {
      if (!currentIds.has(id)) {
        world.removeChild(container);
        container.destroy({ children: true });
        entitiesRef.current.delete(id);
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
        g.quadraticCurveTo(0, mouthY + e.radius * 0.3, eyeOffset, mouthY).stroke({ width: 2, color: '#000' });
        break;
      case Emotion.Sad:
      case Emotion.Despair:
      case Emotion.Ko:
        g.quadraticCurveTo(0, mouthY - e.radius * 0.2, eyeOffset, mouthY).stroke({ width: 2, color: '#000' });
        break;
      case Emotion.Angry:
      case Emotion.Focus:
        // Eyebrows
        g.moveTo(-eyeOffset - eyeSize, -eyeOffset - eyeSize).lineTo(-eyeOffset + eyeSize / 2, -eyeOffset * 0.5).stroke({ width: 2, color: '#000' });
        g.moveTo(eyeOffset + eyeSize, -eyeOffset - eyeSize).lineTo(eyeOffset - eyeSize / 2, -eyeOffset * 0.5).stroke({ width: 2, color: '#000' });
        // Flat mouth
        g.moveTo(-eyeOffset, mouthY).lineTo(eyeOffset, mouthY).stroke({ width: 2, color: '#000' });
        break;
      case Emotion.Neutral:
      default:
        g.lineTo(eyeOffset, mouthY).stroke({ width: 2, color: '#000' });
        break;
    }
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
