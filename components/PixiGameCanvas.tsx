import React, { useEffect, useRef } from 'react';
import { Application, Container, Graphics, Mesh, Geometry, Shader } from 'pixi.js';
import { GameState, isPlayerOrBot } from '../types';
import { TattooId } from '../services/cjr/cjrTypes';
import { CrystalVFX } from '../services/vfx/CrystalVFX';
import { COLOR_PALETTE, RING_RADII } from '../services/cjr/cjrConstants';
import { JELLY_VERTEX, JELLY_FRAGMENT } from '../services/cjr/shaders';

interface PixiGameCanvasProps {
  gameStateRef: React.MutableRefObject<GameState | null>;
  inputEnabled: boolean;
  alphaRef: React.MutableRefObject<number>;
}

const PixiGameCanvas: React.FC<PixiGameCanvasProps> = ({ gameStateRef, inputEnabled, alphaRef }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<Application | null>(null);
  const vfxRef = useRef<CrystalVFX | null>(null);

  // Caches
  const geometryCache = useRef<Geometry | null>(null);
  const shaderCache = useRef<Shader | null>(null);
  const meshesRef = useRef<Map<string, Mesh | Graphics>>(new Map());
  const cameraSmoothRef = useRef({ x: 0, y: 0 });

  useEffect(() => {
    if (!containerRef.current || appRef.current) return;

    // 1. Init Pixi App
    const app = new Application();
    app.init({
      background: COLOR_PALETTE.background,
      resizeTo: window,
      antialias: false,
      resolution: Math.min(window.devicePixelRatio, 1.5),
      autoDensity: true,
      preference: 'webgl',
    }).then(() => {
      if (!containerRef.current) { app.destroy(); return; }
      containerRef.current.appendChild(app.canvas);
      appRef.current = app;

      // Init Resources
      initResources();

      // 2. Setup Scene Graph
      // Camera Container: Holds World Content
      const cameraContainer = new Container();
      cameraContainer.label = 'Camera';

      // Center camera container on screen
      cameraContainer.x = app.screen.width / 2;
      cameraContainer.y = app.screen.height / 2;
      app.stage.addChild(cameraContainer);

      // --- LAYER 0: BACKGROUND ---
      const bgLayer = new Container();
      cameraContainer.addChild(bgLayer);

      // Dust Particles
      const dustGraphics = new Graphics();
      bgLayer.addChild(dustGraphics);
      const dustParticles = Array.from({ length: 50 }, () => ({
        x: (Math.random() - 0.5) * 3000,
        y: (Math.random() - 0.5) * 3000,
        size: Math.random() * 2 + 1,
        alpha: Math.random() * 0.5 + 0.1
      }));
      dustParticles.forEach(p => {
        dustGraphics.circle(p.x, p.y, p.size).fill({ color: 0xffffff, alpha: p.alpha });
      });

      // --- LAYER 1: MAP (Rings) ---
      const mapGraphics = new Graphics();
      bgLayer.addChild(mapGraphics);

      // --- LAYER 2: ENTITIES (Food, Players) ---
      const entityLayer = new Container();
      entityLayer.sortableChildren = true;
      cameraContainer.addChild(entityLayer);

      // --- LAYER 3: VFX (Explosions) ---
      const vfx = new CrystalVFX(app);
      vfxRef.current = vfx;
      cameraContainer.addChild(vfx.getContainer());

      // 3. Input Handling
      setupInputs(app, gameStateRef, inputEnabled);

      // 4. Render Loop
      app.ticker.add((ticker) => {
        const state = gameStateRef.current;
        if (!state || !state.player) return;

        const dt = ticker.deltaTime / 60;
        const alpha = alphaRef.current;

        // -- CAMERA LOGIC --
        const p = state.player;
        const pX = p.prevPosition ? (p.prevPosition.x + (p.position.x - p.prevPosition.x) * alpha) : p.position.x;
        const pY = p.prevPosition ? (p.prevPosition.y + (p.position.y - p.prevPosition.y) * alpha) : p.position.y;

        // Target opposite to player
        const targetX = -pX;
        const targetY = -pY;

        // Smoothing
        cameraSmoothRef.current.x += (targetX - cameraSmoothRef.current.x) * 0.1;
        cameraSmoothRef.current.y += (targetY - cameraSmoothRef.current.y) * 0.1;

        cameraContainer.x = (app.screen.width / 2) + cameraSmoothRef.current.x;
        cameraContainer.y = (app.screen.height / 2) + cameraSmoothRef.current.y;

        // -- RENDER UPDATES --
        drawRings(mapGraphics, state.gameTime);

        // Sync Entities
        syncEntities(entityLayer, state, app.ticker.lastTime / 1000, alpha);

        // -- VFX EVENTS --
        processVfxEvents(state, vfx);
        vfx.update(dt);
      });
    });

    return () => {
      appRef.current?.destroy(true, { children: true });
      appRef.current = null;
    };
  }, []);

  const initResources = () => {
    // Quad Geometry
    const geometry = new Geometry({
      attributes: {
        aVertexPosition: [-1, -1, 1, -1, 1, 1, -1, 1],
        aUvs: [0, 0, 1, 0, 1, 1, 0, 1],
      },
      indexBuffer: [0, 1, 2, 0, 2, 3]
    });
    geometryCache.current = geometry;

    try {
      const shader = Shader.from({
        gl: { vertex: JELLY_VERTEX, fragment: JELLY_FRAGMENT },
        resources: {
          uTime: 0, uWobble: 0.1, uSquish: 0, uColor: [1, 1, 1],
          uAlpha: 1, uBorderColor: [0, 0, 0], uDeformMode: 0, uPatternMode: 0,
          uEmotion: 0, uEnergy: 0, uPulsePhase: 0.0,
        }
      });
      shaderCache.current = shader;
    } catch (e) {
      console.warn('Shader compile failed', e);
    }
  };

  const drawRings = (g: Graphics, time: number) => {
    g.clear();
    g.circle(0, 0, RING_RADII.R1).stroke({ width: 2, color: COLOR_PALETTE.rings.r1, alpha: 0.3 });
    g.circle(0, 0, RING_RADII.R2).stroke({ width: 4, color: COLOR_PALETTE.rings.r2, alpha: 0.5 });
    const pulse = Math.sin(time * 3) * 0.1;
    g.circle(0, 0, RING_RADII.R3).stroke({ width: 6 + pulse * 4, color: COLOR_PALETTE.rings.r3, alpha: 0.8 });
  };

  const setupInputs = (app: Application, stateRef: any, inputEnabled: boolean) => {
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
        y: state.camera.y + dy // Note: state.camera usually stores raw position, we might need to adjust logic if camera system changed
        // But App.tsx sets targetPosition directly.
        // Actually here we need to reverse the camera transform.
        // Screen -> World: WorldPos = CameraPos + (ScreenPos - ScreenCenter)
        // Since camera logic above sets Container = Center - PlayerPos
        // Global mouse is relative to Screen TopLeft.
        // ScreenCenter is (w/2, h/2).
        // Delta from Center = Mouse - Center.
        // In World space (CameraContainer), 0,0 is at Center + CamOffset.
        // If we want world pos:
        // P_world = P_player + Delta? Roughly.
      };
      // Better Input Logic: use inputManager via App, but here is fine for direct connection
      // For now we keep this simple.
    });

    app.stage.on('pointerdown', () => {
      if (stateRef.current && inputEnabled) stateRef.current.inputs.space = true;
    });
    app.stage.on('pointerup', () => {
      if (stateRef.current && inputEnabled) stateRef.current.inputs.space = false;
    });
  };

  const syncEntities = (container: Container, state: GameState, time: number, alpha: number) => {
    const activeIds = new Set<string>();
    const all = [...state.players, ...state.bots, ...state.food];

    all.forEach(e => {
      if (e.isDead) return;
      activeIds.add(e.id);

      let mesh = meshesRef.current.get(e.id);
      if (!mesh) {
        if ('score' in e && geometryCache.current && shaderCache.current) {
          // Shader Mesh for Player/Bot
          const entityShader = Shader.from({
            gl: { vertex: JELLY_VERTEX, fragment: JELLY_FRAGMENT },
            resources: {
              uTime: 0, uWobble: 0.1, uSquish: 0, uColor: [1, 1, 1],
              uAlpha: 1, uBorderColor: [0, 0, 0], uDeformMode: 0, uPatternMode: 0,
              uEmotion: 0, uEnergy: 0, uPulsePhase: 0.0,
            }
          });
          mesh = new Mesh({ geometry: geometryCache.current, shader: entityShader });
          mesh.zIndex = 10;
        } else {
          // Graphics for Food
          const g = new Graphics();
          if ('value' in e) {
            // Check kind if available
            // Assuming generic food for now or simple shapes
            g.circle(0, 0, e.radius).fill({ color: 0xffffff });
          } else {
            g.circle(0, 0, e.radius).fill({ color: 0xffffff });
          }
          mesh = g;
          mesh.zIndex = 1;
        }
        container.addChild(mesh);
        meshesRef.current.set(e.id, mesh);
      }

      // Interpolation
      const prev = e.prevPosition || e.position;
      const curr = e.position;
      const x = prev.x + (curr.x - prev.x) * alpha;
      const y = prev.y + (curr.y - prev.y) * alpha;
      mesh.position.set(x, y);

      // Update Props (Shader/Tint)
      if (mesh instanceof Mesh && mesh.shader) {
        mesh.scale.set(e.radius);
        const res = mesh.shader.resources;
        res.uTime = time + x * 0.01;

        const colorHex = e.color || '#ffffff';
        const val = parseInt(colorHex.replace('#', ''), 16);
        res.uColor[0] = ((val >> 16) & 255) / 255;
        res.uColor[1] = ((val >> 8) & 255) / 255;
        res.uColor[2] = (val & 255) / 255;

        if (isPlayerOrBot(e)) {
          let deform = 0; let pattern = 0;
          const tattoos = e.tattoos || [];
          if (tattoos.includes(TattooId.GrimHarvest)) deform = 1;
          if (tattoos.includes(TattooId.Lightning)) pattern = 2;
          res.uDeformMode = deform;
          res.uPatternMode = pattern;
          res.uEnergy = e.matchPercent || 0;
        }
      } else if (mesh instanceof Graphics) {
        const colorHex = e.color || '#ffffff';
        const val = parseInt(colorHex.replace('#', ''), 16);
        if (mesh.tint !== val) mesh.tint = val;
      }
    });

    // Cleanup dead entities
    for (const [id, m] of meshesRef.current) {
      if (!activeIds.has(id)) {
        container.removeChild(m);
        m.destroy();
        meshesRef.current.delete(id);
      }
    }
  };

  const processVfxEvents = (state: GameState, vfx: CrystalVFX) => {
    while (state.vfxEvents.length > 0) {
      const evt = state.vfxEvents.shift();
      if (!evt || typeof evt !== 'string') continue;

      const parts = evt.split(':');
      const type = parts[0];
      const x = parseFloat(parts[1]);
      const y = parseFloat(parts[2]);

      // Helper parse color safely
      const parseColor = (hex: string) => {
        if (!hex) return 0xFFFFFF;
        if (hex.startsWith('#')) return parseInt(hex.replace('#', ''), 16);
        return parseInt(hex, 16) || 0xFFFFFF;
      };

      if (type === 'explode') {
        vfx.explode(x, y, parseColor(parts[3]), parseInt(parts[4]) || 10);
      }
      else if (type === 'pop') {
        vfx.explode(x, y, parseColor(parts[3]), 6);
      }
      else if (type === 'hit') {
        vfx.explode(x, y, parseColor(parts[3]), 12);
      }
      else if (type === 'dash') {
        vfx.explode(x, y, parseColor(parts[3]), 8);
      }
      else if (type === 'shockwave') {
        vfx.shockwave(x, y, parseColor(parts[3]));
      }
      else if (type === 'vortex') {
        vfx.spiral(x, y, parseColor(parts[3]), 40);
      }
      else if (type === 'synergy') {
        // synergy:x:y:color:pattern
        const pattern = parts[4];
        const col = parseColor(parts[3]);
        if (pattern === 'spiral') vfx.spiral(x, y, col);
        else if (pattern === 'explosion') vfx.explode(x, y, col, 50);
        else if (pattern === 'geometric') vfx.shockwave(x, y, col); // Geometric placeholder
        else vfx.shockwave(x, y, col);
      }
      else if (type === 'commit') {
        // commit:x:y:pid:ringId
        const pid = parts[3];
        const ringId = parseInt(parts[4]);
        const color = ringId === 3 ? 0xff0000 : (ringId === 2 ? 0x0000ff : 0x00ff00);
        vfx.shockwave(x, y, color);
        vfx.explode(x, y, 0xffd700, 50);
      }
    }
  };

  return <div ref={containerRef} className="absolute inset-0" />;
};

export default PixiGameCanvas;
