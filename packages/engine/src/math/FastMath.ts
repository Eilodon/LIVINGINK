/**
 * @cjr/engine - FastMath
 * Optimized math utilities with collision detection - zero dependencies
 * 
 * EIDOLON-V CONSOLIDATION: Merged from client/FastMath.ts
 */

// ============================================
// VECTOR TYPES
// ============================================

export interface Vector2 {
    x: number;
    y: number;
}

export interface Vector3 {
    x: number;
    y: number;
    z: number;
}

// ============================================
// CORE MATH UTILITIES
// ============================================

/**
 * Fast inverse square root (Quake III style)
 * Not as fast as native 1/Math.sqrt on modern engines, but included for reference
 */
export const fastInvSqrt = (x: number): number => {
    return 1 / Math.sqrt(x);
};

/**
 * Fast approximate square root using one Newton-Raphson iteration
 */
export const fastSqrt = (x: number): number => {
    if (x <= 0) return 0;
    return Math.sqrt(x);
};

/**
 * Clamp value between min and max
 */
export const clamp = (value: number, min: number, max: number): number => {
    return value < min ? min : value > max ? max : value;
};

/**
 * Linear interpolation
 */
export const lerp = (a: number, b: number, t: number): number => {
    return a + (b - a) * t;
};

/**
 * Linear interpolation for vectors
 */
export const lerpVector = (a: Vector2, b: Vector2, t: number): Vector2 => {
    return {
        x: a.x + (b.x - a.x) * t,
        y: a.y + (b.y - a.y) * t,
    };
};

/**
 * Random value in range [min, max)
 */
export const randomRange = (min: number, max: number): number => {
    return min + Math.random() * (max - min);
};

/**
 * Random integer in range [min, max]
 */
export const randomInt = (min: number, max: number): number => {
    return Math.floor(min + Math.random() * (max - min + 1));
};

/**
 * Euclidean distance between two points (uses sqrt)
 */
export const distance = (
    p1: { x: number; y: number },
    p2: { x: number; y: number }
): number => {
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    return Math.sqrt(dx * dx + dy * dy);
};

/**
 * Squared distance (avoid sqrt when only comparing)
 */
export const distanceSquared = (
    p1: { x: number; y: number },
    p2: { x: number; y: number }
): number => {
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    return dx * dx + dy * dy;
};

/**
 * Squared distance from origin
 */
export const distanceFromOriginSquared = (v: Vector2): number => {
    return v.x * v.x + v.y * v.y;
};

/**
 * Squared distance 3D
 */
export const distanceSquared3D = (a: Vector3, b: Vector3): number => {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    const dz = a.z - b.z;
    return dx * dx + dy * dy + dz * dz;
};

/**
 * Fast length calculation
 */
export const fastLength = (v: Vector2): number => {
    return fastSqrt(v.x * v.x + v.y * v.y);
};

/**
 * Normalize vector to unit length
 */
export const normalize = (
    out: { x: number; y: number },
    v: { x: number; y: number }
): void => {
    const len = Math.sqrt(v.x * v.x + v.y * v.y);
    if (len > 0.0001) {
        const invLen = 1 / len;
        out.x = v.x * invLen;
        out.y = v.y * invLen;
    } else {
        out.x = 0;
        out.y = 0;
    }
};

/**
 * Fast normalize (returns new vector)
 */
export const fastNormalize = (v: Vector2): Vector2 => {
    const lenSq = v.x * v.x + v.y * v.y;
    if (lenSq === 0) return { x: 0, y: 0 };
    const invLen = 1 / fastSqrt(lenSq);
    return { x: v.x * invLen, y: v.y * invLen };
};

/**
 * Dot product of two vectors
 */
export const dot = (
    a: { x: number; y: number },
    b: { x: number; y: number }
): number => {
    return a.x * b.x + a.y * b.y;
};

/**
 * Angle between two vectors
 */
export const angleBetween = (a: Vector2, b: Vector2): number => {
    const d = a.x * b.x + a.y * b.y;
    const det = a.x * b.y - a.y * b.x;
    return Math.atan2(det, d);
};

/**
 * Rotate vector by angle
 */
export const rotateVector = (v: Vector2, angle: number): Vector2 => {
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    return {
        x: v.x * cos - v.y * sin,
        y: v.x * sin + v.y * cos,
    };
};

/**
 * Reflect vector off a surface
 */
export const reflectVector = (v: Vector2, normal: Vector2): Vector2 => {
    const d = v.x * normal.x + v.y * normal.y;
    return {
        x: v.x - 2 * d * normal.x,
        y: v.y - 2 * d * normal.y,
    };
};

/**
 * Clamp vector components
 */
export const clampVector = (
    v: Vector2,
    minX: number,
    maxX: number,
    minY: number,
    maxY: number
): Vector2 => {
    return {
        x: clamp(v.x, minX, maxX),
        y: clamp(v.y, minY, maxY),
    };
};

// ============================================
// COLLISION SYSTEM (Squared Distance Based)
// ============================================

export class CollisionMath {
    /** Circle-circle collision (squared distance) */
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

    /** Point-circle collision (squared distance) */
    static pointCircleCollision(
        point: Vector2,
        circlePos: Vector2,
        radius: number
    ): boolean {
        const dx = point.x - circlePos.x;
        const dy = point.y - circlePos.y;
        return dx * dx + dy * dy <= radius * radius;
    }

    /** Point-rectangle collision */
    static pointRectCollision(
        point: Vector2,
        rectPos: Vector2,
        rectSize: Vector2
    ): boolean {
        return (
            point.x >= rectPos.x &&
            point.x <= rectPos.x + rectSize.x &&
            point.y >= rectPos.y &&
            point.y <= rectPos.y + rectSize.y
        );
    }

    /** Circle-rectangle collision */
    static circleRectCollision(
        circlePos: Vector2,
        radius: number,
        rectPos: Vector2,
        rectSize: Vector2
    ): boolean {
        const closestX = clamp(circlePos.x, rectPos.x, rectPos.x + rectSize.x);
        const closestY = clamp(circlePos.y, rectPos.y, rectPos.y + rectSize.y);
        const dx = circlePos.x - closestX;
        const dy = circlePos.y - closestY;
        return dx * dx + dy * dy <= radius * radius;
    }

    /** Line-circle collision */
    static lineCircleCollision(
        lineStart: Vector2,
        lineEnd: Vector2,
        circlePos: Vector2,
        radius: number
    ): boolean {
        const lineVec = { x: lineEnd.x - lineStart.x, y: lineEnd.y - lineStart.y };
        const toCircle = {
            x: circlePos.x - lineStart.x,
            y: circlePos.y - lineStart.y,
        };
        const lineLenSq = lineVec.x * lineVec.x + lineVec.y * lineVec.y;
        if (lineLenSq === 0)
            return this.pointCircleCollision(lineStart, circlePos, radius);
        const t = clamp(
            (toCircle.x * lineVec.x + toCircle.y * lineVec.y) / lineLenSq,
            0,
            1
        );
        const closestPoint = {
            x: lineStart.x + lineVec.x * t,
            y: lineStart.y + lineVec.y * t,
        };
        return this.pointCircleCollision(closestPoint, circlePos, radius);
    }
}

// ============================================
// SPATIAL OPTIMIZER
// ============================================

export class SpatialOptimizer {
    /** Fast circle intersection test */
    static circlesIntersect(
        pos1: Vector2,
        radius1: number,
        pos2: Vector2,
        radius2: number
    ): boolean {
        return CollisionMath.circleCollision(pos1, radius1, pos2, radius2);
    }

    /** Fast point in circle test */
    static pointInCircle(
        point: Vector2,
        circlePos: Vector2,
        radius: number
    ): boolean {
        return CollisionMath.pointCircleCollision(point, circlePos, radius);
    }

    /** Fast distance comparison */
    static isWithinDistance(
        pos1: Vector2,
        pos2: Vector2,
        maxDistance: number
    ): boolean {
        const maxDistSq = maxDistance * maxDistance;
        const distSq = distanceSquared(pos1, pos2);
        return distSq <= maxDistSq;
    }

    /** Fast closest point on circle */
    static closestPointOnCircle(
        point: Vector2,
        circlePos: Vector2,
        radius: number
    ): Vector2 {
        const dx = point.x - circlePos.x;
        const dy = point.y - circlePos.y;
        const distSq = dx * dx + dy * dy;
        if (distSq === 0) return circlePos;
        const dist = fastSqrt(distSq);
        const scale = radius / dist;
        return {
            x: circlePos.x + dx * scale,
            y: circlePos.y + dy * scale,
        };
    }

    /** Fast circle containment test */
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

// ============================================
// DETERMINISTIC PRNG (Mulberry32)
// ============================================

export class PRNG {
    private static seed: number = 0;

    static setSeed(s: number): void {
        this.seed = s;
    }

    /** Fast, good quality random number generator */
    static next(): number {
        let t = (this.seed += 0x6d2b79f5);
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    }

    static range(min: number, max: number): number {
        return this.next() * (max - min) + min;
    }

    static int(min: number, max: number): number {
        return Math.floor(this.next() * (max - min)) + min;
    }
}

// ============================================
// PERFORMANCE MONITOR
// ============================================

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
            totalOperations:
                this.sqrtOperations +
                this.distanceOperations +
                this.collisionOperations,
        };
    }

    static reset(): void {
        this.sqrtOperations = 0;
        this.distanceOperations = 0;
        this.collisionOperations = 0;
    }
}

// ============================================
// LEGACY FASTMATH CLASS (API Compatibility)
// ============================================

export class FastMath {
    static fastSqrt = fastSqrt;
    static distanceSquared = distanceSquared;
    static distanceFromOriginSquared = distanceFromOriginSquared;
    static distanceSquared3D = distanceSquared3D;
    static fastLength = fastLength;
    static fastNormalize = fastNormalize;
    static lerp = lerp;
    static lerpVector = lerpVector;
    static clamp = clamp;
    static clampVector = clampVector;
    static angleBetween = angleBetween;
    static rotateVector = rotateVector;
    static reflectVector = reflectVector;
}

// ============================================
// UNIFIED EXPORT
// ============================================

export const fastMath = {
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

    // Native wrappers for consistency
    sin: Math.sin,
    cos: Math.cos,
    atan2: Math.atan2,
    abs: Math.abs,
    min: Math.min,
    max: Math.max,
    floor: Math.floor,
    ceil: Math.ceil,
    round: Math.round,
};

export default fastMath;
