/**
 * @cjr/engine - TattooEntityAdapter
 * 
 * Zero-allocation adapter for reading DOD data into ITattooEntity interface.
 * Uses object pooling pattern - bind once, reuse forever.
 * 
 * CRITICAL: Do NOT create new instances per-frame. Use the singleton.
 */

import type { WorldState } from '../../generated/WorldState.js';
import { TransformAccess, PigmentAccess, StatsAccess, StateAccess } from '../../generated/ComponentAccessors.js';
import { TattooId, type PigmentVec3 } from './types.js';
import { StatusFlag, TattooFlag, type ITattooEntity, type ITattooFood } from './tattoos.js';
import { getRingAtPosition } from './ringSystem.js';

/**
 * Reusable adapter that implements ITattooEntity interface.
 * Binds to a DOD entity index and reads values on-demand.
 * 
 * @example
 * ```typescript
 * // CORRECT: Use singleton, zero allocations
 * const adapter = tattooEntityAdapter.bindToEntity(world, entityId);
 * triggerTattooOnUpdate(adapter, dt);
 * adapter.flushToDOD(world, entityId); // Commit changes
 * 
 * // WRONG: Creating new adapter per frame = GC churn
 * const bad = new TattooEntityAdapter().bindToEntity(world, entityId);
 * ```
 */
export class TattooEntityAdapter implements ITattooEntity {
    // Pre-allocated nested objects (single allocation at construction time)
    readonly position: { x: number; y: number } = { x: 0, y: 0 };
    readonly pigment: PigmentVec3 = { r: 0, g: 0, b: 0 };
    readonly targetPigment: PigmentVec3 = { r: 0, g: 0, b: 0 };

    // ITattooEntity required fields
    physicsIndex: number = 0;
    ring: 1 | 2 | 3 = 1;
    matchPercent: number = 0;
    color: number = 0;
    isDead: boolean = false;
    tattoos: TattooId[] = [];
    tattooFlags: number = 0;
    statusFlags: number = 0;

    // Pre-allocated status tracking objects
    readonly statusScalars: Record<string, number> = {};
    readonly statusMultipliers: Record<string, number> = {};
    readonly statusTimers: Record<string, number> = {};

    // Optional fields
    lifesteal?: number;
    reviveAvailable?: boolean;
    skillCooldownMultiplier?: number;

    // Internal tracking
    private boundId: number = -1;

    /**
     * Bind adapter to a DOD entity. Reads current values into pre-allocated objects.
     * 
     * MUTATES in place - ZERO ALLOCATION.
     * 
     * @returns this (for chaining)
     */
    bindToEntity(world: WorldState, id: number): this {
        this.boundId = id;
        this.physicsIndex = id;

        // Read Transform
        this.position.x = TransformAccess.getX(world, id);
        this.position.y = TransformAccess.getY(world, id);

        // Read Pigment (current color)
        this.pigment.r = PigmentAccess.getR(world, id);
        this.pigment.g = PigmentAccess.getG(world, id);
        this.pigment.b = PigmentAccess.getB(world, id);

        // Read Target Pigment
        this.targetPigment.r = PigmentAccess.getTargetR(world, id);
        this.targetPigment.g = PigmentAccess.getTargetG(world, id);
        this.targetPigment.b = PigmentAccess.getTargetB(world, id);

        // Read Match Percent and Color Int from PigmentAccess
        this.matchPercent = PigmentAccess.getMatchPercent(world, id);
        this.color = PigmentAccess.getColorInt(world, id);

        // Read Stats for HP check
        const hp = StatsAccess.getHp(world, id);
        this.isDead = hp <= 0;

        // Compute ring from position (not stored in DOD)
        this.ring = getRingAtPosition(this.position.x, this.position.y);

        // State flags are in StateAccess (entity state flags)
        // Note: Tattoo flags are stored separately, but currently tattoos are tracked in OOP array
        // This adapter bridges between OOP tattoos[] and DOD stores

        return this;
    }

    /**
     * Write modified values back to DOD stores.
     * Call after tattoo logic has mutated this adapter.
     */
    flushToDOD(world: WorldState, id: number): void {
        if (id !== this.boundId) {
            console.warn('[TattooEntityAdapter] Flush ID mismatch. Bound:', this.boundId, 'Flush:', id);
        }

        // Write Pigment changes back (individual setters, no allocation)
        PigmentAccess.setR(world, id, this.pigment.r);
        PigmentAccess.setG(world, id, this.pigment.g);
        PigmentAccess.setB(world, id, this.pigment.b);

        // Write computed color back
        PigmentAccess.setColorInt(world, id, this.color);

        // Note: matchPercent should be recomputed via calcMatchPercent, not written directly
        // Tattoo flags are not in DOD; they're in the OOP entity.tattoos array
    }

    /**
     * Reset adapter state for next use.
     * Call before binding to a new entity if reusing across entities in same frame.
     */
    reset(): void {
        this.boundId = -1;
        this.physicsIndex = 0;
        this.position.x = 0;
        this.position.y = 0;
        this.pigment.r = 0;
        this.pigment.g = 0;
        this.pigment.b = 0;
        this.targetPigment.r = 0;
        this.targetPigment.g = 0;
        this.targetPigment.b = 0;
        this.ring = 1;
        this.matchPercent = 0;
        this.color = 0;
        this.isDead = false;
        this.tattoos.length = 0;
        this.tattooFlags = 0;
        this.statusFlags = 0;

        // Clear dynamic records without creating new objects
        for (const key in this.statusScalars) delete this.statusScalars[key];
        for (const key in this.statusMultipliers) delete this.statusMultipliers[key];
        for (const key in this.statusTimers) delete this.statusTimers[key];

        this.lifesteal = undefined;
        this.reviveAvailable = undefined;
        this.skillCooldownMultiplier = undefined;
    }
}

/**
 * Singleton instance for zero-allocation usage.
 * 
 * @example
 * ```typescript
 * import { tattooEntityAdapter } from './TattooEntityAdapter.js';
 * 
 * for (const id of activeEntities) {
 *     const entity = tattooEntityAdapter.bindToEntity(world, id);
 *     triggerTattooOnUpdate(entity, dt);
 *     entity.flushToDOD(world, id);
 * }
 * ```
 */
export const tattooEntityAdapter = new TattooEntityAdapter();

/**
 * Object pool for multi-entity scenarios (e.g., onHit with victim + attacker).
 * Pre-allocates 4 adapters to handle common cases.
 */
export class TattooEntityPool {
    private pool: TattooEntityAdapter[] = [];
    private index: number = 0;

    constructor(size: number = 4) {
        for (let i = 0; i < size; i++) {
            this.pool.push(new TattooEntityAdapter());
        }
    }

    /**
     * Get next adapter from pool. Cycles through pool.
     */
    acquire(): TattooEntityAdapter {
        const adapter = this.pool[this.index];
        this.index = (this.index + 1) % this.pool.length;
        return adapter;
    }

    /**
     * Reset pool index (call at start of frame)
     */
    resetPool(): void {
        this.index = 0;
    }
}

export const tattooEntityPool = new TattooEntityPool(4);
