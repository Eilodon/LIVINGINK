/**
 * @eidolon/engine - ComponentRegistry
 *
 * Dynamic component registration and storage management.
 * Allows game modules to register their own component types at runtime.
 */

import {
    type IComponentSchema,
    type IComponentField,
    FIELD_TYPE_SIZE,
    FIELD_TYPE_ARRAY,
    validateComponentSchema,
} from '../interfaces/IComponent.js';
import { MAX_ENTITIES } from '../generated/WorldState.js';

/**
 * Typed array union for component stores.
 */
type TypedArray =
    | Float32Array
    | Float64Array
    | Int8Array
    | Uint8Array
    | Int16Array
    | Uint16Array
    | Int32Array
    | Uint32Array;

/**
 * Runtime component store with typed accessors.
 */
export interface IRegisteredStore {
    /** Schema definition */
    schema: IComponentSchema;
    /** Primary data array (Float32Array for most components) */
    data: TypedArray;
    /** Field lookup for fast access */
    fieldOffsets: Map<string, { offset: number; type: string }>;
    /** Number of elements per entity */
    elementsPerEntity: number;
}

/**
 * ComponentRegistry manages dynamic component registration.
 *
 * Key features:
 * - Register component schemas at runtime
 * - Allocate TypedArray storage
 * - Provide typed accessors for fields
 * - Support module hot-reload (future)
 *
 * @example
 * ```ts
 * const registry = new ComponentRegistry();
 *
 * // Register a custom component
 * registry.register({
 *   id: 'Pigment',
 *   fields: [
 *     { name: 'r', type: 'f32', offset: 0 },
 *     { name: 'g', type: 'f32', offset: 4 },
 *     { name: 'b', type: 'f32', offset: 8 },
 *   ],
 *   stride: 12,
 * });
 *
 * // Get typed accessor
 * const pigment = registry.getStore('Pigment');
 * pigment.data[entityId * 3 + 0] = 1.0; // r
 * ```
 */
export class ComponentRegistry {
    /** Registered schemas */
    private schemas = new Map<string, IComponentSchema>();

    /** Allocated stores */
    private stores = new Map<string, IRegisteredStore>();

    /** Max entities (can be overridden per-component) */
    private readonly maxEntities: number;

    /** Is registry frozen? (no more registrations allowed) */
    private frozen = false;

    constructor(maxEntities: number = MAX_ENTITIES) {
        this.maxEntities = maxEntities;
    }

    /**
     * Register a component schema and allocate storage.
     *
     * @param schema Component schema definition
     * @throws Error if schema is invalid or already registered
     */
    register(schema: IComponentSchema): void {
        if (this.frozen) {
            throw new Error(
                `[ComponentRegistry] Cannot register "${schema.id}" - registry is frozen`
            );
        }

        if (this.schemas.has(schema.id)) {
            throw new Error(
                `[ComponentRegistry] Component "${schema.id}" is already registered`
            );
        }

        // Validate schema
        const errors = validateComponentSchema(schema);
        if (errors.length > 0) {
            throw new Error(
                `[ComponentRegistry] Invalid schema "${schema.id}": ${errors.join(', ')}`
            );
        }

        // Store schema
        this.schemas.set(schema.id, schema);

        // Allocate storage
        const store = this.allocateStore(schema);
        this.stores.set(schema.id, store);

        console.log(
            `[ComponentRegistry] Registered "${schema.id}" (${schema.fields.length} fields, ${schema.stride} bytes/entity)`
        );
    }

    /**
     * Register multiple schemas at once.
     *
     * @param schemas Array of component schemas
     */
    registerAll(schemas: IComponentSchema[]): void {
        for (const schema of schemas) {
            this.register(schema);
        }
    }

    /**
     * Check if a component is registered.
     *
     * @param id Component ID
     * @returns True if registered
     */
    has(id: string): boolean {
        return this.schemas.has(id);
    }

    /**
     * Get a component schema by ID.
     *
     * @param id Component ID
     * @returns Schema or undefined
     */
    getSchema(id: string): IComponentSchema | undefined {
        return this.schemas.get(id);
    }

    /**
     * Get a component store by ID.
     *
     * @param id Component ID
     * @returns Store or undefined
     */
    getStore(id: string): IRegisteredStore | undefined {
        return this.stores.get(id);
    }

    /**
     * Get typed data array for a component.
     * Convenience method for direct array access.
     *
     * @param id Component ID
     * @returns TypedArray or undefined
     */
    getData<T extends TypedArray = Float32Array>(id: string): T | undefined {
        return this.stores.get(id)?.data as T | undefined;
    }

    /**
     * Get all registered component IDs.
     *
     * @returns Array of component IDs
     */
    getRegisteredIds(): string[] {
        return Array.from(this.schemas.keys());
    }

    /**
     * Get all registered schemas.
     *
     * @returns Array of schemas
     */
    getAllSchemas(): IComponentSchema[] {
        return Array.from(this.schemas.values());
    }

    /**
     * Freeze the registry (no more registrations).
     * Call this after all modules are loaded.
     */
    freeze(): void {
        this.frozen = true;
        console.log(
            `[ComponentRegistry] Frozen with ${this.schemas.size} components`
        );
    }

    /**
     * Check if registry is frozen.
     */
    isFrozen(): boolean {
        return this.frozen;
    }

    /**
     * Reset all component data to zero.
     * Use for game reset.
     */
    resetAll(): void {
        for (const store of this.stores.values()) {
            store.data.fill(0);
        }
    }

    /**
     * Reset component data for a specific entity.
     *
     * @param entityId Entity index
     */
    resetEntity(entityId: number): void {
        for (const store of this.stores.values()) {
            const startIdx = entityId * store.elementsPerEntity;
            const endIdx = startIdx + store.elementsPerEntity;
            store.data.fill(0, startIdx, endIdx);
        }
    }

    /**
     * Get a field value for an entity.
     *
     * @param componentId Component ID
     * @param entityId Entity index
     * @param fieldName Field name
     * @returns Field value or undefined
     */
    getField(
        componentId: string,
        entityId: number,
        fieldName: string
    ): number | undefined {
        const store = this.stores.get(componentId);
        if (!store) return undefined;

        const fieldInfo = store.fieldOffsets.get(fieldName);
        if (!fieldInfo) return undefined;

        // Calculate array index
        // For Float32Array, offset is in bytes, so divide by 4
        const baseIdx = entityId * store.elementsPerEntity;
        const fieldIdx = baseIdx + fieldInfo.offset / 4;

        return store.data[fieldIdx];
    }

    /**
     * Set a field value for an entity.
     *
     * @param componentId Component ID
     * @param entityId Entity index
     * @param fieldName Field name
     * @param value Value to set
     */
    setField(
        componentId: string,
        entityId: number,
        fieldName: string,
        value: number
    ): void {
        const store = this.stores.get(componentId);
        if (!store) return;

        const fieldInfo = store.fieldOffsets.get(fieldName);
        if (!fieldInfo) return;

        const baseIdx = entityId * store.elementsPerEntity;
        const fieldIdx = baseIdx + fieldInfo.offset / 4;

        store.data[fieldIdx] = value;
    }

    /**
     * Allocate storage for a component schema.
     */
    private allocateStore(schema: IComponentSchema): IRegisteredStore {
        const maxEntities = schema.maxEntities ?? this.maxEntities;

        // Determine primary array type from first field (or default to Float32)
        const primaryType = schema.fields[0]?.type ?? 'f32';
        const ArrayConstructor = FIELD_TYPE_ARRAY[primaryType];

        // Calculate elements per entity (stride / element size)
        const elementSize = FIELD_TYPE_SIZE[primaryType];
        const elementsPerEntity = Math.ceil(schema.stride / elementSize);

        // Allocate array
        const data = new ArrayConstructor(maxEntities * elementsPerEntity);

        // Build field offset lookup
        const fieldOffsets = new Map<string, { offset: number; type: string }>();
        for (const field of schema.fields) {
            fieldOffsets.set(field.name, {
                offset: field.offset,
                type: field.type,
            });
        }

        return {
            schema,
            data: data as TypedArray,
            fieldOffsets,
            elementsPerEntity,
        };
    }

    /**
     * Get memory usage statistics.
     */
    getMemoryStats(): {
        totalBytes: number;
        componentStats: { id: string; bytes: number }[];
    } {
        let totalBytes = 0;
        const componentStats: { id: string; bytes: number }[] = [];

        for (const [id, store] of this.stores) {
            const bytes = store.data.byteLength;
            totalBytes += bytes;
            componentStats.push({ id, bytes });
        }

        return { totalBytes, componentStats };
    }
}

/**
 * Singleton instance for global access.
 * Note: For multi-game support, use separate instances.
 */
let globalRegistry: ComponentRegistry | null = null;

/**
 * Get the global ComponentRegistry instance.
 */
export function getComponentRegistry(): ComponentRegistry {
    if (!globalRegistry) {
        globalRegistry = new ComponentRegistry();
    }
    return globalRegistry;
}

/**
 * Reset the global registry (for testing).
 */
export function resetComponentRegistry(): void {
    globalRegistry = null;
}
