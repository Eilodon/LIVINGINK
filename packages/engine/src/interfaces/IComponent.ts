/**
 * @eidolon/engine - IComponent Interface
 *
 * Component schema definitions for Data-Oriented Design.
 * Components are pure data containers with no logic.
 */

/**
 * Supported field types for component data.
 * Maps to TypedArray element types.
 */
export type ComponentFieldType =
    | 'f32'   // Float32 - positions, velocities, percentages
    | 'f64'   // Float64 - high precision (rarely needed)
    | 'i8'    // Int8 - small signed integers
    | 'u8'    // Uint8 - flags, small counters
    | 'i16'   // Int16 - medium signed integers
    | 'u16'   // Uint16 - entity IDs, medium counters
    | 'i32'   // Int32 - large signed integers
    | 'u32';  // Uint32 - bitmasks, large counters

/**
 * Byte size for each field type.
 */
export const FIELD_TYPE_SIZE: Record<ComponentFieldType, number> = {
    f32: 4,
    f64: 8,
    i8: 1,
    u8: 1,
    i16: 2,
    u16: 2,
    i32: 4,
    u32: 4,
};

/**
 * TypedArray constructor for each field type.
 */
export const FIELD_TYPE_ARRAY: Record<ComponentFieldType, TypedArrayConstructor> = {
    f32: Float32Array,
    f64: Float64Array,
    i8: Int8Array,
    u8: Uint8Array,
    i16: Int16Array,
    u16: Uint16Array,
    i32: Int32Array,
    u32: Uint32Array,
};

type TypedArrayConstructor =
    | Float32ArrayConstructor
    | Float64ArrayConstructor
    | Int8ArrayConstructor
    | Uint8ArrayConstructor
    | Int16ArrayConstructor
    | Uint16ArrayConstructor
    | Int32ArrayConstructor
    | Uint32ArrayConstructor;

/**
 * Field definition within a component schema.
 */
export interface IComponentField {
    /** Field name (e.g., "x", "y", "health") */
    name: string;

    /** Data type */
    type: ComponentFieldType;

    /** Byte offset within component stride */
    offset: number;

    /** Default value when entity is created */
    default?: number;

    /** Human-readable description (for tools) */
    description?: string;

    /** Min value constraint (for validation/tools) */
    min?: number;

    /** Max value constraint (for validation/tools) */
    max?: number;
}

/**
 * Component schema definition.
 * Describes the data layout for a component type.
 */
export interface IComponentSchema {
    /** Unique component identifier (e.g., "Transform", "Physics") */
    id: string;

    /** Human-readable name for tools */
    displayName?: string;

    /** Component description */
    description?: string;

    /** Field definitions */
    fields: IComponentField[];

    /** Total bytes per entity (with padding for alignment) */
    stride: number;

    /** Override max entities for this component (default: global MAX_ENTITIES) */
    maxEntities?: number;

    /** Is this component required for all entities? */
    required?: boolean;

    /** Tags for categorization (e.g., ["physics", "core"]) */
    tags?: string[];
}

/**
 * Runtime component store instance.
 * Holds the actual TypedArray data for a component type.
 */
export interface IComponentStore<T extends TypedArray = TypedArray> {
    /** Schema this store implements */
    readonly schema: IComponentSchema;

    /** Primary data array */
    readonly data: T;

    /** Additional typed arrays for non-f32 fields */
    readonly auxiliaryData?: Map<string, TypedArray>;

    /** Number of active entities using this component */
    activeCount: number;

    /** Get field value for entity */
    get(entityId: number, fieldName: string): number;

    /** Set field value for entity */
    set(entityId: number, fieldName: string, value: number): void;

    /** Reset entity's component data to defaults */
    reset(entityId: number): void;

    /** Copy component data from one entity to another */
    copy(sourceId: number, targetId: number): void;
}

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
 * Helper to calculate stride with proper alignment.
 * Ensures stride is aligned to largest field type.
 */
export function calculateAlignedStride(fields: IComponentField[]): number {
    if (fields.length === 0) return 0;

    // Find largest field size for alignment
    let maxFieldSize = 0;
    let totalSize = 0;

    for (const field of fields) {
        const size = FIELD_TYPE_SIZE[field.type];
        maxFieldSize = Math.max(maxFieldSize, size);
        totalSize = Math.max(totalSize, field.offset + size);
    }

    // Align to largest field size (or 4 bytes minimum)
    const alignment = Math.max(4, maxFieldSize);
    return Math.ceil(totalSize / alignment) * alignment;
}

/**
 * Validate component schema for correctness.
 */
export function validateComponentSchema(schema: IComponentSchema): string[] {
    const errors: string[] = [];

    if (!schema.id || schema.id.length === 0) {
        errors.push('Component must have an id');
    }

    if (!schema.fields || schema.fields.length === 0) {
        errors.push('Component must have at least one field');
    }

    // Check for overlapping fields
    const fieldRanges: Array<{ name: string; start: number; end: number }> = [];
    for (const field of schema.fields) {
        const size = FIELD_TYPE_SIZE[field.type];
        const start = field.offset;
        const end = start + size;

        for (const existing of fieldRanges) {
            if (start < existing.end && end > existing.start) {
                errors.push(
                    `Field "${field.name}" overlaps with "${existing.name}"`
                );
            }
        }

        fieldRanges.push({ name: field.name, start, end });

        // Check stride
        if (end > schema.stride) {
            errors.push(
                `Field "${field.name}" extends beyond stride (offset ${field.offset} + ${size} > stride ${schema.stride})`
            );
        }
    }

    return errors;
}
