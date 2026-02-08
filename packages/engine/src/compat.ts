/**
 * @cjr/engine - Compatibility Layer
 *
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║  ⚠️  DEPRECATION NOTICE - SCHEDULED FOR REMOVAL IN v2.0.0  ⚠️            ║
 * ╠═══════════════════════════════════════════════════════════════════════════╣
 * ║  The *Store wrapper classes below are DEPRECATED.                        ║
 * ║  Use *Access classes directly from '@cjr/engine' instead:                ║
 * ║                                                                           ║
 * ║  ❌ TransformStore.set(...)  →  ✅ TransformAccess.set(...)              ║
 * ║  ❌ PhysicsStore.set(...)    →  ✅ PhysicsAccess.set(...)                ║
 * ║  ❌ StatsStore.get...(...)   →  ✅ StatsAccess.get...(...)               ║
 * ║  ❌ defaultWorld             →  ✅ new WorldState() / getWorld()         ║
 * ║                                                                           ║
 * ║  Migration: Search for "*Store" and replace with "*Access"               ║
 * ║  Timeline: v1.5.0 (warnings) → v2.0.0 (removal)                          ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 *
 * EIDOLON-V: Keeps the lights on for legacy code while we migrate to WorldState.
 * Proxies legacy static access (TransformStore.data, etc.) to generated WorldState.
 *
 * CLEANUP NOTE: Kept wrapper classes to maintain backward API compatibility.
 * The wrappers adapt legacy 6-arg signatures to new 9-arg Access classes.
 */

import {
    WorldState,
    STRIDES,
    MAX_ENTITIES,
    type IWorldConfig,
} from './generated/WorldState';

import {
    EntityFlags as GeneratedEntityFlags,
    TransformAccess,
    PhysicsAccess,
    StatsAccess,
    InputAccess,
    ConfigAccess,
    SkillAccess,
    ProjectileAccess,
    StateAccess,
    PigmentAccess,
    TattooAccess,
} from './generated/ComponentAccessors';

// =============================================================================
// RE-EXPORTS FROM GENERATED
// =============================================================================

export {
    WorldState,
    // EIDOLON-V: defaultWorld REMOVED - use new WorldState() directly
    STRIDES,
    MAX_ENTITIES,
    type IWorldConfig,
};

export {
    NetworkSerializer,
    COMPONENT_IDS,
    COMPONENT_STRIDES,
} from './generated/NetworkPacker';

export { GeneratedEntityFlags as EntityFlags };

// Also re-export Access classes directly for new code
export {
    TransformAccess,
    PhysicsAccess,
    StatsAccess,
    InputAccess,
    ConfigAccess,
    SkillAccess,
    ProjectileAccess,
    StateAccess,
    PigmentAccess,
    TattooAccess,
};

// Reserved flags offset for engine use (bits 0-7 used by engine, 8+ available for modules)
export const ENGINE_FLAG_OFFSET = 8;

// Re-export CJR Flags for compatibility
export * from './modules/cjr/flags';

// =============================================================================
// DEPRECATION WARNING HELPER
// =============================================================================

declare const __DEV__: boolean | undefined;

const warnedMessages = new Set<string>();

function warnOnce(msg: string): void {
    if (typeof __DEV__ !== 'undefined' && __DEV__ && typeof console !== 'undefined') {
        if (warnedMessages.has(msg)) return;
        warnedMessages.add(msg);
        console.warn(`[EIDOLON-V DEPRECATION] ${msg}`);
    }
}

// =============================================================================
// LEGACY ENTITY LOOKUP
// =============================================================================

/**
 * Global entity lookup array for legacy client code.
 * @deprecated Use IEntityLookup interface and dependency injection where possible.
 */
export const EntityLookup: any[] = new Array(MAX_ENTITIES).fill(null);

// =============================================================================
// COMPATIBILITY STORES (Wrapper Classes)
// These adapt legacy API signatures to new Access classes
// @deprecated Use TransformAccess, PhysicsAccess, etc. directly
// =============================================================================

/**
 * @deprecated Use TransformAccess directly for new code.
 * TransformStore is a legacy wrapper and will be removed in a future version.
 */
export class TransformStore {
    static readonly STRIDE = STRIDES.TRANSFORM;

    static getX(world: WorldState, id: number): number {
        return TransformAccess.getX(world, id);
    }

    static getY(world: WorldState, id: number): number {
        return TransformAccess.getY(world, id);
    }

    /** 
     * @deprecated Use TransformAccess.set() directly
     * Legacy signature: (world, id, x, y, rotation, scale?) 
     */
    static set(world: WorldState, id: number, x: number, y: number, rotation: number, scale: number = 1): void {
        warnOnce('TransformStore.set() is deprecated. Use TransformAccess.set() instead.');
        TransformAccess.set(world, id, x, y, rotation, scale, x, y, rotation);
    }

    /** @deprecated Use TransformAccess.setX/setY directly */
    static setPosition(world: WorldState, id: number, x: number, y: number): void {
        warnOnce('TransformStore.setPosition() is deprecated. Use TransformAccess.setX/setY() instead.');
        TransformAccess.setX(world, id, x);
        TransformAccess.setY(world, id, y);
    }
}

/**
 * @deprecated Use PhysicsAccess directly for new code.
 * PhysicsStore is a legacy wrapper and will be removed in a future version.
 */
export class PhysicsStore {
    static readonly STRIDE = STRIDES.PHYSICS;

    static getVx(world: WorldState, id: number): number {
        return PhysicsAccess.getVx(world, id);
    }

    static getVy(world: WorldState, id: number): number {
        return PhysicsAccess.getVy(world, id);
    }

    static getRadius(world: WorldState, id: number): number {
        return PhysicsAccess.getRadius(world, id);
    }

    static getVelocityX(world: WorldState, id: number): number {
        return PhysicsAccess.getVx(world, id);
    }

    static getVelocityY(world: WorldState, id: number): number {
        return PhysicsAccess.getVy(world, id);
    }

    /** 
     * @deprecated Use PhysicsAccess.set() directly
     * Legacy signature: (world, id, vx, vy, mass, radius, restitution?, friction?) 
     */
    static set(world: WorldState, id: number, vx: number, vy: number, mass: number, radius: number, restitution: number = 0.5, friction: number = 0.9): void {
        warnOnce('PhysicsStore.set() is deprecated. Use PhysicsAccess.set() instead.');
        PhysicsAccess.set(world, id, vx, vy, 0, mass, radius, restitution, friction);
    }

    /** @deprecated Use PhysicsAccess.setVx/setVy directly */
    static setVelocity(world: WorldState, id: number, vx: number, vy: number): void {
        warnOnce('PhysicsStore.setVelocity() is deprecated. Use PhysicsAccess.setVx/setVy() instead.');
        PhysicsAccess.setVx(world, id, vx);
        PhysicsAccess.setVy(world, id, vy);
    }

    /** @deprecated Use PhysicsAccess.setRadius() directly */
    static setRadius(world: WorldState, id: number, radius: number): void {
        warnOnce('PhysicsStore.setRadius() is deprecated. Use PhysicsAccess.setRadius() instead.');
        PhysicsAccess.setRadius(world, id, radius);
    }
}

export class StatsStore {
    static readonly STRIDE = STRIDES.STATS;

    static getCurrentHealth(world: WorldState, id: number): number {
        return StatsAccess.getHp(world, id);
    }

    static getMaxHealth(world: WorldState, id: number): number {
        return StatsAccess.getMaxHp(world, id);
    }

    static getScore(world: WorldState, id: number): number {
        return StatsAccess.getScore(world, id);
    }

    static getMatchPercent(world: WorldState, id: number): number {
        return StatsAccess.getMatchPercent(world, id);
    }

    static getDamageMultiplier(world: WorldState, id: number): number {
        return StatsAccess.getDamageMultiplier(world, id);
    }

    static set(world: WorldState, id: number, hp: number, maxHp: number, score: number, matchPercent: number, defense: number, damageMultiplier: number): void {
        StatsAccess.set(world, id, hp, maxHp, score, matchPercent, defense, damageMultiplier);
    }

    static setCurrentHealth(world: WorldState, id: number, value: number): void {
        StatsAccess.setHp(world, id, value);
    }

    static setMaxHealth(world: WorldState, id: number, value: number): void {
        StatsAccess.setMaxHp(world, id, value);
    }
}

export class StateStore {
    static isActive(world: WorldState, id: number): boolean {
        return StateAccess.isActive(world, id);
    }

    static hasFlag(world: WorldState, id: number, flag: number): boolean {
        return StateAccess.hasFlag(world, id, flag);
    }

    static setFlag(world: WorldState, id: number, flag: number): void {
        if ((flag & GeneratedEntityFlags.ACTIVE) !== 0) {
            StateAccess.activate(world, id);
        }
        StateAccess.setFlag(world, id, flag);
    }

    static clearFlag(world: WorldState, id: number, flag: number): void {
        if ((flag & GeneratedEntityFlags.ACTIVE) !== 0) {
            StateAccess.deactivate(world, id);
        }
        StateAccess.clearFlag(world, id, flag);
    }
}

export class InputStore {
    static readonly STRIDE = STRIDES.INPUT;

    static setTarget(world: WorldState, id: number, x: number, y: number): void {
        InputAccess.setTargetX(world, id, x);
        InputAccess.setTargetY(world, id, y);
    }

    static getTarget(world: WorldState, id: number, out: { x: number; y: number }): void {
        out.x = InputAccess.getTargetX(world, id);
        out.y = InputAccess.getTargetY(world, id);
    }

    static setAction(world: WorldState, id: number, bit: number, active: boolean): void {
        let actions = InputAccess.getActions(world, id);
        if (active) actions |= 1 << bit;
        else actions &= ~(1 << bit);
        InputAccess.setActions(world, id, actions);
    }

    static isActionActive(world: WorldState, id: number, bit: number): boolean {
        const actions = InputAccess.getActions(world, id);
        return (actions & (1 << bit)) !== 0;
    }

    /** NEW: InputAccess-compatible set */
    static set(world: WorldState, id: number, targetX: number, targetY: number, actions: number): void {
        InputAccess.set(world, id, targetX, targetY, actions);
    }
}

export class ConfigStore {
    static readonly STRIDE = STRIDES.CONFIG;

    static setSpeedMultiplier(world: WorldState, id: number, value: number): void {
        ConfigAccess.setSpeedMult(world, id, value);
    }

    /** @deprecated Use setSpeedMultiplier - this method just updates speed multiplier */
    static setMaxSpeed(world: WorldState, id: number, value: number): void {
        // Legacy: setMaxSpeed actually sets speed multiplier relative to base
        ConfigAccess.setSpeedMult(world, id, value / 400); // Normalize to multiplier
    }

    static setMagnetRadius(world: WorldState, id: number, value: number): void {
        ConfigAccess.setMagneticRadius(world, id, value);
    }

    static set(world: WorldState, id: number, magneticRadius: number, damageMult: number, speedMult: number, pickupRange: number, visionRange: number, maxSpeed: number = 200): void {
        ConfigAccess.set(world, id, magneticRadius, damageMult, speedMult, pickupRange, visionRange, maxSpeed);
    }
}

export class SkillStore {
    static readonly STRIDE = STRIDES.SKILL;

    static set(world: WorldState, id: number, cooldown: number, maxCooldown: number, activeTimer: number): void {
        SkillAccess.set(world, id, cooldown, maxCooldown, activeTimer, 0);
    }

    static setCooldown(world: WorldState, id: number, val: number): void {
        SkillAccess.setCooldown(world, id, val);
    }

    static setMaxCooldown(world: WorldState, id: number, val: number): void {
        SkillAccess.setMaxCooldown(world, id, val);
    }

    static setActiveTimer(world: WorldState, id: number, val: number): void {
        SkillAccess.setActiveTimer(world, id, val);
    }
}

export class ProjectileStore {
    static readonly STRIDE = STRIDES.PROJECTILE;

    static set(world: WorldState, id: number, ownerId: number, damage: number, duration: number, typeId: number): void {
        ProjectileAccess.set(world, id, ownerId, damage, duration, typeId);
    }
}

export class PigmentStore {
    static readonly STRIDE = STRIDES.PIGMENT;
    static readonly R = 0;
    static readonly G = 1;
    static readonly B = 2;
    static readonly MATCH = 3;

    static getColorInt(world: WorldState, id: number): number {
        const r = Math.floor(PigmentAccess.getR(world, id) * 255);
        const g = Math.floor(PigmentAccess.getG(world, id) * 255);
        const b = Math.floor(PigmentAccess.getB(world, id) * 255);
        return (r << 16) | (g << 8) | b;
    }

    static getMatch(world: WorldState, id: number): number {
        return PigmentAccess.getMatchPercent(world, id);
    }

    /** Legacy signature: (world, id, r, g, b) */
    static set(world: WorldState, id: number, r: number, g: number, b: number): void {
        PigmentAccess.setR(world, id, r);
        PigmentAccess.setG(world, id, g);
        PigmentAccess.setB(world, id, b);
    }

    static mix(world: WorldState, id: number, r: number, g: number, b: number, ratio: number): void {
        const currentR = PigmentAccess.getR(world, id);
        const currentG = PigmentAccess.getG(world, id);
        const currentB = PigmentAccess.getB(world, id);

        PigmentAccess.setR(world, id, currentR + (r - currentR) * ratio);
        PigmentAccess.setG(world, id, currentG + (g - currentG) * ratio);
        PigmentAccess.setB(world, id, currentB + (b - currentB) * ratio);
    }
}

export class TattooStore {
    static readonly STRIDE = STRIDES.TATTOO;
    private static _flags = new Uint8Array(MAX_ENTITIES);

    static get flags(): Uint8Array {
        return this._flags;
    }

    /** 
     * @deprecated REMOVED - Use WorldState.tattoo directly
     * @throws Error Always throws - migrate to instance-based access
     */
    static get data(): Float32Array {
        throw new Error(
            '[EIDOLON-V] TattooStore.data is deprecated. ' +
            'Use getWorld().tattoo or world.tattoo for instance-based access.'
        );
    }
}

// =============================================================================
// RESET FUNCTION
// =============================================================================

/**
 * Reset all stores
 * @deprecated REMOVED - Use world.reset() directly on your WorldState instance
 */
export function resetAllStores(): void {
    throw new Error(
        '[EIDOLON-V] resetAllStores() is REMOVED. ' +
        'Use world.reset() directly on your WorldState instance.'
    );
}

