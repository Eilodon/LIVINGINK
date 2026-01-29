// EIDOLON-V FORGE: FastMath - Native JIT Optimization
// Removed Legacy Lookup Tables (Step 1.1)

export interface Vector2 {
  x: number;
  y: number;
}

export interface Vector3 {
  x: number;
  y: number;
  z: number;
}

export class FastMath {
  // Native Math.sqrt is now faster due to JIT intrinsics
  static fastSqrt(value: number): number {
    return Math.sqrt(value);
  }



  // EIDOLON-V FIX: Squared distance (NO SQRT)
  static distanceSquared(a: Vector2, b: Vector2): number {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    return dx * dx + dy * dy;
  }

  // EIDOLON-V FIX: Squared distance from origin
  static distanceFromOriginSquared(v: Vector2): number {
    return v.x * v.x + v.y * v.y;
  }

  // EIDOLON-V FIX: Squared distance 3D
  static distanceSquared3D(a: Vector3, b: Vector3): number {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    const dz = a.z - b.z;
    return dx * dx + dy * dy + dz * dz;
  }

  // EIDOLON-V FIX: Fast length calculation (only when absolutely necessary)
  static fastLength(v: Vector2): number {
    return this.fastSqrt(v.x * v.x + v.y * v.y);
  }

  // EIDOLON-V FIX: Fast normalize
  static fastNormalize(v: Vector2): Vector2 {
    const lenSq = v.x * v.x + v.y * v.y;
    if (lenSq === 0) return { x: 0, y: 0 };

    const invLen = 1 / this.fastSqrt(lenSq);
    return {
      x: v.x * invLen,
      y: v.y * invLen
    };
  }

  // EIDOLON-V FIX: Fast lerp
  static lerp(a: number, b: number, t: number): number {
    return a + (b - a) * t;
  }

  // EIDOLON-V FIX: Fast lerp vector
  static lerpVector(a: Vector2, b: Vector2, t: number): Vector2 {
    return {
      x: this.lerp(a.x, b.x, t),
      y: this.lerp(a.y, b.y, t)
    };
  }

  // EIDOLON-V FIX: Fast clamp
  static clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
  }

  // EIDOLON-V FIX: Fast clamp vector
  static clampVector(v: Vector2, minX: number, maxX: number, minY: number, maxY: number): Vector2 {
    return {
      x: this.clamp(v.x, minX, maxX),
      y: this.clamp(v.y, minY, maxY)
    };
  }

  // EIDOLON-V FIX: Fast angle between vectors
  static angleBetween(a: Vector2, b: Vector2): number {
    const dot = a.x * b.x + a.y * b.y;
    const det = a.x * b.y - a.y * b.x;
    return Math.atan2(det, dot);
  }

  // EIDOLON-V FIX: Fast rotate vector
  static rotateVector(v: Vector2, angle: number): Vector2 {
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    return {
      x: v.x * cos - v.y * sin,
      y: v.x * sin + v.y * cos
    };
  }

  // EIDOLON-V FIX: Fast reflect vector
  static reflectVector(v: Vector2, normal: Vector2): Vector2 {
    const dot = v.x * normal.x + v.y * normal.y;
    return {
      x: v.x - 2 * dot * normal.x,
      y: v.y - 2 * dot * normal.y
    };
  }
}

// EIDOLON-V FORGE: Collision detection using squared distances
export class CollisionSystem {
  // EIDOLON-V FIX: Circle-circle collision (squared distance)
  static circleCollision(
    pos1: Vector2,
    radius1: number,
    pos2: Vector2,
    radius2: number
  ): boolean {
    const dx = pos1.x - pos2.x;
    const dy = pos1.y - pos2.y;
    const radiusSum = radius1 + radius2;
    return dx * dx + dy * dy <= radiusSum * radiusSum;
  }

  // EIDOLON-V FIX: Point-circle collision (squared distance)
  static pointCircleCollision(
    point: Vector2,
    circlePos: Vector2,
    radius: number
  ): boolean {
    const dx = point.x - circlePos.x;
    const dy = point.y - circlePos.y;
    return dx * dx + dy * dy <= radius * radius;
  }

  // EIDOLON-V FIX: Point-rectangle collision
  static pointRectCollision(
    point: Vector2,
    rectPos: Vector2,
    rectSize: Vector2
  ): boolean {
    return point.x >= rectPos.x &&
      point.x <= rectPos.x + rectSize.x &&
      point.y >= rectPos.y &&
      point.y <= rectPos.y + rectSize.y;
  }

  // EIDOLON-V FIX: Circle-rectangle collision
  static circleRectCollision(
    circlePos: Vector2,
    radius: number,
    rectPos: Vector2,
    rectSize: Vector2
  ): boolean {
    const closestX = FastMath.clamp(circlePos.x, rectPos.x, rectPos.x + rectSize.x);
    const closestY = FastMath.clamp(circlePos.y, rectPos.y, rectPos.y + rectSize.y);

    const dx = circlePos.x - closestX;
    const dy = circlePos.y - closestY;

    return dx * dx + dy * dy <= radius * radius;
  }

  // EIDOLON-V FIX: Line-circle collision
  static lineCircleCollision(
    lineStart: Vector2,
    lineEnd: Vector2,
    circlePos: Vector2,
    radius: number
  ): boolean {
    const lineVec = { x: lineEnd.x - lineStart.x, y: lineEnd.y - lineStart.y };
    const toCircle = { x: circlePos.x - lineStart.x, y: circlePos.y - lineStart.y };

    const lineLenSq = lineVec.x * lineVec.x + lineVec.y * lineVec.y;
    if (lineLenSq === 0) return this.pointCircleCollision(lineStart, circlePos, radius);

    const t = FastMath.clamp(
      (toCircle.x * lineVec.x + toCircle.y * lineVec.y) / lineLenSq,
      0, 1
    );

    const closestPoint = {
      x: lineStart.x + lineVec.x * t,
      y: lineStart.y + lineVec.y * t
    };

    return this.pointCircleCollision(closestPoint, circlePos, radius);
  }
}

// EIDOLON-V FORGE: Spatial optimization using squared distances
export class SpatialOptimizer {
  // EIDOLON-V FIX: Fast circle intersection test
  static circlesIntersect(
    pos1: Vector2,
    radius1: number,
    pos2: Vector2,
    radius2: number
  ): boolean {
    return CollisionSystem.circleCollision(pos1, radius1, pos2, radius2);
  }

  // EIDOLON-V FIX: Fast point in circle test
  static pointInCircle(
    point: Vector2,
    circlePos: Vector2,
    radius: number
  ): boolean {
    return CollisionSystem.pointCircleCollision(point, circlePos, radius);
  }

  // EIDOLON-V FIX: Fast distance comparison
  static isWithinDistance(
    pos1: Vector2,
    pos2: Vector2,
    maxDistance: number
  ): boolean {
    const maxDistSq = maxDistance * maxDistance;
    const distSq = FastMath.distanceSquared(pos1, pos2);
    return distSq <= maxDistSq;
  }

  // EIDOLON-V FIX: Fast closest point on circle
  static closestPointOnCircle(
    point: Vector2,
    circlePos: Vector2,
    radius: number
  ): Vector2 {
    const dx = point.x - circlePos.x;
    const dy = point.y - circlePos.y;
    const distSq = dx * dx + dy * dy;

    if (distSq === 0) return circlePos;

    const dist = FastMath.fastSqrt(distSq);
    const scale = radius / dist;

    return {
      x: circlePos.x + dx * scale,
      y: circlePos.y + dy * scale
    };
  }

  // EIDOLON-V FIX: Fast circle containment test
  static circleContainsCircle(
    outerPos: Vector2,
    outerRadius: number,
    innerPos: Vector2,
    innerRadius: number
  ): boolean {
    const dx = outerPos.x - innerPos.x;
    const dy = outerPos.y - innerPos.y;
    const radiusDiff = outerRadius - innerRadius;
    return dx * dx + dy * dy <= radiusDiff * radiusDiff;
  }
}

// EIDOLON-V FORGE: Performance monitoring
export class MathPerformanceMonitor {
  private static sqrtOperations = 0;
  private static distanceOperations = 0;
  private static collisionOperations = 0;

  static recordSqrtOperation(): void {
    this.sqrtOperations++;
  }

  static recordDistanceOperation(): void {
    this.distanceOperations++;
  }

  static recordCollisionOperation(): void {
    this.collisionOperations++;
  }

  static getStats() {
    return {
      sqrtOperations: this.sqrtOperations,
      distanceOperations: this.distanceOperations,
      collisionOperations: this.collisionOperations,
      totalOperations: this.sqrtOperations + this.distanceOperations + this.collisionOperations
    };
  }

  static reset(): void {
    this.sqrtOperations = 0;
    this.distanceOperations = 0;
    this.collisionOperations = 0;
  }
}

// EIDOLON-V FORGE: Export optimized math functions
export const fastMath = FastMath;
export const collisionSystem = CollisionSystem;
export const spatialOptimizer = SpatialOptimizer;
export const mathPerformanceMonitor = MathPerformanceMonitor;

// ============================================
// LEGACY BRIDGE: Standalone functions (migrated from engine/math.ts)
// ============================================
import { CENTER_RADIUS, MAP_RADIUS, RING_RADII } from '../../constants';

/** Euclidean distance between two points */
export const distance = (v1: Vector2, v2: Vector2): number => {
  const dx = v2.x - v1.x;
  const dy = v2.y - v1.y;
  return Math.sqrt(dx * dx + dy * dy);
};

/** Squared distance (faster, use for comparisons) */
export const distSq = (v1: Vector2, v2: Vector2): number => {
  const dx = v2.x - v1.x;
  const dy = v2.y - v1.y;
  return dx * dx + dy * dy;
};

/** Random number in range [min, max) */
export const randomRange = (min: number, max: number): number =>
  Math.random() * (max - min) + min;

/** Random position within map bounds (circular map centered at origin) */
export const randomPos = (): Vector2 => {
  const angle = Math.random() * Math.PI * 2;
  const r = Math.sqrt(Math.random()) * (MAP_RADIUS - 200) + 100;
  return {
    x: Math.cos(angle) * r,
    y: Math.sin(angle) * r,
  };
};

/** Random position within a specific ring */
export const randomPosInRing = (ring: 1 | 2 | 3): Vector2 => {
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

  const angle = Math.random() * Math.PI * 2;
  const r = Math.sqrt(randomRange(minR * minR, maxR * maxR));
  return {
    x: Math.cos(angle) * r,
    y: Math.sin(angle) * r,
  };
};

/** Random position within center zone */
export const randomPosInCenter = (): Vector2 => {
  const angle = Math.random() * Math.PI * 2;
  const r = Math.sqrt(Math.random()) * (CENTER_RADIUS * 0.9);
  return {
    x: Math.cos(angle) * r,
    y: Math.sin(angle) * r,
  };
};

/** Normalize a vector to unit length */
export const normalize = (v: Vector2): Vector2 => {
  const len = Math.sqrt(v.x * v.x + v.y * v.y);
  return len === 0 ? { x: 0, y: 0 } : { x: v.x / len, y: v.y / len };
};
