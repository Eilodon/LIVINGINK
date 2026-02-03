/**
 * @eidolon/engine - ProtocolSchema
 *
 * Schema-based packet encoding for Smart Lane networking.
 * Enables dynamic serialization of game-specific components.
 */

import type { IComponentSchema, ComponentFieldType } from '../interfaces/IComponent';

/**
 * Packet types for different data categories
 */
export enum SchemaPacketType {
    // Fast Lane - High frequency, small size
    TRANSFORM_UPDATE = 0x01,
    PHYSICS_UPDATE = 0x02,

    // Smart Lane - Event-driven, variable size
    COMPONENT_DELTA = 0x10,
    ENTITY_SPAWN = 0x11,
    ENTITY_DESTROY = 0x12,
    EVENT_SIGNAL = 0x13,

    // Control packets
    HEARTBEAT = 0xF0,
    ACK = 0xF1,
}

/**
 * Field encoding specification
 */
export interface IFieldEncoding {
    type: ComponentFieldType;
    offset: number;
    bits?: number; // For bit-packed fields
}

/**
 * Component encoding schema for network serialization
 */
export interface INetworkComponentSchema {
    /** Component ID */
    id: string;

    /** Packet type for this component */
    packetType: SchemaPacketType;

    /** Fields to encode */
    fields: IFieldEncoding[];

    /** Total bytes per entity for this component */
    byteSize: number;

    /** Compression mode */
    compression?: 'none' | 'delta' | 'bitpack';

    /** Priority for packet scheduling */
    priority: number;

    /** Maximum send rate (Hz) */
    maxRateHz: number;
}

/**
 * Protocol Schema Registry
 *
 * Manages network serialization schemas for all components.
 * Allows game modules to register their own network formats.
 */
export class ProtocolSchema {
    private schemas = new Map<string, INetworkComponentSchema>();
    private typeToComponent = new Map<SchemaPacketType, string>();

    /**
     * Register a network component schema
     */
    register(schema: INetworkComponentSchema): void {
        this.schemas.set(schema.id, schema);
        this.typeToComponent.set(schema.packetType, schema.id);
    }

    /**
     * Get schema by component ID
     */
    getSchema(componentId: string): INetworkComponentSchema | undefined {
        return this.schemas.get(componentId);
    }

    /**
     * Get schema by packet type
     */
    getSchemaByType(type: SchemaPacketType): INetworkComponentSchema | undefined {
        const id = this.typeToComponent.get(type);
        return id ? this.schemas.get(id) : undefined;
    }

    /**
     * Check if component has a network schema
     */
    hasSchema(componentId: string): boolean {
        return this.schemas.has(componentId);
    }

    /**
     * Get all registered schemas
     */
    getAllSchemas(): INetworkComponentSchema[] {
        return Array.from(this.schemas.values());
    }

    /**
     * Generate default network schema from component schema
     */
    static fromComponentSchema(
        componentSchema: IComponentSchema,
        packetType: SchemaPacketType,
        options: {
            priority?: number;
            maxRateHz?: number;
            compression?: 'none' | 'delta' | 'bitpack';
        } = {}
    ): INetworkComponentSchema {
        const fields: IFieldEncoding[] = componentSchema.fields.map((field) => ({
            type: field.type,
            offset: field.offset,
        }));

        return {
            id: componentSchema.id,
            packetType,
            fields,
            byteSize: componentSchema.stride,
            compression: options.compression ?? 'none',
            priority: options.priority ?? 1,
            maxRateHz: options.maxRateHz ?? 20,
        };
    }
}

/**
 * Global protocol schema instance
 */
let globalSchema: ProtocolSchema | null = null;

export function getProtocolSchema(): ProtocolSchema {
    if (!globalSchema) {
        globalSchema = new ProtocolSchema();
    }
    return globalSchema;
}

export function resetProtocolSchema(): void {
    globalSchema = null;
}
