import React, { useEffect, useRef } from 'react';
import {
  Application,
  Container,
  Geometry,
  Graphics,
  Mesh,
  Shader,
  GlProgram as Program,
  Texture,
} from 'pixi.js';
import { GameState } from '../types';
import { JELLY_VERTEX, JELLY_FRAGMENT, JellyShaderResources } from '../game/cjr/shaders';
import { MAP_RADIUS, COLOR_PALETTE_HEX, RING_RADII } from '../constants';
import { getPhysicsWorld } from '../game/engine/context';
import { TransformStore, PhysicsStore } from '@cjr/engine';

const STRIDE = TransformStore.STRIDE;
const X_OFFSET = 0;
const Y_OFFSET = 1;
const PREV_X_OFFSET = 4;
const PREV_Y_OFFSET = 5;
const RADIUS_OFFSET = 4;

interface PixiGameCanvasProps {
  gameStateRef: React.RefObject<GameState | null>;
  inputEnabled: boolean;
  alphaRef: React.MutableRefObject<number>;
}

// EIDOLON-V: FixedRenderPool - Cursor-based Zero-Allocation Pool
// Pattern: Pre-allocate + Cursor index = No .pop() fragmentation, No Map overhead
class FixedRenderPool<T extends Container> {
  private pool: T[] = [];
  private activeIndex: number = 0;
  private factory: () => T;

  constructor(initialSize: number, factory: () => T) {
    this.factory = factory;
    // Pre-allocate entire pool upfront - eliminates runtime allocations
    for (let i = 0; i < initialSize; i++) {
      const item = factory();
      item.visible = false;
      this.pool.push(item);
    }
  }

  get(): T {
    if (this.activeIndex >= this.pool.length) {
      // Emergency expansion - should rarely trigger if initialSize is calibrated
      const item = this.factory();
      this.pool.push(item);
    }
    const item = this.pool[this.activeIndex++];
    item.visible = true;
    return item;
  }

  reset(): void {
    // O(activeIndex) visibility toggle - much faster than Map iteration
    for (let i = 0; i < this.activeIndex; i++) {
      this.pool[i].visible = false;
    }
    this.activeIndex = 0;
  }

  getActiveCount(): number {
    return this.activeIndex;
  }
}

const PixiGameCanvas: React.FC<PixiGameCanvasProps> = ({ gameStateRef, alphaRef }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<Application | null>(null);

  // Layers
  const worldLayerRef = useRef<Container | null>(null);
  const gridLayerRef = useRef<Graphics | null>(null);
  const foodLayerRef = useRef<Container | null>(null);
  const unitLayerRef = useRef<Container | null>(null);
  const vfxLayerRef = useRef<Container | null>(null);
  const uiLayerRef = useRef<Container | null>(null);

  // Pools - FixedRenderPool with cursor pattern for zero-GC rendering
  const foodPoolRef = useRef<FixedRenderPool<Graphics> | null>(null);
  const projectilePoolRef = useRef<FixedRenderPool<Graphics> | null>(null);
  const unitPoolRef = useRef<FixedRenderPool<Mesh<Geometry, Shader>> | null>(null);
  const vfxPoolRef = useRef<FixedRenderPool<Graphics> | null>(null);

  // Shared Shader
  const shaderRef = useRef<Shader | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const init = async () => {
      const app = new Application();
      await app.init({
        resizeTo: containerRef.current!,
        background: COLOR_PALETTE_HEX.background,
        antialias: true,
        preference: 'webgl',
      });

      containerRef.current?.appendChild(app.canvas);
      appRef.current = app;

      // 1. Setup Layer Hierarchy
      // Root Container for Camera Transform
      const world = new Container();
      worldLayerRef.current = world;
      app.stage.addChild(world);

      // Grid (Back)
      const grid = new Graphics();
      gridLayerRef.current = grid;
      world.addChild(grid);

      // Food (Below Units)
      const foodLayer = new Container();
      foodLayerRef.current = foodLayer;
      world.addChild(foodLayer);

      // Units (Players/Bots)
      const unitLayer = new Container();
      unitLayerRef.current = unitLayer;
      world.addChild(unitLayer);

      // Projectiles / VFX
      const vfxLayer = new Container();
      vfxLayerRef.current = vfxLayer;
      world.addChild(vfxLayer);

      // UI (Floating Text) - separate if needed, or in VFX
      const uiLayer = new Container();
      uiLayerRef.current = uiLayer;
      world.addChild(uiLayer);

      // 2. Setup Shaders (The Secret Sauce)
      const glProgram = new Program({
        vertex: JELLY_VERTEX,
        fragment: JELLY_FRAGMENT,
      });

      shaderRef.current = new Shader({
        glProgram,
        resources: {
          uniforms: {
            uTime: { value: 0, type: 'f32' },
            uAberration: { value: 0, type: 'f32' },
            uJellyColor: { value: [0, 1, 1], type: 'vec3<f32>' },
            uAlpha: { value: 1, type: 'f32' },
            uEnergy: { value: 1, type: 'f32' }, // Pulse
            uSquish: { value: 0, type: 'f32' },
            translationMatrix: { value: [1, 0, 0, 0, 1, 0, 0, 0, 1], type: 'mat3x3<f32>' },
            projectionMatrix: { value: [1, 0, 0, 0, 1, 0, 0, 0, 1], type: 'mat3x3<f32>' },
          },
        },
      });

      // 3. Initialize Pools with Pre-allocation
      // Pool sizes calibrated for typical gameplay scenarios
      const FOOD_POOL_SIZE = 200;
      const PROJECTILE_POOL_SIZE = 50;
      const UNIT_POOL_SIZE = 32; // Player + Bots

      foodPoolRef.current = new FixedRenderPool(FOOD_POOL_SIZE, () => {
        const g = new Graphics();
        g.circle(0, 0, 10);
        g.fill(0xffffff);
        foodLayer.addChild(g);
        return g;
      });

      projectilePoolRef.current = new FixedRenderPool(PROJECTILE_POOL_SIZE, () => {
        const g = new Graphics();
        g.circle(0, 0, 5);
        g.fill(0xff0000);
        vfxLayer.addChild(g);
        return g;
      });

      // EIDOLON-V FIX: Use Graphics-based rendering for units (shader matrices broken in Pixi 8)
      unitPoolRef.current = new FixedRenderPool(UNIT_POOL_SIZE, () => {
        const g = new Graphics();
        // Draw base jelly circle - will be redrawn each frame with correct size/color
        g.circle(0, 0, 1);
        g.fill(0xffffff);
        unitLayer.addChild(g);
        return g;
      }) as any; // Cast to match the ref type since we changed from Mesh to Graphics

      // 4. Draw Static Elements (Map Border + Ring Zones)
      const border = new Graphics();

      // EIDOLON-V: Draw Ring Zones (R1 outer to R3 inner)
      // Ring 1 (Outer Safe Zone) - Gray
      border.arc(0, 0, RING_RADII.R1, 0, Math.PI * 2);
      border.stroke({ width: 3, color: 0x475569, alpha: 0.6 });

      // Ring 2 (Mid Zone) - Blue
      border.arc(0, 0, RING_RADII.R2, 0, Math.PI * 2);
      border.stroke({ width: 4, color: 0x3b82f6, alpha: 0.7 });

      // Ring 3 (Danger Zone) - Red
      border.arc(0, 0, RING_RADII.R3, 0, Math.PI * 2);
      border.stroke({ width: 5, color: 0xef4444, alpha: 0.8 });

      // Center Zone
      border.arc(0, 0, RING_RADII.CENTER, 0, Math.PI * 2);
      border.fill({ color: 0xfbbf24, alpha: 0.15 });
      border.stroke({ width: 2, color: 0xfbbf24, alpha: 0.6 });

      // Outer Map Border
      border.arc(0, 0, MAP_RADIUS, 0, Math.PI * 2);
      border.stroke({ width: 20, color: 0x444444, alpha: 0.5 });
      world.addChild(border);

      // 5. Render Loop
      app.ticker.add(ticker => {
        if (!gameStateRef.current) return;
        const state = gameStateRef.current;
        const dt = ticker.deltaTime / 60; // Approximate

        // A. Camera Logic
        const camX = state.camera.x;
        const camY = state.camera.y;

        world.position.set(window.innerWidth / 2 - camX, window.innerHeight / 2 - camY);

        // B. Dynamic Grid (Parallax/Culling)
        const g = gridLayerRef.current!;
        g.clear();
        g.strokeStyle = { width: 2, color: 0x222222, alpha: 0.3 };

        const gridSize = 200;
        // Cull grid to viewport
        const startX = Math.floor((camX - window.innerWidth / 2) / gridSize) * gridSize;
        const endX = startX + window.innerWidth + gridSize * 2;
        const startY = Math.floor((camY - window.innerHeight / 2) / gridSize) * gridSize;
        const endY = startY + window.innerHeight + gridSize * 2;

        g.beginPath();
        for (let x = startX; x <= endX; x += gridSize) {
          g.moveTo(x, startY);
          g.lineTo(x, endY);
        }
        for (let y = startY; y <= endY; y += gridSize) {
          g.moveTo(startX, y);
          g.lineTo(endX, y);
        }
        g.stroke();

        // C. Reset Pools - Cursor pattern eliminates cleanup loops
        foodPoolRef.current!.reset();
        unitPoolRef.current!.reset();
        projectilePoolRef.current!.reset();

        const tData = TransformStore.data;
        const pData = PhysicsStore.data;
        const idToIndex = getPhysicsWorld().idToIndex;
        const interpAlpha = alphaRef.current;

        // D. Render Food
        // EIDOLON-V OPTIMIZATION: Viewport Culling
        const viewX = camX - window.innerWidth / 2;
        const viewY = camY - window.innerHeight / 2;
        const viewW = window.innerWidth;
        const viewH = window.innerHeight;
        const CULL_MARGIN = 100;

        for (const f of state.food) {
          if (f.isDead) continue;

          // Pre-check culling (using raw pos or approximated)
          // Simple AABB check against viewport
          if (
            f.position.x < viewX - CULL_MARGIN ||
            f.position.x > viewX + viewW + CULL_MARGIN ||
            f.position.y < viewY - CULL_MARGIN ||
            f.position.y > viewY + viewH + CULL_MARGIN
          ) {
            continue;
          }

          const gfx = foodPoolRef.current!.get();
          const idx = f.physicsIndex ?? idToIndex.get(f.id);
          let fx = f.position.x;
          let fy = f.position.y;
          let fr = f.radius;
          if (idx !== undefined) {
            const base = idx * STRIDE;
            const currX = tData[base + X_OFFSET];
            const currY = tData[base + Y_OFFSET];
            const prevX = tData[base + PREV_X_OFFSET];
            const prevY = tData[base + PREV_Y_OFFSET];
            fx = prevX + (currX - prevX) * interpAlpha;
            fy = prevY + (currY - prevY) * interpAlpha;
            fr = pData[base + RADIUS_OFFSET];
          }
          gfx.position.set(fx, fy);
          gfx.clear();

          // Style by kind
          if (f.kind === 'catalyst') {
            gfx.regularPoly(0, 0, fr, 6);
            gfx.fill(0xd946ef);
          } else if (f.kind === 'shield') {
            gfx.rect(-fr, -fr, fr * 2, fr * 2);
            gfx.fill(0xfbbf24);
          } else {
            gfx.circle(0, 0, fr);
            gfx.fill(f.color);
          }
        }

        // E. Render Units (Player + Bots)
        const units = [state.player, ...state.bots];
        // EIDOLON-V DEBUG: Log unit rendering info (REMOVE AFTER DEBUG)
        if (state.gameTime < 1) {
          console.log('[DEBUG] Rendering units:', {
            playerExists: !!state.player,
            playerDead: state.player?.isDead,
            playerPos: state.player?.position,
            playerPhysicsIdx: state.player?.physicsIndex,
            botsCount: state.bots?.length,
            botsDeadCount: state.bots?.filter(b => b.isDead).length,
          });
        }
        for (const u of units) {
          if (!u || u.isDead) continue;

          // Culling for units
          if (
            u.position.x < viewX - CULL_MARGIN ||
            u.position.x > viewX + viewW + CULL_MARGIN ||
            u.position.y < viewY - CULL_MARGIN ||
            u.position.y > viewY + viewH + CULL_MARGIN
          ) {
            continue;
          }

          const idx = u.physicsIndex ?? idToIndex.get(u.id);
          let ux = u.position.x;
          let uy = u.position.y;
          let ur = u.radius;
          if (idx !== undefined) {
            const base = idx * STRIDE;
            const currX = tData[base + X_OFFSET];
            const currY = tData[base + Y_OFFSET];
            const prevX = tData[base + PREV_X_OFFSET];
            const prevY = tData[base + PREV_Y_OFFSET];
            ux = prevX + (currX - prevX) * interpAlpha;
            uy = prevY + (currY - prevY) * interpAlpha;
            ur = pData[base + RADIUS_OFFSET];
          }

          // EIDOLON-V FIX: Use Graphics API to draw jelly (shader matrices fixed later)
          const gfx = unitPoolRef.current!.get() as unknown as Graphics;
          gfx.position.set(ux, uy);
          gfx.clear();

          // Extract color from integer
          const color = u.color as number;

          // Draw jelly body with gradient effect
          const energy = u.currentHealth / u.maxHealth;

          // Outer glow
          gfx.circle(0, 0, ur * 1.1);
          gfx.fill({ color, alpha: 0.3 });

          // Main body
          gfx.circle(0, 0, ur);
          gfx.fill({ color, alpha: 0.9 });

          // Inner core (brighter)
          const coreRadius = ur * 0.4 * energy;
          if (coreRadius > 2) {
            gfx.circle(0, 0, coreRadius);
            gfx.fill({ color: 0xffffff, alpha: 0.4 });
          }

          // EIDOLON-V DEBUG (REMOVE AFTER DEBUG)
          if (state.gameTime < 1 && u === state.player) {
            console.log('[DEBUG] Player render (Graphics):', { ux, uy, ur, color: color.toString(16) });
          }
        }

        // F. Render Projectiles
        for (const p of state.projectiles) {
          if (p.isDead) continue;
          const gfx = projectilePoolRef.current!.get();
          const idx = p.physicsIndex ?? idToIndex.get(p.id);
          let px = p.position.x;
          let py = p.position.y;
          let pr = p.radius;
          if (idx !== undefined) {
            const base = idx * STRIDE;
            const currX = tData[base + X_OFFSET];
            const currY = tData[base + Y_OFFSET];
            const prevX = tData[base + PREV_X_OFFSET];
            const prevY = tData[base + PREV_Y_OFFSET];
            px = prevX + (currX - prevX) * interpAlpha;
            py = prevY + (currY - prevY) * interpAlpha;
            pr = pData[base + RADIUS_OFFSET];
          }
          gfx.position.set(px, py);
          gfx.clear();
          gfx.circle(0, 0, pr);
          gfx.fill(0xff0000);
        }
      });
    };

    init();

    return () => {
      appRef.current?.destroy(true, { children: true });
      appRef.current = null;
    };
  }, []);

  return <div ref={containerRef} className="absolute inset-0 bg-black" />;
};

export default PixiGameCanvas;
