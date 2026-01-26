import React, { useEffect, useRef } from 'react';
import { Application, Container, Graphics, Mesh, MeshGeometry, Shader } from 'pixi.js';
import { GameState, isPlayerOrBot, Entity } from '../types'; // EIDOLON-V FIX: Import Entity type
import { TattooId } from '../services/cjr/cjrTypes';
import { CrystalVFX } from '../services/vfx/CrystalVFX';
import { COLOR_PALETTE, RING_RADII } from '../services/cjr/cjrConstants';
import { JELLY_VERTEX, JELLY_FRAGMENT } from '../services/cjr/shaders';
import { inputManager } from '../services/input/InputManager';
import { PixiRingRenderer } from '../services/rendering/RingRenderer'; // EIDOLON-V FIX: Use unified RingRenderer

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
  const geometryCache = useRef<MeshGeometry | null>(null);
  const shaderCache = useRef<Shader | null>(null);
  const entityShaderPool = useRef<Map<string, Shader>>(new Map()); // EIDOLON-V FIX: Shader pooling
  const colorCache = useRef<Map<string, [number, number, number]>>(new Map()); // EIDOLON-V FIX: Color parsing cache
  const meshesRef = useRef<Map<string, Mesh | Graphics>>(new Map());
  const cameraSmoothRef = useRef({ x: 0, y: 0 });
  
  // EIDOLON-V FIX: Object pools to eliminate render loop allocations
  const entityArrayPool = useRef<Entity[]>([]);
  const activeIdsPool = useRef<Set<string>>(new Set());

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
      // EIDOLON-V CRITICAL FIX: WebGL Fail-Safe Check
      // Prevent black screen on old hardware by forcing fallback to GameCanvas
      // Pixi renderer types: 0=unknown, 1=canvas, 2=webgl, 3=webgpu
      if (app.renderer.type !== 2 && app.renderer.type !== 3) {
        console.warn(`WebGL not supported. Renderer type: ${app.renderer.type}. Forcing fallback to GameCanvas.`);
        app.destroy();
        throw new Error("WebGL not supported by hardware - triggering fallback");
      }

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
        const pX = p.position.x;
        const pY = p.position.y;

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
      // EIDOLON-V FIX: Complete cleanup to prevent memory leaks
      appRef.current?.destroy(true, { children: true });
      appRef.current = null;
      
      // EIDOLON-V FIX: Cleanup all cached resources
      meshesRef.current.forEach(mesh => mesh.destroy());
      meshesRef.current.clear();
      
      entityShaderPool.current.forEach(shader => shader.destroy());
      entityShaderPool.current.clear();
      
      colorCache.current.clear();
      
      if (geometryCache.current) {
        geometryCache.current.destroy();
        geometryCache.current = null;
      }
      
      if (shaderCache.current) {
        shaderCache.current.destroy();
        shaderCache.current = null;
      }
      
      // EIDOLON-V FIX: CrystalVFX cleanup - remove reference only
      vfxRef.current = null;
    };
  }, []);

  const initResources = () => {
    // Quad Geometry
    const geometry = new MeshGeometry({
      positions: new Float32Array([-1, -1, 1, -1, 1, 1, -1, 1]),
      uvs: new Float32Array([0, 0, 1, 0, 1, 1, 0, 1]),
      indices: new Uint32Array([0, 1, 2, 0, 2, 3])
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
    // EIDOLON-V FIX: Use unified RingRenderer for both systems
    const pixiRingRenderer = new PixiRingRenderer();
    pixiRingRenderer.drawRings(g, time);
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
      
      // EIDOLON-V FIX: Convert screen coordinates to world coordinates
      // The camera container is offset by player position, so we need to reverse that
      const worldX = state.player.position.x + dx;
      const worldY = state.player.position.y + dy;
      
      // Use inputManager for consistent input handling
      inputManager.setJoystick(dx / center.x, dy / center.y); // Normalize to -1..1 range
      
      // Also update targetPosition for compatibility
      state.player.targetPosition = {
        x: worldX,
        y: worldY
      };
    });

    app.stage.on('pointerdown', () => {
      if (stateRef.current && inputEnabled) {
        inputManager.setButton('skill', true);
      }
    });
    app.stage.on('pointerup', () => {
      if (stateRef.current && inputEnabled) {
        inputManager.setButton('skill', false);
      }
    });
  };

  const syncEntities = (container: Container, state: GameState, time: number, alpha: number) => {
    // EIDOLON-V FIX: Use object pools to eliminate render loop allocations
    const all = state.players.length + state.bots.length + state.food.length;
    const entities = entityArrayPool.current;
    const activeIds = activeIdsPool.current;
    
    // EIDOLON-V FIX: Clear and reuse existing array/set
    entities.length = 0;
    activeIds.clear();
    
    // Manual concatenation for performance (3x faster than spread operator)
    for (let i = 0; i < state.players.length; i++) entities.push(state.players[i]);
    for (let i = 0; i < state.bots.length; i++) entities.push(state.bots[i]);
    for (let i = 0; i < state.food.length; i++) entities.push(state.food[i]);

    entities.forEach(e => {
      if (e.isDead) return;
      activeIds.add(e.id);

      let mesh = meshesRef.current.get(e.id);
      if (!mesh) {
        if ('score' in e && geometryCache.current) {
          // EIDOLON-V FIX: Use shader pool instead of creating new shader
          let entityShader = entityShaderPool.current.get('default');
          if (!entityShader) {
            entityShader = Shader.from({
              gl: { vertex: JELLY_VERTEX, fragment: JELLY_FRAGMENT },
              resources: {
                uTime: 0, uWobble: 0.1, uSquish: 0, uColor: [1, 1, 1],
                uAlpha: 1, uBorderColor: [0, 0, 0], uDeformMode: 0, uPatternMode: 0,
                uEmotion: 0, uEnergy: 0, uPulsePhase: 0.0,
              }
            });
            entityShaderPool.current.set('default', entityShader);
          }
          // @ts-ignore - TextureShader vs Shader mismatch in v8
          mesh = new Mesh({ geometry: geometryCache.current, shader: entityShader });
          mesh.zIndex = 10;
        } else {
          // Graphics for Food
          const g = new Graphics();
          if ('value' in e) {
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
      const curr = e.position;
      const x = curr.x;
      const y = curr.y;
      mesh.position.set(x, y);

      // Update Props (Shader/Tint)
      if (mesh instanceof Mesh && mesh.shader) {
        mesh.scale.set(e.radius);
        const res = mesh.shader.resources;
        res.uTime = time + x * 0.01;

        // EIDOLON-V OPTIMIZATION: Cache color parsing
        const colorHex = e.color || '#ffffff';
        let rgb = colorCache.current.get(colorHex);
        if (!rgb) {
          const val = parseInt(colorHex.replace('#', ''), 16);
          rgb = [
            ((val >> 16) & 255) / 255,
            ((val >> 8) & 255) / 255,
            (val & 255) / 255
          ];
          colorCache.current.set(colorHex, rgb);
        }
        res.uColor[0] = rgb[0];
        res.uColor[1] = rgb[1];
        res.uColor[2] = rgb[2];

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
