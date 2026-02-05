/**
 * @cjr/engine - Entity Lookup Interface
 * 
 * Abstraction for entity ID → entity object mapping.
 * Client implements with JS objects, server can implement differently.
 */

/**
 * Minimal entity interface for engine operations
 */
export interface IEngineEntity {
    id: string;
    physicsIndex?: number;
    position: { x: number; y: number };
    velocity: { x: number; y: number };
    radius: number;
    isDead: boolean;
}

/**
 * Entity lookup interface - abstracts how entities are resolved from indices
 * 
 * @example
 * // Client implementation
 * const lookup: IEntityLookup = {
 *   get: (index) => EntityLookup[index],
 *   set: (index, entity) => { EntityLookup[index] = entity; },
 *   clear: (index) => { EntityLookup[index] = null; },
 * };
 * 
 * // Server implementation (could use Map for sparse IDs)
 * const serverLookup: IEntityLookup = {
 *   get: (index) => entityMap.get(index),
 *   set: (index, entity) => entityMap.set(index, entity),
 *   clear: (index) => entityMap.delete(index),
 * };
 */
export interface IEntityLookup {
    /**
     * Get entity by physics index
     */
    get(index: number): IEngineEntity | null | undefined;

    /**
     * Set entity at physics index
     */
    set(index: number, entity: IEngineEntity | null): void;

    /**
     * Clear entity at index (release)
     */
    clear(index: number): void;

    /**
     * Get total capacity (optional)
     */
    capacity?: number;
}

/**
 * Create an array-backed entity lookup (default implementation)
 */
export function createArrayLookup(maxEntities: number = 4096): IEntityLookup {
    const lookup: (IEngineEntity | null)[] = new Array(maxEntities).fill(null);

    return {
        get: (index: number) => lookup[index],
        set: (index: number, entity: IEngineEntity | null) => {
            lookup[index] = entity;
        },
        clear: (index: number) => {
            lookup[index] = null;
        },
        capacity: maxEntities,
    };
}

/**
 * Create a Map-backed entity lookup (for sparse indices)
 */
export function createMapLookup(): IEntityLookup {
    const map = new Map<number, IEngineEntity>();

    return {
        get: (index: number) => map.get(index),
        set: (index: number, entity: IEngineEntity | null) => {
            if (entity) {
                map.set(index, entity);
            } else {
                map.delete(index);
            }
        },
        clear: (index: number) => {
            map.delete(index);
        },
    };
}
