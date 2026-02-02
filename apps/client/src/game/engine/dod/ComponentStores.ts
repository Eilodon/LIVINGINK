import { MAX_ENTITIES, EntityFlags } from './EntityFlags';

// EIDOLON-V FIX: Runtime validation for entity limits
const MAX_TYPED_ARRAY_SIZE = 65536; // Safe limit for Float32Array
if (MAX_ENTITIES * 8 > MAX_TYPED_ARRAY_SIZE) {
  throw new Error(
    `Entity configuration exceeds TypedArray limits: ${MAX_ENTITIES} entities × 8 stride = ${MAX_ENTITIES * 8} > ${MAX_TYPED_ARRAY_SIZE}`
  );
}

// EIDOLON-V P0-2 FIX: Runtime bounds validation helper
// Throws error immediately if id is out of bounds - fail fast principle
function validateEntityId(id: number, caller: string): void {
  if (__DEV__ && (id < 0 || id >= MAX_ENTITIES)) {
    throw new RangeError(
      `[DOD] ${caller}: Entity ID ${id} out of bounds [0, ${MAX_ENTITIES})`
    );
  }
}

// EIDOLON-V P0-2: Production-safe bounds check (returns false instead of throwing)
function isValidEntityId(id: number): boolean {
  return id >= 0 && id < MAX_ENTITIES;
}

// __DEV__ flag for development-only checks
declare const __DEV__: boolean;

export class TransformStore {
  // [x, y, rotation, scale, prevX, prevY, prevRotation, _pad]
  // Stride = 8
  public static readonly STRIDE = 8;
  public static readonly data = new Float32Array(MAX_ENTITIES * TransformStore.STRIDE);

  // Helper accessors

  static set(id: number, x: number, y: number, rotation: number, scale: number = 1.0) {
    // EIDOLON-V P0-2 FIX: Bounds validation
    if (!isValidEntityId(id)) {
      console.error(`[DOD] TransformStore.set: Invalid entity ID ${id}`);
      return;
    }
    const idx = id * 8;
    this.data[idx] = x;
    this.data[idx + 1] = y;
    this.data[idx + 2] = rotation;
    this.data[idx + 3] = scale;
    // Initialize prev
    this.data[idx + 4] = x;
    this.data[idx + 5] = y;
    this.data[idx + 6] = rotation;
  }

  // EIDOLON-V P0-2: Safe setters with bounds check
  static setPosition(id: number, x: number, y: number): void {
    if (!isValidEntityId(id)) return;
    const idx = id * 8;
    this.data[idx] = x;
    this.data[idx + 1] = y;
  }

  static getX(id: number): number {
    if (!isValidEntityId(id)) return 0;
    return this.data[id * 8];
  }

  static getY(id: number): number {
    if (!isValidEntityId(id)) return 0;
    return this.data[id * 8 + 1];
  }
}


export class PhysicsStore {
  // [vx, vy, vRotation, mass, radius, restitution, friction, _pad]
  // Stride = 8
  public static readonly STRIDE = 8;
  public static readonly data = new Float32Array(MAX_ENTITIES * PhysicsStore.STRIDE);

  static set(
    id: number,
    vx: number,
    vy: number,
    mass: number,
    radius: number,
    restitution: number = 0.5,
    friction: number = 0.9
  ) {
    // EIDOLON-V P0-2 FIX: Bounds validation
    if (!isValidEntityId(id)) {
      console.error(`[DOD] PhysicsStore.set: Invalid entity ID ${id}`);
      return;
    }
    const idx = id * 8;
    this.data[idx] = vx;
    this.data[idx + 1] = vy;
    this.data[idx + 2] = 0; // vRotation
    this.data[idx + 3] = mass;
    this.data[idx + 4] = radius;
    this.data[idx + 5] = restitution;
    this.data[idx + 6] = friction;
  }

  // EIDOLON-V P0-2: Safe velocity setter with bounds check
  static setVelocity(id: number, vx: number, vy: number): void {
    if (!isValidEntityId(id)) return;
    const idx = id * 8;
    this.data[idx] = vx;
    this.data[idx + 1] = vy;
  }

  static getVelocityX(id: number): number {
    if (!isValidEntityId(id)) return 0;
    return this.data[id * 8];
  }

  static getVelocityY(id: number): number {
    if (!isValidEntityId(id)) return 0;
    return this.data[id * 8 + 1];
  }

  static getRadius(id: number): number {
    if (!isValidEntityId(id)) return 0;
    return this.data[id * 8 + 4];
  }
}

export class StateStore {
  // Flags for type and status
  public static readonly flags = new Uint16Array(MAX_ENTITIES);

  // EIDOLON-V P0-2 FIX: Bounds validation for all flag operations
  static setFlag(id: number, flag: EntityFlags) {
    if (!isValidEntityId(id)) return;
    this.flags[id] |= flag;
  }

  static clearFlag(id: number, flag: EntityFlags) {
    if (!isValidEntityId(id)) return;
    this.flags[id] &= ~flag;
  }

  static hasFlag(id: number, flag: EntityFlags): boolean {
    if (!isValidEntityId(id)) return false;
    return (this.flags[id] & flag) === flag;
  }

  static isActive(id: number): boolean {
    if (!isValidEntityId(id)) return false;
    return (this.flags[id] & EntityFlags.ACTIVE) !== 0;
  }
}

export class StatsStore {
  // [currentHealth, maxHealth, score, matchPercent, defense, damageMultiplier, _pad, _pad]
  public static readonly STRIDE = 8;
  public static readonly data = new Float32Array(MAX_ENTITIES * StatsStore.STRIDE);

  static set(
    id: number,
    currentHealth: number,
    maxHealth: number,
    score: number,
    matchPercent: number,
    defense: number = 1,
    damageMultiplier: number = 1
  ) {
    const idx = id * StatsStore.STRIDE;
    this.data[idx] = currentHealth;
    this.data[idx + 1] = maxHealth;
    this.data[idx + 2] = score;
    this.data[idx + 3] = matchPercent;
    this.data[idx + 4] = defense;
    this.data[idx + 5] = damageMultiplier;
  }

  // Setters
  static setDefense(id: number, value: number) {
    this.data[id * StatsStore.STRIDE + 4] = value;
  }

  static setDamageMultiplier(id: number, value: number) {
    this.data[id * StatsStore.STRIDE + 5] = value;
  }

  static setCurrentHealth(id: number, value: number) {
    this.data[id * StatsStore.STRIDE] = value;
  }

  static setMaxHealth(id: number, value: number) {
    this.data[id * StatsStore.STRIDE + 1] = value;
  }

  // EIDOLON-V P2: Getter Methods (DOD Authority)
  static getCurrentHealth(id: number): number {
    return this.data[id * StatsStore.STRIDE];
  }

  static getMaxHealth(id: number): number {
    return this.data[id * StatsStore.STRIDE + 1];
  }

  static getScore(id: number): number {
    return this.data[id * StatsStore.STRIDE + 2];
  }

  static getMatchPercent(id: number): number {
    return this.data[id * StatsStore.STRIDE + 3];
  }

  static getDefense(id: number): number {
    return this.data[id * StatsStore.STRIDE + 4];
  }

  static getDamageMultiplier(id: number): number {
    return this.data[id * StatsStore.STRIDE + 5];
  }
}

export class SkillStore {
  // [cooldown, maxCooldown, activeTimer, shapeId]
  // Stride = 4
  public static readonly STRIDE = 4;
  public static readonly data = new Float32Array(MAX_ENTITIES * SkillStore.STRIDE);

  static set(id: number, cooldown: number, maxCooldown: number, shapeId: number) {
    const idx = id * SkillStore.STRIDE;
    this.data[idx] = cooldown;
    this.data[idx + 1] = maxCooldown;
    this.data[idx + 2] = 0; // activeTimer
    this.data[idx + 3] = shapeId;
  }
}

export class TattooStore {
  // [flags (u32 cast to f32), procChance, timer1, timer2]
  // Note: Store flags as f32 is risky for bit ops if > 2^24.
  // JS Numbers are doubles (53 bit int safe), but Float32Array is 32-bit float (23 bit mantissa).
  // Uint32Array backing might be better for flags?
  // Let's use a separate Uint32Array for flags if we need full 32 bits.
  // For now, let's behave like StateStore and use a separate typed array for Flags.

  public static readonly STRIDE = 4;
  public static readonly data = new Float32Array(MAX_ENTITIES * TattooStore.STRIDE);
  public static readonly flags = new Uint32Array(MAX_ENTITIES); // Separate flags

  static set(id: number, flags: number, procChance: number) {
    this.flags[id] = flags;
    const idx = id * TattooStore.STRIDE;
    this.data[idx] = 0; // timer1
    this.data[idx + 1] = 0; // timer2
    this.data[idx + 2] = procChance;
  }
}

export class ProjectileStore {
  // [ownerId (int), damage, duration, typeId]
  // Stride = 4
  public static readonly STRIDE = 4;
  public static readonly data = new Float32Array(MAX_ENTITIES * ProjectileStore.STRIDE);

  static set(id: number, ownerId: number, damage: number, duration: number, typeId: number = 0) {
    const idx = id * ProjectileStore.STRIDE;
    this.data[idx] = ownerId;
    this.data[idx + 1] = damage;
    this.data[idx + 2] = duration; // Remaining duration
    this.data[idx + 3] = typeId;
  }
}

export * from './ConfigStore';
import { ConfigStore } from './ConfigStore';

export class InputStore {
  // [targetX, targetY, isSkillActive, isEjectActive]
  // Stride = 4
  public static readonly STRIDE = 4;
  public static readonly data = new Float32Array(MAX_ENTITIES * InputStore.STRIDE);

  static setTarget(id: number, x: number, y: number) {
    const idx = id * InputStore.STRIDE;
    this.data[idx] = x;
    this.data[idx + 1] = y;
  }

  static getTarget(id: number, out: { x: number; y: number }) {
    const idx = id * InputStore.STRIDE;
    out.x = this.data[idx];
    out.y = this.data[idx + 1];
  }

  static setSkillActive(id: number, active: boolean) {
    const idx = id * InputStore.STRIDE;
    this.data[idx + 2] = active ? 1 : 0;
  }

  static getSkillActive(id: number): boolean {
    const idx = id * InputStore.STRIDE;
    return this.data[idx + 2] === 1;
  }

  static consumeSkillInput(id: number): boolean {
    const idx = id * InputStore.STRIDE;
    if (this.data[idx + 2] === 1) {
      this.data[idx + 2] = 0;
      return true;
    }
    return false;
  }

  static setEjectActive(id: number, active: boolean) {
    const idx = id * InputStore.STRIDE;
    this.data[idx + 3] = active ? 1 : 0;
  }

  static getEjectActive(id: number): boolean {
    const idx = id * InputStore.STRIDE;
    return this.data[idx + 3] === 1;
  }

  static consumeEjectInput(id: number): boolean {
    const idx = id * InputStore.STRIDE;
    if (this.data[idx + 3] === 1) {
      this.data[idx + 3] = 0;
      return true;
    }
    return false;
  }
}

export function resetAllStores() {
  TransformStore.data.fill(0);
  PhysicsStore.data.fill(0);
  StatsStore.data.fill(0);
  SkillStore.data.fill(0);
  TattooStore.data.fill(0);
  TattooStore.flags.fill(0);
  ProjectileStore.data.fill(0);
  ConfigStore.data.fill(0); // EIDOLON-V: Reset Config
  InputStore.data.fill(0); // EIDOLON-V: Reset Input
  StateStore.flags.fill(0);
  EntityLookup.fill(null);
}

import { Entity } from '../../../types';

// Global Lookup for Reverse Mapping (DOD Index -> Logic Object)
// This bridges the gap for Systems that need to access the full JS Object (Rendering, Combat Logic)
export const EntityLookup: (Entity | null)[] = new Array(MAX_ENTITIES).fill(null);
