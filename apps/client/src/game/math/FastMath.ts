/**
 * @cjr/client - FastMath
 * Re-exports from @cjr/engine (Single Source of Truth)
 * 
 * EIDOLON-V CONSOLIDATION: All math utilities now live in engine
 */

// ============================================
// RE-EXPORT FROM ENGINE (Single Source of Truth)
// ============================================

export {
  // Core utilities
  fastMath,
  fastSqrt,
  fastInvSqrt,
  clamp,
  lerp,
  lerpVector,
  randomRange,
  randomInt,
  distance,
  distanceSquared,
  distanceFromOriginSquared,
  distanceSquared3D,
  fastLength,
  fastNormalize,
  normalize,
  dot,
  angleBetween,
  rotateVector,
  reflectVector,
  clampVector,

  // Classes
  FastMath,
  CollisionSystem,
  SpatialOptimizer,
  PRNG,
  MathPerformanceMonitor,

  // Types
  type Vector2,
  type Vector3,
} from '@cjr/engine';

// ============================================
// LEGACY ALIASES (Backward compatibility exports)
// ============================================
import {
  CollisionSystem as _CollisionSystem,
  SpatialOptimizer as _SpatialOptimizer,
  MathPerformanceMonitor as _MathPerformanceMonitor,
} from '@cjr/engine';

export const collisionSystem = _CollisionSystem;
export const spatialOptimizer = _SpatialOptimizer;
export const mathPerformanceMonitor = _MathPerformanceMonitor;

// ============================================
// CLIENT-SPECIFIC POSITION HELPERS
// ============================================
import { CENTER_RADIUS, MAP_RADIUS, RING_RADII } from '@cjr/shared';
import { PRNG as EnginePRNG, type Vector2 as Vec2 } from '@cjr/engine';

/** Random position within map bounds (uses seeded PRNG) */
export const randomPos = (): Vec2 => {
  const angle = EnginePRNG.next() * Math.PI * 2;
  const r = Math.sqrt(EnginePRNG.next()) * (MAP_RADIUS - 200) + 100;
  return {
    x: Math.cos(angle) * r,
    y: Math.sin(angle) * r,
  };
};

/** Random position within a specific ring */
export const randomPosInRing = (ring: 1 | 2 | 3): Vec2 => {
  let minR = 0;
  let maxR = 0;
  if (ring === 1) {
    minR = RING_RADII.R2;
    maxR = RING_RADII.R1;
  } else if (ring === 2) {
    minR = RING_RADII.R3;
    maxR = RING_RADII.R2;
  } else {
    minR = RING_RADII.CENTER;
    maxR = RING_RADII.R3;
  }

  const angle = EnginePRNG.next() * Math.PI * 2;
  const r = Math.sqrt(EnginePRNG.range(minR * minR, maxR * maxR));
  return {
    x: Math.cos(angle) * r,
    y: Math.sin(angle) * r,
  };
};

/** Random position within center zone */
export const randomPosInCenter = (): Vec2 => {
  const angle = EnginePRNG.next() * Math.PI * 2;
  const r = Math.sqrt(EnginePRNG.next()) * (CENTER_RADIUS * 0.9);
  return {
    x: Math.cos(angle) * r,
    y: Math.sin(angle) * r,
  };
};
