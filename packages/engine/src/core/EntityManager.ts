/**
 * @cjr/engine - EntityManager
 * Non-singleton entity lifecycle manager for multi-room support
 * 
 * EIDOLON-V: Moved from client to engine for shared use
 * Server: instantiate per-room
 * Client: wrap with singleton pattern for backward compat
 */

import { MAX_ENTITIES } from '../generated/WorldState';

/**
 * Generational Index Handle
 * Prevents ABA problem when entity IDs are reused
 */
export interface EntityHandle {
    index: number;
    generation: number;
}

/**
 * EntityManager - Non-singleton entity allocator
 * 
 * Features:
 * - Free list recycling with O(1) alloc/free
 * - Generational indices for stale reference detection
 * - TypedArrays for cache-friendly traversal
 */
export class EntityManager {
    // Free list using a simple stack array
    private freeIndices: Int32Array;
    private freeHead: number; // pointer to top of stack

    // Generation counter per slot (ABA protection)
    private generations: Uint16Array;

    public count: number = 0;

    private minId: number;
    private maxId: number;

    constructor(minId: number = 0, maxId: number = MAX_ENTITIES) {
        this.minId = minId;
        this.maxId = maxId;
        this.freeIndices = new Int32Array(MAX_ENTITIES);
        this.generations = new Uint16Array(MAX_ENTITIES); // Init to 0
        this.freeHead = 0;

        this.reset();
    }

    /**
     * Set the allocation range for this manager
     * Useful for partitioning IDs between Server (0-5000) and Client (5000-10000)
     */
    public setAllocationRange(min: number, max: number): void {
        this.minId = min;
        this.maxId = max;
        this.reset();
    }

    /**
     * Allocate a new entity index
     * @returns entity index, or -1 if pool exhausted
     */
    public createEntity(): number {
        if (this.freeHead <= 0) {
            console.warn('EntityManager: Max entities reached!');
            return -1;
        }

        const index = this.freeIndices[--this.freeHead];
        this.count++;
        return index;
    }

    /**
     * Allocate entity with generational handle
     * Use for systems that need to detect stale references
     */
    public createEntityHandle(): EntityHandle | null {
        if (this.freeHead <= 0) {
            console.warn('EntityManager: Max entities reached!');
            return null;
        }

        const index = this.freeIndices[--this.freeHead];
        this.count++;
        return { index, generation: this.generations[index] };
    }

    /**
     * Release entity index for recycling
     * Increments generation to invalidate stale handles
     */
    public removeEntity(id: number): void {
        if (this.count <= 0) return;
        if (id < this.minId || id >= this.maxId) {
            console.warn(`EntityManager: Attempted to free ID ${id} out of range [${this.minId}, ${this.maxId})`);
            return;
        }

        // Increment generation on removal (ABA protection)
        this.generations[id]++;

        this.freeIndices[this.freeHead++] = id;
        this.count--;
    }

    /**
     * Check if entity handle is still valid
     * @returns false if entity was recycled since handle was created
     */
    public isValid(handle: EntityHandle): boolean {
        if (handle.index < 0 || handle.index >= MAX_ENTITIES) return false;
        return this.generations[handle.index] === handle.generation;
    }

    /**
     * Get current generation for an entity index
     */
    public getGeneration(index: number): number {
        return this.generations[index];
    }

    /**
     * Reset manager to initial state
     * Note: generations are NOT reset - stale handles remain invalid
     */
    public reset(): void {
        this.count = 0;
        const range = this.maxId - this.minId;
        this.freeHead = range;

        // Fill free list with IDs in range [minId, maxId)
        // Reverse order so we pop minId first
        for (let i = 0; i < range; i++) {
            this.freeIndices[i] = this.maxId - 1 - i;
        }
    }
}
