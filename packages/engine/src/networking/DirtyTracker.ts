/**
 * @eidolon/engine - DirtyTracker
 *
 * Tracks which entities and components have changed for efficient network sync.
 * Part of Smart Lane networking - only send what changed.
 */

import { MAX_ENTITIES } from '../generated/WorldState.js';

/**
 * Dirty bit masks for component categories
 */
export enum DirtyMask {
    NONE = 0,
    TRANSFORM = 1 << 0, // Position, rotation, scale
    PHYSICS = 1 << 1, // Velocity, mass, radius
    STATS = 1 << 2, // Health, score, matchPercent
    STATE = 1 << 3, // Flags, status
    SKILLS = 1 << 4, // Cooldowns, active skills
    CUSTOM = 1 << 8, // Game-specific components start here
}

/**
 * Dirty tracking entry for a single entity
 */
interface IDirtyEntry {
    /** Bitmask of dirty components */
    mask: number;
    /** Frame counter for age tracking */
    frame: number;
}

/**
 * DirtyTracker - Efficient change tracking for network sync
 *
 * Features:
 * - Bitmask-based dirty tracking per entity
 * - Automatic aging of dirty entries
 * - Efficient iteration of only dirty entities
 * - Component-specific filtering
 */
export class DirtyTracker {
    /** Per-entity dirty state */
    private dirtyStates: IDirtyEntry[];

    /** Current frame counter */
    private frame = 0;

    /** Maximum age before forcing sync (frames) */
    private maxAge: number;

    /** Cached list of currently dirty entities */
    private dirtyCache: number[] = [];

    /** Cache is stale and needs rebuild */
    private cacheStale = true;

    constructor(maxEntities: number = MAX_ENTITIES, maxAge: number = 60) {
        this.dirtyStates = new Array(maxEntities).fill(null).map(() => ({
            mask: DirtyMask.NONE,
            frame: 0,
        }));
        this.maxAge = maxAge;
    }

    /**
     * Mark an entity's components as dirty
     *
     * @param entityId Entity index
     * @param componentMask Bitmask of changed components
     */
    markDirty(entityId: number, componentMask: number): void {
        if (entityId < 0 || entityId >= this.dirtyStates.length) {
            return;
        }

        const entry = this.dirtyStates[entityId];
        entry.mask |= componentMask;
        entry.frame = this.frame;
        this.cacheStale = true;
    }

    /**
     * Mark specific component as dirty for an entity
     */
    markComponentDirty(entityId: number, component: DirtyMask): void {
        this.markDirty(entityId, component);
    }

    /**
     * Check if entity has any dirty components
     */
    isDirty(entityId: number): boolean {
        if (entityId < 0 || entityId >= this.dirtyStates.length) {
            return false;
        }
        return this.dirtyStates[entityId].mask !== DirtyMask.NONE;
    }

    /**
     * Check if specific component is dirty for entity
     */
    isComponentDirty(entityId: number, component: DirtyMask): boolean {
        if (entityId < 0 || entityId >= this.dirtyStates.length) {
            return false;
        }
        return (this.dirtyStates[entityId].mask & component) !== 0;
    }

    /**
     * Get dirty mask for entity
     */
    getDirtyMask(entityId: number): number {
        if (entityId < 0 || entityId >= this.dirtyStates.length) {
            return DirtyMask.NONE;
        }
        return this.dirtyStates[entityId].mask;
    }

    /**
     * Get all entities that have dirty components matching the mask
     *
     * @param componentMask Filter by component types (0 = any)
     * @returns Array of entity IDs
     */
    getDirtyEntities(componentMask: number = 0): number[] {
        // Use cached result if valid
        if (!this.cacheStale && componentMask === 0) {
            return [...this.dirtyCache];
        }

        const results: number[] = [];

        for (let i = 0; i < this.dirtyStates.length; i++) {
            const entry = this.dirtyStates[i];

            // Skip if not dirty
            if (entry.mask === DirtyMask.NONE) {
                continue;
            }

            // Check if matches component filter
            if (componentMask === 0 || (entry.mask & componentMask) !== 0) {
                results.push(i);
            }
        }

        // Update cache for unfiltered queries
        if (componentMask === 0) {
            this.dirtyCache = [...results];
            this.cacheStale = false;
        }

        return results;
    }

    /**
     * Clear dirty state for an entity
     */
    clearDirty(entityId: number): void {
        if (entityId < 0 || entityId >= this.dirtyStates.length) {
            return;
        }

        this.dirtyStates[entityId].mask = DirtyMask.NONE;
        this.cacheStale = true;
    }

    /**
     * Clear specific component dirty bit
     */
    clearComponentDirty(entityId: number, component: DirtyMask): void {
        if (entityId < 0 || entityId >= this.dirtyStates.length) {
            return;
        }

        this.dirtyStates[entityId].mask &= ~component;
        if (this.dirtyStates[entityId].mask === DirtyMask.NONE) {
            this.cacheStale = true;
        }
    }

    /**
     * Clear all dirty states
     */
    clearAll(): void {
        for (const entry of this.dirtyStates) {
            entry.mask = DirtyMask.NONE;
        }
        this.dirtyCache = [];
        this.cacheStale = false;
    }

    /**
     * Advance frame counter and age out old entries
     */
    tick(): void {
        this.frame++;

        // Force sync for entries that haven't been synced in maxAge frames
        for (let i = 0; i < this.dirtyStates.length; i++) {
            const entry = this.dirtyStates[i];
            const age = this.frame - entry.frame;

            if (age > this.maxAge && entry.mask !== DirtyMask.NONE) {
                // Keep it dirty but update frame to prevent immediate re-aging
                entry.frame = this.frame;
            }
        }
    }

    /**
     * Get count of dirty entities
     */
    getDirtyCount(): number {
        return this.getDirtyEntities().length;
    }

    /**
     * Get statistics for debugging
     */
    getStats(): {
        totalEntities: number;
        dirtyCount: number;
        byComponent: Record<string, number>;
    } {
        const byComponent: Record<string, number> = {
            Transform: 0,
            Physics: 0,
            Stats: 0,
            State: 0,
            Skills: 0,
            Custom: 0,
        };

        for (const entry of this.dirtyStates) {
            if (entry.mask & DirtyMask.TRANSFORM) byComponent.Transform++;
            if (entry.mask & DirtyMask.PHYSICS) byComponent.Physics++;
            if (entry.mask & DirtyMask.STATS) byComponent.Stats++;
            if (entry.mask & DirtyMask.STATE) byComponent.State++;
            if (entry.mask & DirtyMask.SKILLS) byComponent.Skills++;
            if (entry.mask & DirtyMask.CUSTOM) byComponent.Custom++;
        }

        return {
            totalEntities: this.dirtyStates.length,
            dirtyCount: this.getDirtyCount(),
            byComponent,
        };
    }
}

/**
 * Global dirty tracker instance
 */
let globalTracker: DirtyTracker | null = null;

export function getDirtyTracker(): DirtyTracker {
    if (!globalTracker) {
        globalTracker = new DirtyTracker();
    }
    return globalTracker;
}

export function resetDirtyTracker(): void {
    globalTracker = null;
}
