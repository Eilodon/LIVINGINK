/**
 * @cjr/engine - Compatibility Layer
 * 
 * EIDOLON-V: Keeps the lights on for legacy code while we migrate to WorldState.
 * Proxies legacy static access (TransformStore.data, etc.) to generated WorldState.
 * 
 * @deprecated Migrate to usage of 'generated/WorldState' and 'generated/ComponentAccessors'
 */

import {
    WorldState,
    defaultWorld,
    STRIDES,
    MAX_ENTITIES,
    type IWorldConfig
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

// Re-export generated types
export {
    WorldState,
    defaultWorld,
    STRIDES,
    MAX_ENTITIES,
    type IWorldConfig
};

export {
    NetworkSerializer,
    COMPONENT_IDS,
    COMPONENT_STRIDES
} from './generated/NetworkPacker';

// Re-export EntityFlags
export { GeneratedEntityFlags as EntityFlags };

// Reserved flags offset for engine use (bits 0-7 used by engine, 8+ available for modules)
export const ENGINE_FLAG_OFFSET = 8;

// Re-export CJR Flags for compatibility
export * from './modules/cjr/flags';

// =============================================================================
// LEGACY ENTITY LOOKUP
// =============================================================================
/**
 * Global entity lookup array for legacy client code.
 * @deprecated Use IEntityLookup interface and dependency injection where possible.
 */
export const EntityLookup: any[] = new Array(MAX_ENTITIES).fill(null);


// =============================================================================
// COMPATIBILITY STORES
// Proxies that maintain the old API (static .data, .set without world arg)
// =============================================================================

export class TransformStore {
    static readonly STRIDE = STRIDES.TRANSFORM;

    static get data(): Float32Array {
        throw new Error("TransformStore.data is deprecated. Use WorldState.transform directly.");
    }

    static getX(world: WorldState, id: number): number {
        return TransformAccess.getX(world, id);
    }

    static getY(world: WorldState, id: number): number {
        return TransformAccess.getY(world, id);
    }

    static set(world: WorldState, id: number, x: number, y: number, rotation: number, scale: number = 1): void {
        // Init prev values to current values
        TransformAccess.set(world, id, x, y, rotation, scale, x, y, rotation);
    }

    static setPosition(world: WorldState, id: number, x: number, y: number): void {
        TransformAccess.setX(world, id, x);
        TransformAccess.setY(world, id, y);
    }
}

export class PhysicsStore {
    static readonly STRIDE = STRIDES.PHYSICS;

    static get data(): Float32Array {
        throw new Error("PhysicsStore.data is deprecated. Use WorldState.physics directly.");
    }

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

    static set(world: WorldState, id: number, vx: number, vy: number, mass: number, radius: number, restitution: number = 0.5, friction: number = 0.9): void {
        PhysicsAccess.set(world, id, vx, vy, 0, mass, radius, restitution, friction);
    }

    static setVelocity(world: WorldState, id: number, vx: number, vy: number): void {
        PhysicsAccess.setVx(world, id, vx);
        PhysicsAccess.setVy(world, id, vy);
    }

    static setRadius(world: WorldState, id: number, radius: number): void {
        PhysicsAccess.setRadius(world, id, radius);
    }
}

export class StatsStore {
    static readonly STRIDE = STRIDES.STATS;

    static get data(): Float32Array {
        throw new Error("StatsStore.data is deprecated. Use WorldState.stats directly.");
    }

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
    static get flags(): Uint8Array {
        throw new Error("StateStore.flags is deprecated. Use WorldState.stateFlags directly.");
    }

    static get data(): Uint8Array {
        throw new Error("StateStore.data is deprecated. Use WorldState.stateFlags directly.");
    }

    static isActive(world: WorldState, id: number): boolean {
        return StateAccess.isActive(world, id);
    }

    static hasFlag(world: WorldState, id: number, flag: number): boolean {
        return StateAccess.hasFlag(world, id, flag);
    }

    static setFlag(world: WorldState, id: number, flag: number): void {
        StateAccess.setFlag(world, id, flag);
    }

    static clearFlag(world: WorldState, id: number, flag: number): void {
        StateAccess.clearFlag(world, id, flag);
    }
}

export class InputStore {
    static readonly STRIDE = STRIDES.INPUT;

    static get data(): Float32Array {
        throw new Error("InputStore.data is deprecated. Use WorldState.input directly.");
    }

    static setTarget(world: WorldState, id: number, x: number, y: number): void {
        InputAccess.setTargetX(world, id, x);
        InputAccess.setTargetY(world, id, y);
    }

    static getTarget(world: WorldState, id: number, out: { x: number, y: number }): void {
        out.x = InputAccess.getTargetX(world, id);
        out.y = InputAccess.getTargetY(world, id);
    }

    static setAction(world: WorldState, id: number, bit: number, active: boolean): void {
        let actions = world.inputView.getUint32(id * STRIDES.INPUT * 4 + 8, true);
        if (active) actions |= (1 << bit);
        else actions &= ~(1 << bit);
        world.inputView.setUint32(id * STRIDES.INPUT * 4 + 8, actions, true);
    }

    static isActionActive(world: WorldState, id: number, bit: number): boolean {
        let actions = world.inputView.getUint32(id * STRIDES.INPUT * 4 + 8, true);
        return (actions & (1 << bit)) !== 0;
    }
}

export class ConfigStore {
    static readonly STRIDE = STRIDES.CONFIG;
    static get data(): Float32Array { throw new Error("ConfigStore.data is deprecated. Use WorldState.config directly."); }

    static setMaxSpeed(world: WorldState, id: number, speed: number) { /* unused in generated? */ }
    static setSpeedMultiplier(world: WorldState, id: number, value: number) { ConfigAccess.setSpeedMult(world, id, value); }
    static setMagnetRadius(world: WorldState, id: number, value: number) { ConfigAccess.setMagneticRadius(world, id, value); }

    static set(world: WorldState, id: number, magneticRadius: number, damageMult: number, speedMult: number, pickupRange: number, visionRange: number) {
        ConfigAccess.set(world, id, magneticRadius, damageMult, speedMult, pickupRange, visionRange);
    }
}

export class SkillStore {
    static readonly STRIDE = STRIDES.SKILL;
    static get data(): Float32Array { throw new Error("SkillStore.data is deprecated. Use WorldState.skill directly."); }

    static update(dt: number) { /* Global update logic moved to System? This store just proxies data */ }

    // Required by legacy usage
    static set(world: WorldState, id: number, cooldown: number, maxCooldown: number, activeTimer: number): void {
        SkillAccess.set(world, id, cooldown, maxCooldown, activeTimer, 0);
    }

    static setCooldown(world: WorldState, id: number, val: number) { SkillAccess.setCooldown(world, id, val); }
    static setMaxCooldown(world: WorldState, id: number, val: number) { SkillAccess.setMaxCooldown(world, id, val); }
    static setActiveTimer(world: WorldState, id: number, val: number) { SkillAccess.setActiveTimer(world, id, val); }
}

export class ProjectileStore {
    static readonly STRIDE = STRIDES.PROJECTILE;
    static get data(): Float32Array { throw new Error("ProjectileStore.data is deprecated. Use WorldState.projectile directly."); }
    static set(world: WorldState, id: number, ownerId: number, damage: number, duration: number, typeId: number): void {
        ProjectileAccess.set(world, id, ownerId, damage, duration, typeId);
    }
}

export class PigmentStore {
    static readonly STRIDE = STRIDES.PIGMENT;
    // Helper constants for array access (Legacy code uses [idx + R], etc.)
    static readonly R = 0;
    static readonly G = 1;
    static readonly B = 2;
    static readonly MATCH = 3;

    static get data(): Float32Array { throw new Error("PigmentStore.data is deprecated. Use WorldState.pigment directly."); }

    static getColorInt(world: WorldState, id: number): number {
        const r = Math.floor(PigmentAccess.getR(world, id) * 255);
        const g = Math.floor(PigmentAccess.getG(world, id) * 255);
        const b = Math.floor(PigmentAccess.getB(world, id) * 255);
        return (r << 16) | (g << 8) | b;
    }

    static getMatch(world: WorldState, id: number): number {
        return PigmentAccess.getMatchPercent(world, id);
    }

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
    // Legacy flags support
    private static _flags = new Uint8Array(MAX_ENTITIES);

    static get flags(): Uint8Array {
        return this._flags;
    }

    // New Float32 data from WorldState
    static get data(): Float32Array {
        throw new Error("TattooStore.data is deprecated. Use WorldState.tattoo directly.");
    }
}

/**
 * Reset all stores
 * @deprecated Use defaultWorld.reset()
 */
export function resetAllStores(): void {
    defaultWorld.reset();
}
