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
        return defaultWorld.transform;
    }

    static getX(id: number): number {
        return TransformAccess.getX(defaultWorld, id);
    }

    static getY(id: number): number {
        return TransformAccess.getY(defaultWorld, id);
    }

    static set(id: number, x: number, y: number, rotation: number, scale: number = 1): void {
        // Init prev values to current values
        TransformAccess.set(defaultWorld, id, x, y, rotation, scale, x, y, rotation);
    }

    static setPosition(id: number, x: number, y: number): void {
        TransformAccess.setX(defaultWorld, id, x);
        TransformAccess.setY(defaultWorld, id, y);
    }
}

export class PhysicsStore {
    static readonly STRIDE = STRIDES.PHYSICS;

    static get data(): Float32Array {
        return defaultWorld.physics;
    }

    static getVx(id: number): number {
        return PhysicsAccess.getVx(defaultWorld, id);
    }

    static getVy(id: number): number {
        return PhysicsAccess.getVy(defaultWorld, id);
    }

    static getRadius(id: number): number {
        return PhysicsAccess.getRadius(defaultWorld, id);
    }

    static getVelocityX(id: number): number {
        return PhysicsAccess.getVx(defaultWorld, id);
    }

    static getVelocityY(id: number): number {
        return PhysicsAccess.getVy(defaultWorld, id);
    }

    static set(id: number, vx: number, vy: number, mass: number, radius: number, restitution: number = 0.5, friction: number = 0.9): void {
        PhysicsAccess.set(defaultWorld, id, vx, vy, 0, mass, radius, restitution, friction);
    }

    static setVelocity(id: number, vx: number, vy: number): void {
        PhysicsAccess.setVx(defaultWorld, id, vx);
        PhysicsAccess.setVy(defaultWorld, id, vy);
    }

    static setRadius(id: number, radius: number): void {
        PhysicsAccess.setRadius(defaultWorld, id, radius);
    }
}

export class StatsStore {
    static readonly STRIDE = STRIDES.STATS;

    static get data(): Float32Array {
        return defaultWorld.stats;
    }

    static getCurrentHealth(id: number): number {
        return StatsAccess.getHp(defaultWorld, id);
    }

    static getMaxHealth(id: number): number {
        return StatsAccess.getMaxHp(defaultWorld, id);
    }

    static getScore(id: number): number {
        return StatsAccess.getScore(defaultWorld, id);
    }

    static getMatchPercent(id: number): number {
        return StatsAccess.getMatchPercent(defaultWorld, id);
    }

    static getDamageMultiplier(id: number): number {
        return StatsAccess.getDamageMultiplier(defaultWorld, id);
    }

    static set(id: number, hp: number, maxHp: number, score: number, matchPercent: number, defense: number, damageMultiplier: number): void {
        StatsAccess.set(defaultWorld, id, hp, maxHp, score, matchPercent, defense, damageMultiplier);
    }

    static setCurrentHealth(id: number, value: number): void {
        StatsAccess.setHp(defaultWorld, id, value);
    }

    static setMaxHealth(id: number, value: number): void {
        StatsAccess.setMaxHp(defaultWorld, id, value);
    }
}

export class StateStore {
    static get flags(): Uint8Array {
        return defaultWorld.stateFlags;
    }

    static get data(): Uint8Array {
        return defaultWorld.stateFlags;
    }

    static isActive(id: number): boolean {
        return StateAccess.isActive(defaultWorld, id);
    }

    static hasFlag(id: number, flag: number): boolean {
        return StateAccess.hasFlag(defaultWorld, id, flag);
    }

    static setFlag(id: number, flag: number): void {
        StateAccess.setFlag(defaultWorld, id, flag);
    }

    static clearFlag(id: number, flag: number): void {
        StateAccess.clearFlag(defaultWorld, id, flag);
    }
}

export class InputStore {
    static readonly STRIDE = STRIDES.INPUT;

    static get data(): Float32Array {
        return defaultWorld.input;
    }

    static setTarget(id: number, x: number, y: number): void {
        InputAccess.setTargetX(defaultWorld, id, x);
        InputAccess.setTargetY(defaultWorld, id, y);
    }

    static getTarget(id: number, out: { x: number, y: number }): void {
        out.x = InputAccess.getTargetX(defaultWorld, id);
        out.y = InputAccess.getTargetY(defaultWorld, id);
    }

    static setAction(id: number, bit: number, active: boolean): void {
        let actions = defaultWorld.inputView.getUint32(id * STRIDES.INPUT * 4 + 8, true);
        if (active) actions |= (1 << bit);
        else actions &= ~(1 << bit);
        defaultWorld.inputView.setUint32(id * STRIDES.INPUT * 4 + 8, actions, true);
    }

    static isActionActive(id: number, bit: number): boolean {
        let actions = defaultWorld.inputView.getUint32(id * STRIDES.INPUT * 4 + 8, true);
        return (actions & (1 << bit)) !== 0;
    }
}

export class ConfigStore {
    static readonly STRIDE = STRIDES.CONFIG;
    static get data(): Float32Array { return defaultWorld.config; }

    static setMaxSpeed(id: number, speed: number) { /* unused in generated? */ }
    static setSpeedMultiplier(id: number, value: number) { ConfigAccess.setSpeedMult(defaultWorld, id, value); }
    static setMagnetRadius(id: number, value: number) { ConfigAccess.setMagneticRadius(defaultWorld, id, value); }

    static set(id: number, maxSpeed: number, speedMult: number, magnetRadius: number) {
        // Reuse magnet radius as maxSpeed if needed, or update schema
        ConfigAccess.setSpeedMult(defaultWorld, id, speedMult);
        ConfigAccess.setMagneticRadius(defaultWorld, id, magnetRadius);
    }
}

export class SkillStore {
    static readonly STRIDE = STRIDES.SKILL;
    static get data(): Float32Array { return defaultWorld.skill; }

    static update(dt: number) { /* Global update logic moved to System? This store just proxies data */ }

    // Required by legacy usage
    static set(id: number, cooldown: number, maxCooldown: number, activeTimer: number): void {
        SkillAccess.set(defaultWorld, id, cooldown, maxCooldown, activeTimer, 0);
    }

    static setCooldown(id: number, val: number) { SkillAccess.setCooldown(defaultWorld, id, val); }
    static setMaxCooldown(id: number, val: number) { SkillAccess.setMaxCooldown(defaultWorld, id, val); }
    static setActiveTimer(id: number, val: number) { SkillAccess.setActiveTimer(defaultWorld, id, val); }
}

export class ProjectileStore {
    static readonly STRIDE = STRIDES.PROJECTILE;
    static get data(): Float32Array { return defaultWorld.projectile; }
    static set(id: number, ownerId: number, damage: number, duration: number, typeId: number): void {
        ProjectileAccess.set(defaultWorld, id, ownerId, damage, duration, typeId);
    }
}

export class PigmentStore {
    static readonly STRIDE = STRIDES.PIGMENT;
    // Helper constants for array access (Legacy code uses [idx + R], etc.)
    static readonly R = 0;
    static readonly G = 1;
    static readonly B = 2;
    static readonly MATCH = 3;

    static get data(): Float32Array { return defaultWorld.pigment; }

    static getColorInt(id: number): number {
        const r = Math.floor(PigmentAccess.getR(defaultWorld, id) * 255);
        const g = Math.floor(PigmentAccess.getG(defaultWorld, id) * 255);
        const b = Math.floor(PigmentAccess.getB(defaultWorld, id) * 255);
        return (r << 16) | (g << 8) | b;
    }

    static getMatch(id: number): number {
        return PigmentAccess.getMatchPercent(defaultWorld, id);
    }

    static set(id: number, r: number, g: number, b: number): void {
        PigmentAccess.setR(defaultWorld, id, r);
        PigmentAccess.setG(defaultWorld, id, g);
        PigmentAccess.setB(defaultWorld, id, b);
    }

    static mix(id: number, r: number, g: number, b: number, ratio: number): void {
        const currentR = PigmentAccess.getR(defaultWorld, id);
        const currentG = PigmentAccess.getG(defaultWorld, id);
        const currentB = PigmentAccess.getB(defaultWorld, id);

        PigmentAccess.setR(defaultWorld, id, currentR + (r - currentR) * ratio);
        PigmentAccess.setG(defaultWorld, id, currentG + (g - currentG) * ratio);
        PigmentAccess.setB(defaultWorld, id, currentB + (b - currentB) * ratio);
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
        return defaultWorld.tattoo;
    }
}

/**
 * Reset all stores
 * @deprecated Use defaultWorld.reset()
 */
export function resetAllStores(): void {
    defaultWorld.reset();
}
