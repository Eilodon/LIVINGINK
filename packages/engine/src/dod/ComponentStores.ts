/**
 * @cjr/engine - ComponentStores
 * Data-Oriented Design stores using TypedArrays
 * Zero dependencies - headless compatible
 *
 * EIDOLON-V UNIFICATION: Replaced ComponentRegistry pattern with STATIC TypedArrays.
 * This is the SINGLE SOURCE OF TRUTH for all DOD stores.
 */

import { MAX_ENTITIES, EntityFlags } from './EntityFlags';

// Runtime validation for entity limits
const MAX_TYPED_ARRAY_SIZE = 65536; // Safe limit for Float32Array
if (MAX_ENTITIES * 8 > MAX_TYPED_ARRAY_SIZE) {
    throw new Error(
        `Entity configuration exceeds TypedArray limits: ${MAX_ENTITIES} entities × 8 stride = ${MAX_ENTITIES * 8} > ${MAX_TYPED_ARRAY_SIZE}`
    );
}

// Production-safe bounds check (returns false instead of throwing)
function isValidEntityId(id: number): boolean {
    return id >= 0 && id < MAX_ENTITIES;
}

// =============================================================================
// TRANSFORM STORE
// =============================================================================

export class TransformStore {
    // [x, y, rotation, scale, prevX, prevY, prevRotation, _pad]
    public static readonly STRIDE = 8;
    public static readonly data = new Float32Array(MAX_ENTITIES * TransformStore.STRIDE);

    static set(id: number, x: number, y: number, rotation: number, scale: number = 1.0) {
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

// =============================================================================
// PHYSICS STORE
// =============================================================================

export class PhysicsStore {
    // [vx, vy, vRotation, mass, radius, restitution, friction, _pad]
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

// =============================================================================
// STATE STORE
// =============================================================================

export class StateStore {
    // Flags for type and status
    public static readonly flags = new Uint16Array(MAX_ENTITIES);

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

// =============================================================================
// STATS STORE
// =============================================================================

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

    static setDefense(id: number, value: number) {
        if (!isValidEntityId(id)) return;
        this.data[id * StatsStore.STRIDE + 4] = value;
    }

    static setDamageMultiplier(id: number, value: number) {
        if (!isValidEntityId(id)) return;
        this.data[id * StatsStore.STRIDE + 5] = value;
    }

    static setCurrentHealth(id: number, value: number) {
        if (!isValidEntityId(id)) return;
        this.data[id * StatsStore.STRIDE] = value;
    }

    static setMaxHealth(id: number, value: number) {
        if (!isValidEntityId(id)) return;
        this.data[id * StatsStore.STRIDE + 1] = value;
    }

    static getCurrentHealth(id: number): number {
        if (!isValidEntityId(id)) return 0;
        return this.data[id * StatsStore.STRIDE];
    }

    static getMaxHealth(id: number): number {
        if (!isValidEntityId(id)) return 0;
        return this.data[id * StatsStore.STRIDE + 1];
    }

    static getScore(id: number): number {
        if (!isValidEntityId(id)) return 0;
        return this.data[id * StatsStore.STRIDE + 2];
    }

    static getMatchPercent(id: number): number {
        if (!isValidEntityId(id)) return 0;
        return this.data[id * StatsStore.STRIDE + 3];
    }

    static getDefense(id: number): number {
        if (!isValidEntityId(id)) return 1;
        return this.data[id * StatsStore.STRIDE + 4];
    }

    static getDamageMultiplier(id: number): number {
        if (!isValidEntityId(id)) return 1;
        return this.data[id * StatsStore.STRIDE + 5];
    }
}

// =============================================================================
// SKILL STORE
// =============================================================================

export class SkillStore {
    // [cooldown, maxCooldown, activeTimer, shapeId]
    public static readonly STRIDE = 4;
    public static readonly data = new Float32Array(MAX_ENTITIES * SkillStore.STRIDE);

    static set(id: number, cooldown: number, maxCooldown: number, shapeId: number) {
        if (!isValidEntityId(id)) return;
        const idx = id * SkillStore.STRIDE;
        this.data[idx] = cooldown;
        this.data[idx + 1] = maxCooldown;
        this.data[idx + 2] = 0; // activeTimer
        this.data[idx + 3] = shapeId;
    }

    static getCooldown(id: number): number {
        return this.data[id * SkillStore.STRIDE];
    }

    static setCooldown(id: number, value: number) {
        this.data[id * SkillStore.STRIDE] = value;
    }

    static getMaxCooldown(id: number): number {
        return this.data[id * SkillStore.STRIDE + 1];
    }

    static setMaxCooldown(id: number, value: number) {
        this.data[id * SkillStore.STRIDE + 1] = value;
    }

    static getActiveTimer(id: number): number {
        return this.data[id * SkillStore.STRIDE + 2];
    }

    static setActiveTimer(id: number, value: number) {
        this.data[id * SkillStore.STRIDE + 2] = value;
    }
}

// =============================================================================
// TATTOO STORE (CJR-specific)
// =============================================================================

export class TattooStore {
    public static readonly STRIDE = 4;
    public static readonly data = new Float32Array(MAX_ENTITIES * TattooStore.STRIDE);
    public static readonly flags = new Uint32Array(MAX_ENTITIES);

    static set(id: number, flags: number, procChance: number) {
        if (!isValidEntityId(id)) return;
        this.flags[id] = flags;
        const idx = id * TattooStore.STRIDE;
        this.data[idx] = 0; // timer1
        this.data[idx + 1] = 0; // timer2
        this.data[idx + 2] = procChance;
    }
}

// =============================================================================
// PROJECTILE STORE
// =============================================================================

export class ProjectileStore {
    // [ownerId (int), damage, duration, typeId]
    public static readonly STRIDE = 4;
    public static readonly data = new Float32Array(MAX_ENTITIES * ProjectileStore.STRIDE);

    static set(id: number, ownerId: number, damage: number, duration: number, typeId: number = 0) {
        if (!isValidEntityId(id)) return;
        const idx = id * ProjectileStore.STRIDE;
        this.data[idx] = ownerId;
        this.data[idx + 1] = damage;
        this.data[idx + 2] = duration;
        this.data[idx + 3] = typeId;
    }
}

// =============================================================================
// CONFIG STORE
// =============================================================================

export class ConfigStore {
    // [magneticRadius, damageMult, speedMult, pickupRange, visionRange, _pad, _pad, _pad]
    public static readonly STRIDE = 8;
    public static readonly data = new Float32Array(MAX_ENTITIES * ConfigStore.STRIDE);

    static set(
        id: number,
        magneticRadius: number,
        damageMult: number,
        speedMult: number,
        pickupRange: number,
        visionRange: number
    ) {
        if (!isValidEntityId(id)) return;
        const idx = id * ConfigStore.STRIDE;
        this.data[idx] = magneticRadius;
        this.data[idx + 1] = damageMult;
        this.data[idx + 2] = speedMult;
        this.data[idx + 3] = pickupRange;
        this.data[idx + 4] = visionRange;
    }

    // Accessors
    static getMagneticRadius(id: number): number {
        return this.data[id * ConfigStore.STRIDE];
    }

    static getMagnetRadius(id: number): number {
        return this.data[id * ConfigStore.STRIDE];
    }

    static getDamageMultiplier(id: number): number {
        return this.data[id * ConfigStore.STRIDE + 1];
    }

    static getSpeedMultiplier(id: number): number {
        return this.data[id * ConfigStore.STRIDE + 2] || 1;
    }

    static getMaxSpeed(id: number): number {
        // Alias for backward compatibility
        return 150 * (this.data[id * ConfigStore.STRIDE + 2] || 1);
    }

    // Setters
    static setMagneticRadius(id: number, value: number) {
        this.data[id * ConfigStore.STRIDE] = value;
    }

    static setMagnetRadius(id: number, value: number) {
        this.data[id * ConfigStore.STRIDE] = value;
    }

    static setDamageMultiplier(id: number, value: number) {
        this.data[id * ConfigStore.STRIDE + 1] = value;
    }

    static setSpeedMultiplier(id: number, value: number) {
        this.data[id * ConfigStore.STRIDE + 2] = value;
    }

    static setMaxSpeed(id: number, value: number) {
        // Derive speed multiplier from max speed
        this.data[id * ConfigStore.STRIDE + 2] = value / 150;
    }

    static setPickupRange(id: number, value: number) {
        this.data[id * ConfigStore.STRIDE + 3] = value;
    }

    static setVisionRange(id: number, value: number) {
        this.data[id * ConfigStore.STRIDE + 4] = value;
    }
}

// =============================================================================
// INPUT STORE
// =============================================================================

export class InputStore {
    // [targetX, targetY, actions (bitmask), _pad]
    public static readonly STRIDE = 4;
    public static readonly data = new Float32Array(MAX_ENTITIES * InputStore.STRIDE);

    static setTarget(id: number, x: number, y: number) {
        if (!isValidEntityId(id)) return;
        const idx = id * InputStore.STRIDE;
        this.data[idx] = x;
        this.data[idx + 1] = y;
    }

    static getTarget(id: number, out: { x: number; y: number }) {
        if (!isValidEntityId(id)) return;
        const idx = id * InputStore.STRIDE;
        out.x = this.data[idx];
        out.y = this.data[idx + 1];
    }

    static setAction(id: number, bit: number, active: boolean): void {
        if (!isValidEntityId(id)) return;
        if (bit < 0 || bit > 31) return;
        const idx = id * InputStore.STRIDE;
        const currentActions = this.data[idx + 2];
        const bitMask = 1 << bit;
        this.data[idx + 2] = active ? (currentActions | bitMask) : (currentActions & ~bitMask);
    }

    static isActionActive(id: number, actionBit: number): boolean {
        const idx = id * InputStore.STRIDE + 2;
        return (this.data[idx] & (1 << actionBit)) !== 0;
    }

    static consumeAction(id: number, actionBit: number): boolean {
        const idx = id * InputStore.STRIDE + 2;
        const mask = 1 << actionBit;
        if ((this.data[idx] & mask) !== 0) {
            this.data[idx] &= ~mask;
            return true;
        }
        return false;
    }

    static getActions(id: number): number {
        return this.data[id * InputStore.STRIDE + 2];
    }

    static setActions(id: number, actions: number) {
        this.data[id * InputStore.STRIDE + 2] = actions;
    }
}

// =============================================================================
// PIGMENT STORE (CJR-specific)
// =============================================================================

export class PigmentStore {
    public static readonly STRIDE = 8;
    public static readonly data = new Float32Array(MAX_ENTITIES * PigmentStore.STRIDE);

    // Offset constants
    static readonly R = 0;
    static readonly G = 1;
    static readonly B = 2;
    static readonly TARGET_R = 3;
    static readonly TARGET_G = 4;
    static readonly TARGET_B = 5;
    static readonly MATCH = 6;
    static readonly COLOR_INT = 7;

    static init(id: number, r: number, g: number, b: number,
        targetR: number, targetG: number, targetB: number): void {
        if (!isValidEntityId(id)) return;
        const idx = id * PigmentStore.STRIDE;

        this.data[idx + PigmentStore.R] = r;
        this.data[idx + PigmentStore.G] = g;
        this.data[idx + PigmentStore.B] = b;
        this.data[idx + PigmentStore.TARGET_R] = targetR;
        this.data[idx + PigmentStore.TARGET_G] = targetG;
        this.data[idx + PigmentStore.TARGET_B] = targetB;

        this.updateMatch(id);
        this.updateColorInt(id);
    }

    static set(id: number, r: number, g: number, b: number): void {
        if (!isValidEntityId(id)) return;
        const idx = id * PigmentStore.STRIDE;

        this.data[idx + PigmentStore.R] = r;
        this.data[idx + PigmentStore.G] = g;
        this.data[idx + PigmentStore.B] = b;

        this.updateMatch(id);
        this.updateColorInt(id);
    }

    static mix(id: number, addR: number, addG: number, addB: number, ratio: number): void {
        if (!isValidEntityId(id)) return;
        const idx = id * PigmentStore.STRIDE;

        this.data[idx + PigmentStore.R] += (addR - this.data[idx + PigmentStore.R]) * ratio;
        this.data[idx + PigmentStore.G] += (addG - this.data[idx + PigmentStore.G]) * ratio;
        this.data[idx + PigmentStore.B] += (addB - this.data[idx + PigmentStore.B]) * ratio;

        // Clamp
        this.data[idx + PigmentStore.R] = Math.max(0, Math.min(1, this.data[idx + PigmentStore.R]));
        this.data[idx + PigmentStore.G] = Math.max(0, Math.min(1, this.data[idx + PigmentStore.G]));
        this.data[idx + PigmentStore.B] = Math.max(0, Math.min(1, this.data[idx + PigmentStore.B]));

        this.updateMatch(id);
        this.updateColorInt(id);
    }

    static updateMatch(id: number): void {
        const idx = id * PigmentStore.STRIDE;
        const dr = this.data[idx + PigmentStore.R] - this.data[idx + PigmentStore.TARGET_R];
        const dg = this.data[idx + PigmentStore.G] - this.data[idx + PigmentStore.TARGET_G];
        const db = this.data[idx + PigmentStore.B] - this.data[idx + PigmentStore.TARGET_B];
        const distSq = dr * dr + dg * dg + db * db;
        const thresholdSq = 0.09;
        this.data[idx + PigmentStore.MATCH] = distSq >= thresholdSq ? 0 : 1.0 - distSq / thresholdSq;
    }

    static updateColorInt(id: number): void {
        const idx = id * PigmentStore.STRIDE;
        const r = Math.max(0, Math.min(255, Math.floor(this.data[idx + PigmentStore.R] * 255)));
        const g = Math.max(0, Math.min(255, Math.floor(this.data[idx + PigmentStore.G] * 255)));
        const b = Math.max(0, Math.min(255, Math.floor(this.data[idx + PigmentStore.B] * 255)));
        this.data[idx + PigmentStore.COLOR_INT] = (r << 16) | (g << 8) | b;
    }

    static getPigment(id: number): { r: number; g: number; b: number } {
        const idx = id * PigmentStore.STRIDE;
        return {
            r: this.data[idx + PigmentStore.R],
            g: this.data[idx + PigmentStore.G],
            b: this.data[idx + PigmentStore.B],
        };
    }

    static getMatch(id: number): number {
        return this.data[id * PigmentStore.STRIDE + PigmentStore.MATCH];
    }

    static getColorInt(id: number): number {
        return this.data[id * PigmentStore.STRIDE + PigmentStore.COLOR_INT];
    }
}

// =============================================================================
// ENTITY LOOKUP (Bridge array: DOD Index -> Entity Object)
// =============================================================================

// EntityLookup stores entity objects for reverse lookup (DOD index -> entity)
// Uses 'unknown' type to allow any entity shape from different game modules
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const EntityLookup: (unknown | null)[] = new Array(MAX_ENTITIES).fill(null);

// =============================================================================
// RESET ALL STORES
// =============================================================================

export function resetAllStores() {
    TransformStore.data.fill(0);
    PhysicsStore.data.fill(0);
    StatsStore.data.fill(0);
    SkillStore.data.fill(0);
    TattooStore.data.fill(0);
    TattooStore.flags.fill(0);
    ProjectileStore.data.fill(0);
    ConfigStore.data.fill(0);
    InputStore.data.fill(0);
    PigmentStore.data.fill(0);
    StateStore.flags.fill(0);
    EntityLookup.fill(null);
}
