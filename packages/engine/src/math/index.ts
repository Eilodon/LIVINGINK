/**
 * @cjr/engine - Math Module
 * Pure math utilities with collision detection
 * 
 * EIDOLON-V CONSOLIDATION: Single source of truth for all math utilities
 */

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
    CollisionMath,
    SpatialOptimizer,
    PRNG,
    MathPerformanceMonitor,

    // Types
    type Vector2,
    type Vector3,
} from './FastMath';
