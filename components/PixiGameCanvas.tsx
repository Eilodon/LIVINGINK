
import React, { useEffect, useRef } from 'react';
import { Application, Container, Geometry, Shader, Mesh, Texture, Graphics, Text, TextStyle } from 'pixi.js';
import { GameState, Entity } from '../types';
import { MAP_RADIUS } from '../constants';
import { RING_RADII, COLOR_PALETTE } from '../services/cjr/cjrConstants';
import { calculateMatchPercent, pigmentToHex } from '../services/cjr/colorMath';
import { JELLY_VERTEX, JELLY_FRAGMENT } from '../services/cjr/shaders';

// Performance Configuration
const USE_SHADERS = true; // Feature flag for rollout
const WORLD_SCALE = 1.0;

interface PixiGameCanvasProps {
  gameStateRef: React.MutableRefObject<GameState | null>;
  inputEnabled: boolean;
}

const PixiGameCanvas: React.FC<PixiGameCanvasProps> = ({ gameStateRef, inputEnabled }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<Application | null>(null);

  // Entity Pools / caches
  const meshesRef = useRef<Map<string, Mesh | Container>>(new Map());
  const geometryCache = useRef<Geometry | null>(null);
  const shaderCache = useRef<Shader | null>(null);

  useEffect(() => {
    if (!containerRef.current || appRef.current) return;

    // Initialize Pixi App
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

      // Init Shared Resources
      initResources();

      // Layers
      const world = new Container();
      world.label = 'World';
      world.x = app.screen.width / 2;
      world.y = app.screen.height / 2;
      app.stage.addChild(world);

      const mapLayer = new Container();
      world.addChild(mapLayer);
      drawMap(mapLayer);

      const entityLayer = new Container();
      world.addChild(entityLayer);

      const uiLayer = new Container();
      app.stage.addChild(uiLayer); // UI stays on screen

      // Input Handling
      setupInputs(app, gameStateRef, world);

      // Game Loop
      app.ticker.add((ticker) => {
        const state = gameStateRef.current;
        if (!state || !state.player) return;
        const dt = ticker.deltaTime / 60; // Approximate dt in seconds

        // Camera (Lerp)
        const targetX = -state.camera.x + app.screen.width / 2;
        const targetY = -state.camera.y + app.screen.height / 2;
        world.x += (targetX - world.x) * 0.1;
        world.y += (targetY - world.y) * 0.1;

        // Render Entities
        syncEntities(entityLayer, state, app.ticker.lastTime / 1000);

        // VFX / UI
        // (Previous particle system logic can be ported here, kept simple for this step)
      });
    });

    return () => {
      appRef.current?.destroy(true, { children: true });
      appRef.current = null;
    };
  }, []);

  const initResources = () => {
    // Create shared Geometry for a Quad (Player)
    // 0--1
    // |  |
    // 3--2
    const geometry = new Geometry({
      attributes: {
        aVertexPosition: [-1, -1, 1, -1, 1, 1, -1, 1],
        aUvs: [0, 0, 1, 0, 1, 1, 0, 1],
      },
      indexBuffer: [0, 1, 2, 0, 2, 3]
    });
    geometryCache.current = geometry;

    // Compile Shader
    const shader = Shader.from({
      gl: { vertex: JELLY_VERTEX, fragment: JELLY_FRAGMENT },
      resources: {
        uTime: 0,
        uWobble: 0.1,
        uSquish: 0,
        uColor: [1, 1, 1],
        uAlpha: 1,
        uBorderColor: [0, 0, 0],
      }
    });
    shaderCache.current = shader;
  };

  const drawMap = (container: Container) => {
    const g = new Graphics();

    // Ring 3 (Death)
    g.circle(0, 0, RING_RADII.R3).stroke({ width: 4, color: COLOR_PALETTE.rings.r3, alpha: 0.5 });

    // Ring 2 (Mid)
    g.circle(0, 0, RING_RADII.R2).stroke({ width: 4, color: COLOR_PALETTE.rings.r2, alpha: 0.3 });

    // Ring 1 (Outer) - Map Boundary
    g.circle(0, 0, RING_RADII.R1).stroke({ width: 2, color: COLOR_PALETTE.rings.r1, alpha: 0.2 });

    container.addChild(g);
  };

  const syncEntities = (container: Container, state: GameState, time: number) => {
    const activeIds = new Set<string>();

    // Combine lists: Players, Bots, Food
    // In Full implementation, we iterate strictly.
    const all = [...state.players, ...state.bots, ...state.food];

    all.forEach(e => {
      if (e.isDead) return;
      activeIds.add(e.id);

      let mesh = meshesRef.current.get(e.id);

      if (!mesh) {
        // New Entity
        if ('score' in e) { // Player/Bot -> USE SHADER
          if (USE_SHADERS && geometryCache.current && shaderCache.current) {
            mesh = new Mesh({
              geometry: geometryCache.current,
              shader: shaderCache.current // We need to clone wrapper to set unique uniforms? 
              // Pixi v8 Shader resources are shared. We usually use a material concept.
              // For simplicity in Pixi, we can clone shader or use Mesh with specific uniforms.
              // Actually, in Pixi v8, shader state is robust.
              // Let's create a new Shader instance reusing the program for uniforms.
            });
            // Manual clone for uniforms
            mesh.shader = Shader.from({
              gl: { vertex: JELLY_VERTEX, fragment: JELLY_FRAGMENT },
              resources: {
                uTime: 0,
                uWobble: 0.05,
                uSquish: 0,
                uColor: [1, 1, 1],
                uAlpha: 1,
                uBorderColor: [0, 0, 0]
              }
            });
          } else {
            // Fallback
            const g = new Graphics();
            g.circle(0, 0, e.radius);
            g.fill(0xffffff);
            mesh = g;
          }
        } else {
          // Food -> Simple Graphics (Instancing later?)
          // Or use small Texture
          const g = new Graphics();

          // Pickup Shape
          if ((e as any).kind === 'pigment') g.circle(0, 0, e.radius).fill(0xffffff);
          else if ((e as any).kind === 'candy_vein') g.star(0, 0, 5, e.radius * 1.5, e.radius).fill(0xffd700);
          else g.rect(-e.radius / 2, -e.radius / 2, e.radius, e.radius).fill(0x888888);

          mesh = g;
        }
        container.addChild(mesh);
        meshesRef.current.set(e.id, mesh);
      }

      // Update Transform
      mesh.position.x = e.position.x;
      mesh.position.y = e.position.y;

      // Update Visuals
      if (mesh instanceof Mesh) {
        const scale = e.radius; // Shader quad is -1..1, so radius needed?
        // Quad size is 2x2. So scale = radius.
        mesh.scale.set(scale);

        // Set Uniforms - GUARDED CHECK
        if (mesh.shader && mesh.shader.resources) {
          const resources = mesh.shader.resources;
          resources.uTime = time + (e.position.x * 0.01); // Phase shift

          // Color Logic
          const colorHex = e.color || '#ffffff';
          const val = parseInt(colorHex.replace('#', ''), 16);
          resources.uColor[0] = ((val >> 16) & 255) / 255;
          resources.uColor[1] = ((val >> 8) & 255) / 255;
          resources.uColor[2] = (val & 255) / 255;

          // Wobble based on velocity
          const speed = Math.hypot(e.velocity.x, e.velocity.y);
          resources.uSquish = Math.min(0.3, speed / 500);
        }

        // Emotion -> Texture? (Not implemented in Shader yet, overlay face sprite needed)
      } else if (mesh instanceof Graphics) {
        // Static/Simple update (Food)
        // Color update?
        if (mesh.tint !== parseInt(e.color?.replace('#', '') || 'ffffff', 16)) {
          mesh.tint = parseInt(e.color?.replace('#', '') || 'ffffff', 16);
        }
      }
    });

    // Cleanup
    for (const [id, m] of meshesRef.current) {
      if (!activeIds.has(id)) {
        container.removeChild(m);
        m.destroy();
        meshesRef.current.delete(id);
      }
    }
  };

  const setupInputs = (app: Application, stateRef: any, world: Container) => {
    app.stage.eventMode = 'static';
    app.stage.hitArea = app.screen;

    app.stage.on('pointermove', (e) => {
      if (!inputEnabled || !stateRef.current?.player) return;
      const state = stateRef.current;
      const center = { x: app.screen.width / 2, y: app.screen.height / 2 };
      const dx = e.global.x - center.x;
      const dy = e.global.y - center.y;
      state.player.targetPosition = {
        x: state.camera.x + dx,
        y: state.camera.y + dy
      };
    });

    app.stage.on('pointerdown', () => {
      if (stateRef.current) stateRef.current.inputs.space = true;
    });
    app.stage.on('pointerup', () => {
      if (stateRef.current) stateRef.current.inputs.space = false;
    });
  };

  return <div ref={containerRef} className="absolute inset-0 overflow-hidden bg-gray-900" />;
};

export default PixiGameCanvas;
