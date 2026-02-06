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
import { TransformStore, PhysicsStore, defaultWorld, EntityFlags } from '@cjr/engine';
import { visualStore } from '../game/engine/systems/VisualSystem';

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

        const tData = defaultWorld.transform;
        const pData = defaultWorld.physics;
        const idToIndex = getPhysicsWorld().idToIndex;
        const interpAlpha = alphaRef.current;

        // D. Render Food
        // EIDOLON-V OPTIMIZATION: DOD Sparse Set Iteration + Viewport Culling
        const viewX = camX - window.innerWidth / 2;
        const viewY = camY - window.innerHeight / 2;
        const viewW = window.innerWidth;
        const viewH = window.innerHeight;
        const CULL_MARGIN = 100;

        // EIDOLON-V: DOD Render Path using Sparse Set
        const dodWorld = defaultWorld;
        const activeEntities = dodWorld.activeEntities;
        const activeCount = dodWorld.activeCount;
        const stateFlags = dodWorld.stateFlags;
        const transformData = dodWorld.transform;
        const physicsData = dodWorld.physics;
        const TRANSFORM_STRIDE = 8; // x,y,rot,scale,prevX,prevY,prevRot,pad
        const PHYSICS_STRIDE = 8;   // vx,vy,friction,mass,radius,restitution,friction,pad

        // Render FOOD entities from Sparse Set
        for (let i = 0; i < activeCount; i++) {
          const id = activeEntities[i];
          const flags = stateFlags[id];

          // Skip non-food entities
          if ((flags & EntityFlags.FOOD) === 0) continue;

          // Get transform data
          const tBase = id * TRANSFORM_STRIDE;
          const currX = transformData[tBase];     // x
          const currY = transformData[tBase + 1]; // y
          const prevX = transformData[tBase + 4]; // prevX
          const prevY = transformData[tBase + 5]; // prevY

          // Interpolate position
          const fx = prevX + (currX - prevX) * interpAlpha;
          const fy = prevY + (currY - prevY) * interpAlpha;

          // Viewport culling
          if (fx < viewX - CULL_MARGIN || fx > viewX + viewW + CULL_MARGIN ||
            fy < viewY - CULL_MARGIN || fy > viewY + viewH + CULL_MARGIN) {
            continue;
          }

          // Get radius from physics
          const pBase = id * PHYSICS_STRIDE;
          const fr = physicsData[pBase + 4]; // radius

          // Get visual data
          const color = visualStore.color[id];
          const shape = visualStore.shape[id];

          const gfx = foodPoolRef.current!.get();
          gfx.position.set(fx, fy);
          gfx.clear();

          // Render based on shape (hex=catalyst, square=shield, circle=default)
          if (shape === 3) { // HEX = catalyst
            gfx.regularPoly(0, 0, fr, 6);
            gfx.fill(0xd946ef);
          } else if (shape === 1) { // SQUARE = shield
            gfx.rect(-fr, -fr, fr * 2, fr * 2);
            gfx.fill(0xfbbf24);
          } else { // CIRCLE = default pigment
            gfx.circle(0, 0, fr);
            gfx.fill(color);
          }
        }

        // E. Render Units (Player + Bots - DOD)
        for (let i = 0; i < activeCount; i++) {
          const id = activeEntities[i];
          const flags = stateFlags[id];

          if ((flags & (EntityFlags.PLAYER | EntityFlags.BOT)) === 0) continue;

          // Get transform
          const tBase = id * TRANSFORM_STRIDE;
          const currX = transformData[tBase];
          const currY = transformData[tBase + 1];
          const prevX = transformData[tBase + 4];
          const prevY = transformData[tBase + 5];

          const ux = prevX + (currX - prevX) * interpAlpha;
          const uy = prevY + (currY - prevY) * interpAlpha;

          // Culling
          if (ux < viewX - CULL_MARGIN || ux > viewX + viewW + CULL_MARGIN ||
            uy < viewY - CULL_MARGIN || uy > viewY + viewH + CULL_MARGIN) {
            continue;
          }

          const pBase = id * PHYSICS_STRIDE;
          const ur = physicsData[pBase + 4];
          const color = visualStore.color[id];

          // Use Graphics API to draw jelly
          const gfx = unitPoolRef.current!.get() as unknown as Graphics;
          gfx.position.set(ux, uy);
          gfx.clear();

          // Energy/Health calc from Stats if needed, for simplicity we use 100% effect or fallback
          // (Optimization: Add StatsStore buffer access if precise energy needed)
          const energy = 1.0;

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
        }

        // F. Render Projectiles (DOD)
        for (let i = 0; i < activeCount; i++) {
          const id = activeEntities[i];
          const flags = stateFlags[id];

          if ((flags & EntityFlags.PROJECTILE) === 0) continue;

          // Get transform
          const tBase = id * TRANSFORM_STRIDE;
          const currX = transformData[tBase];
          const currY = transformData[tBase + 1];
          const prevX = transformData[tBase + 4];
          const prevY = transformData[tBase + 5];

          const px = prevX + (currX - prevX) * interpAlpha;
          const py = prevY + (currY - prevY) * interpAlpha;

          // Culling
          if (px < viewX - CULL_MARGIN || px > viewX + viewW + CULL_MARGIN ||
            py < viewY - CULL_MARGIN || py > viewY + viewH + CULL_MARGIN) {
            continue;
          }

          const pBase = id * PHYSICS_STRIDE;
          const pr = physicsData[pBase + 4];
          // const color = visualStore.color[id];

          const gfx = projectilePoolRef.current!.get();
          gfx.position.set(px, py);
          gfx.clear();

          gfx.circle(0, 0, pr);
          gfx.fill(0xffffff); // White projectiles 
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
