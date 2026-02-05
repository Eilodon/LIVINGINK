/**
 * DOD Entity Renderer (Fix #4: Eliminate Fragmented State)
 * =============================================================================
 * Renders entities DIRECTLY from DOD Stores - NO JS Object intermediary
 * This eliminates the "double representation" problem where data exists in:
 * 1. DOD Stores (TransformStore, PhysicsStore, StateStore, etc.) - SSOT
 * 2. JS Objects (Player, Bot, Food entities) - copies that need syncing
 *
 * This renderer reads ALL render-critical data directly from DOD stores,
 * eliminating sync overhead and desync risk.
 * =============================================================================
 */

import {
  TransformStore,
  PhysicsStore,
  StateStore,
  StatsStore,
  ConfigStore,
  EntityFlags,
  CJRFoodFlags,
} from '@cjr/engine';
import { entityManager } from './dod/EntityManager';
import { getInterpolatedPositionByIndex, type RenderPoint } from './RenderBridge';

// Render data structure - populated directly from DOD stores
export interface DODRenderData {
  x: number;
  y: number;
  radius: number;
  color: number;
  flags: number;
  health: number;
  maxHealth: number;
  kind: 'player' | 'bot' | 'food' | 'projectile';
  // Food-specific
  foodKind?: 'shield' | 'catalyst' | 'solvent' | 'neutral' | 'pigment';
  // Player/Bot specific
  name?: string;
  shape?: number;
}

// Reusable output object for zero-allocation reads
const _renderData: DODRenderData = {
  x: 0,
  y: 0,
  radius: 0,
  color: 0,
  flags: 0,
  health: 0,
  maxHealth: 0,
  kind: 'food',
};

const _renderPoint: RenderPoint = { x: 0, y: 0 };

// Color palette for different entity types (integer colors)
const COLORS = {
  PLAYER: 0xffffff,
  BOT: 0xffaa00,
  FOOD_PIGMENT: 0xffffff,
  FOOD_SHIELD: 0xfbbf24,
  FOOD_CATALYST: 0xd946ef,
  FOOD_SOLVENT: 0xa5b4fc,
  FOOD_NEUTRAL: 0x9ca3af,
  PROJECTILE: 0xff0000,
};

/**
 * Get render data directly from DOD stores for an entity
 * NO JS object lookup - reads straight from typed arrays
 */
export const getRenderDataByIndex = (
  entityIdx: number,
  alpha: number,
  out: DODRenderData = _renderData
): DODRenderData | null => {
  // Check if entity is active
  const flags = StateStore.flags[entityIdx];
  if (!(flags & EntityFlags.ACTIVE)) return null;

  // Get interpolated position from TransformStore
  const pos = getInterpolatedPositionByIndex(entityIdx, alpha, _renderPoint);

  // Determine entity type from flags
  let kind: DODRenderData['kind'] = 'food';
  let foodKind: DODRenderData['foodKind'] = 'pigment';
  let color = COLORS.FOOD_PIGMENT;

  if (flags & EntityFlags.PLAYER) {
    kind = 'player';
    color = COLORS.PLAYER;
  } else if (flags & EntityFlags.BOT) {
    kind = 'bot';
    color = COLORS.BOT;
  } else if (flags & EntityFlags.PROJECTILE) {
    kind = 'projectile';
    color = COLORS.PROJECTILE;
  } else if (flags & EntityFlags.FOOD) {
    kind = 'food';
    // Determine food type from flags
    if (flags & CJRFoodFlags.FOOD_SHIELD) {
      foodKind = 'shield';
      color = COLORS.FOOD_SHIELD;
    } else if (flags & CJRFoodFlags.FOOD_CATALYST) {
      foodKind = 'catalyst';
      color = COLORS.FOOD_CATALYST;
    } else if (flags & CJRFoodFlags.FOOD_SOLVENT) {
      foodKind = 'solvent';
      color = COLORS.FOOD_SOLVENT;
    } else if (flags & CJRFoodFlags.FOOD_NEUTRAL) {
      foodKind = 'neutral';
      color = COLORS.FOOD_NEUTRAL;
    }
  }

  // Get radius from PhysicsStore (stride 8, radius at offset 4)
  const pBase = entityIdx * 8;
  const radius = PhysicsStore.data[pBase + 4];

  // Get health from StatsStore (stride 8, currentHealth at offset 0, maxHealth at offset 1)
  const sBase = entityIdx * 8;
  const health = StatsStore.data[sBase];
  const maxHealth = StatsStore.data[sBase + 1];

  // Populate output
  out.x = pos.x;
  out.y = pos.y;
  out.radius = radius;
  out.color = color;
  out.flags = flags;
  out.health = health;
  out.maxHealth = maxHealth;
  out.kind = kind;
  out.foodKind = foodKind;

  return out;
};

/**
 * Batch render data collection - zero allocation iteration
 * Returns array of render data for all active entities
 */
export const collectRenderDataBatch = (
  alpha: number,
  output: DODRenderData[] = []
): DODRenderData[] => {
  output.length = 0; // Clear array without reallocating

  const maxEntities = entityManager.getMaxEntities();

  for (let i = 0; i < maxEntities; i++) {
    const flags = StateStore.flags[i];
    if (flags & EntityFlags.ACTIVE) {
      const data = getRenderDataByIndex(i, alpha);
      if (data) {
        output.push({ ...data }); // Copy to new object for batch
      }
    }
  }

  return output;
};

/**
 * Render entities directly from DOD stores to Canvas2D context
 * This eliminates the need for JS entity objects during rendering
 */
export const renderEntitiesFromDOD = (
  ctx: CanvasRenderingContext2D,
  alpha: number,
  cameraX: number,
  cameraY: number,
  width: number,
  height: number
): void => {
  const maxEntities = entityManager.getMaxEntities();

  for (let i = 0; i < maxEntities; i++) {
    const flags = StateStore.flags[i];
    if (!(flags & EntityFlags.ACTIVE)) continue;

    const data = getRenderDataByIndex(i, alpha);
    if (!data) continue;

    // Culling: skip entities outside viewport
    const screenX = data.x - cameraX + width / 2;
    const screenY = data.y - cameraY + height / 2;
    const margin = data.radius * 2;

    if (
      screenX < -margin ||
      screenX > width + margin ||
      screenY < -margin ||
      screenY > height + margin
    ) {
      continue; // Entity culled
    }

    // Render based on type
    ctx.translate(screenX, screenY);

    switch (data.kind) {
      case 'player':
      case 'bot':
        // Draw circle body
        ctx.fillStyle = `#${data.color.toString(16).padStart(6, '0')}`;
        ctx.beginPath();
        ctx.arc(0, 0, data.radius, 0, Math.PI * 2);
        ctx.fill();

        // Draw border
        ctx.lineWidth = 2;
        ctx.strokeStyle = '#fff';
        ctx.stroke();
        break;

      case 'food':
        drawFood(ctx, data);
        break;

      case 'projectile':
        ctx.fillStyle = '#ff0000';
        ctx.beginPath();
        ctx.arc(0, 0, data.radius, 0, Math.PI * 2);
        ctx.fill();
        break;
    }

    ctx.translate(-screenX, -screenY);
  }
};

/**
 * Draw food based on its kind - directly from DOD data
 */
const drawFood = (ctx: CanvasRenderingContext2D, data: DODRenderData): void => {
  switch (data.foodKind) {
    case 'shield':
      ctx.fillStyle = '#fbbf24';
      ctx.beginPath();
      ctx.moveTo(0, -data.radius);
      ctx.lineTo(data.radius, data.radius);
      ctx.lineTo(-data.radius, data.radius);
      ctx.closePath();
      ctx.fill();
      break;

    case 'catalyst':
      ctx.fillStyle = '#d946ef';
      drawPolygon(ctx, 0, 0, data.radius, 6);
      break;

    case 'solvent':
      ctx.fillStyle = '#a5b4fc';
      ctx.fillRect(-data.radius * 0.7, -data.radius * 0.7, data.radius * 1.4, data.radius * 1.4);
      break;

    case 'neutral':
      ctx.fillStyle = '#9ca3af';
      ctx.beginPath();
      ctx.arc(0, 0, data.radius * 0.9, 0, Math.PI * 2);
      ctx.fill();
      break;

    default: // pigment
      ctx.fillStyle = `#${data.color.toString(16).padStart(6, '0')}`;
      ctx.beginPath();
      ctx.arc(0, 0, data.radius, 0, Math.PI * 2);
      ctx.fill();
      break;
  }
};

/**
 * Draw polygon helper
 */
const drawPolygon = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  sides: number
) => {
  ctx.beginPath();
  for (let i = 0; i < sides; i++) {
    const angle = (i / sides) * Math.PI * 2 - Math.PI / 2;
    const px = x + Math.cos(angle) * radius;
    const py = y + Math.sin(angle) * radius;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fill();
};

// ============================================================================
// Entity Culling System (Fix #4 Performance Optimization)
// ============================================================================

export interface CullResult {
  visibleIndices: number[];
  culledCount: number;
}

/**
 * Cull entities outside viewport before rendering
 * Returns list of visible entity indices for batch rendering
 */
export const cullEntities = (
  cameraX: number,
  cameraY: number,
  width: number,
  height: number,
  padding: number = 100
): CullResult => {
  const visibleIndices: number[] = [];
  let culledCount = 0;

  const maxEntities = entityManager.getMaxEntities();
  const halfWidth = width / 2 + padding;
  const halfHeight = height / 2 + padding;

  for (let i = 0; i < maxEntities; i++) {
    const flags = StateStore.flags[i];
    if (!(flags & EntityFlags.ACTIVE)) continue;

    // Quick position check from TransformStore
    const tBase = i * 8;
    const x = TransformStore.data[tBase];
    const y = TransformStore.data[tBase + 1];

    // Get radius for margin
    const pBase = i * 8;
    const radius = PhysicsStore.data[pBase + 4];

    // Check if in viewport
    const dx = x - cameraX;
    const dy = y - cameraY;

    if (
      dx < -halfWidth - radius ||
      dx > halfWidth + radius ||
      dy < -halfHeight - radius ||
      dy > halfHeight + radius
    ) {
      culledCount++;
      continue;
    }

    visibleIndices.push(i);
  }

  return { visibleIndices, culledCount };
};

export { DODRenderData };
