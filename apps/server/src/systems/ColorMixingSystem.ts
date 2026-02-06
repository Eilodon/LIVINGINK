/**
 * REFORGED: EIDOLON-V COLOR MIXING SYSTEM (DATA-ORIENTED)
 *
 * "We do not allocate. We overwrite."
 *
 * EIDOLON-V AUDIT FIX: Converted from module-level global state to instance-based.
 * Multiple GameRoom instances now get isolated pigment buffers instead of sharing one.
 *
 * ARCHITECTURE:
 * - Single Float32Array per instance for all entities (Zero-Copy)
 * - Index-based access (O(1))
 * - Vectorized math layout: [R, G, B,  R, G, B, ...]
 */

export interface PigmentVec3 {
  r: number;
  g: number;
  b: number;
}

// Indices constants
const R = 0;
const G = 1;
const B = 2;

export class ColorMixingSystem {
  private readonly maxEntities: number;
  private readonly pigmentBuffer: Float32Array;
  private readonly registry = new Map<string, number>();
  private readonly freeIndices: number[] = [];

  constructor(maxEntities: number = 2000) {
    this.maxEntities = maxEntities;
    this.pigmentBuffer = new Float32Array(maxEntities * 3);

    // Initialize free indices
    for (let i = maxEntities - 1; i >= 0; i--) {
      this.freeIndices.push(i);
    }
  }

  // --- LIFECYCLE MANAGEMENT ---

  /**
   * Allocates a slot for an entity.
   * @returns Index in the buffer, or -1 if full.
   */
  register(entityId: string, initialColor?: PigmentVec3): number {
    if (this.registry.has(entityId)) return this.registry.get(entityId)!;

    if (this.freeIndices.length === 0) {
      console.warn('[ColorMixing] Buffer overflow! Increase maxEntities');
      return -1;
    }

    const idx = this.freeIndices.pop()!;
    this.registry.set(entityId, idx);

    if (initialColor) {
      this.setColor(idx, initialColor.r, initialColor.g, initialColor.b);
    }

    return idx;
  }

  unregister(entityId: string) {
    const idx = this.registry.get(entityId);
    if (idx !== undefined) {
      this.registry.delete(entityId);
      this.freeIndices.push(idx);
      // Zero out for safety
      const ptr = idx * 3;
      this.pigmentBuffer[ptr + R] = 0;
      this.pigmentBuffer[ptr + G] = 0;
      this.pigmentBuffer[ptr + B] = 0;
    }
  }

  getIndex(entityId: string): number {
    return this.registry.get(entityId) ?? -1;
  }

  // --- ZERO-COPY MATH ---

  setColor(idx: number, r: number, g: number, b: number) {
    if (idx < 0) return;
    const ptr = idx * 3;
    this.pigmentBuffer[ptr + R] = r;
    this.pigmentBuffer[ptr + G] = g;
    this.pigmentBuffer[ptr + B] = b;
  }

  mixPigment(idx: number, targetR: number, targetG: number, targetB: number, ratio: number) {
    if (idx < 0) return;
    const ptr = idx * 3;

    this.pigmentBuffer[ptr + R] += (targetR - this.pigmentBuffer[ptr + R]) * ratio;
    this.pigmentBuffer[ptr + G] += (targetG - this.pigmentBuffer[ptr + G]) * ratio;
    this.pigmentBuffer[ptr + B] += (targetB - this.pigmentBuffer[ptr + B]) * ratio;
  }

  getMatchScore(idxA: number, idxB: number): number {
    if (idxA < 0 || idxB < 0) return 0;

    const ptrA = idxA * 3;
    const ptrB = idxB * 3;

    const dr = this.pigmentBuffer[ptrA + R] - this.pigmentBuffer[ptrB + R];
    const dg = this.pigmentBuffer[ptrA + G] - this.pigmentBuffer[ptrB + G];
    const db = this.pigmentBuffer[ptrA + B] - this.pigmentBuffer[ptrB + B];

    const distSq = dr * dr + dg * dg + db * db;
    const dist = Math.sqrt(distSq);
    const maxDist = 1.73205; // Sqrt(3)

    const raw = 1.0 - dist / maxDist;
    const clamped = raw < 0 ? 0 : raw > 1 ? 1 : raw;

    return Math.pow(clamped, 1.1);
  }

  // --- COMPATIBILITY / SYNC LAYER ---

  syncToSchema(entityId: string, outSchema: { pigment: PigmentVec3 }) {
    const idx = this.registry.get(entityId);
    if (idx === undefined) return;

    const ptr = idx * 3;
    outSchema.pigment.r = this.pigmentBuffer[ptr + R];
    outSchema.pigment.g = this.pigmentBuffer[ptr + G];
    outSchema.pigment.b = this.pigmentBuffer[ptr + B];
  }

  syncFromSchema(entityId: string, inSchema: { pigment: PigmentVec3 }) {
    const idx = this.register(entityId);
    const ptr = idx * 3;
    this.pigmentBuffer[ptr + R] = inSchema.pigment.r;
    this.pigmentBuffer[ptr + G] = inSchema.pigment.g;
    this.pigmentBuffer[ptr + B] = inSchema.pigment.b;
  }

  // --- LEGACY ADAPTER ---
  processColorMixing(
    playerId: string,
    current: PigmentVec3,
    target: PigmentVec3,
    ratio: number = 0.1
  ): PigmentVec3 {
    let idx = this.registry.get(playerId);

    if (idx === undefined) {
      idx = this.register(playerId, current);
    } else {
      this.setColor(idx, current.r, current.g, current.b);
    }

    this.mixPigment(idx, target.r, target.g, target.b, ratio);

    const ptr = idx * 3;
    return {
      r: this.pigmentBuffer[ptr + R],
      g: this.pigmentBuffer[ptr + G],
      b: this.pigmentBuffer[ptr + B],
    };
  }

  /** Clean up all state (call when room disposes) */
  dispose() {
    this.registry.clear();
    this.freeIndices.length = 0;
    this.pigmentBuffer.fill(0);
  }
}

// Legacy compat: export a default instance for backward compatibility
export const colorMixingSystem = new ColorMixingSystem();
