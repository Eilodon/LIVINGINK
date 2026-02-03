/**
 * @eidolon/engine - SchemaBinaryPacker
 *
 * Schema-based binary packet encoding with dirty tracking.
 * Smart Lane implementation - only sends changed data.
 */

import { ProtocolSchema, SchemaPacketType } from './ProtocolSchema';
import { DirtyTracker, DirtyMask } from './DirtyTracker';
import {
    TransformStore,
    PhysicsStore,
} from '../dod/ComponentStores';

/**
 * Packet buffer pool entry
 */
interface BufferPoolEntry {
    buffer: ArrayBuffer;
    view: DataView;
    u8: Uint8Array;
    inUse: boolean;
}

/**
 * SchemaBinaryPacker - Smart Lane packet encoding
 *
 * Encodes only dirty components for efficient network sync.
 * Uses ProtocolSchema for flexible component serialization.
 */
export class SchemaBinaryPacker {
    private static readonly POOL_SIZE = 4;
    private static readonly BUFFER_SIZE = 4096 * 32; // 128KB

    private static _pool: BufferPoolEntry[] = [];
    private static _poolInitialized = false;

    private schema: ProtocolSchema;
    private dirtyTracker: DirtyTracker;

    constructor(schema: ProtocolSchema, dirtyTracker: DirtyTracker) {
        this.schema = schema;
        this.dirtyTracker = dirtyTracker;
        this.initPool();
    }

    /**
     * Initialize buffer pool
     */
    private initPool(): void {
        if (SchemaBinaryPacker._poolInitialized) return;

        for (let i = 0; i < SchemaBinaryPacker.POOL_SIZE; i++) {
            const buffer = new ArrayBuffer(SchemaBinaryPacker.BUFFER_SIZE);
            SchemaBinaryPacker._pool.push({
                buffer,
                view: new DataView(buffer),
                u8: new Uint8Array(buffer),
                inUse: false,
            });
        }
        SchemaBinaryPacker._poolInitialized = true;
    }

    /**
     * Checkout buffer from pool
     */
    private checkoutBuffer(): BufferPoolEntry {
        for (const entry of SchemaBinaryPacker._pool) {
            if (!entry.inUse) {
                entry.inUse = true;
                return entry;
            }
        }

        // Pool exhausted - create temporary buffer
        const buffer = new ArrayBuffer(SchemaBinaryPacker.BUFFER_SIZE);
        return {
            buffer,
            view: new DataView(buffer),
            u8: new Uint8Array(buffer),
            inUse: true,
        };
    }

    /**
     * Return buffer to pool
     */
    private returnBuffer(entry: BufferPoolEntry): void {
        if (SchemaBinaryPacker._pool.includes(entry)) {
            entry.inUse = false;
        }
    }

    /**
     * Pack transform updates for dirty entities (Fast Lane)
     */
    packTransformUpdates(timestamp: number): ArrayBuffer | null {
        const dirtyEntities = this.dirtyTracker.getDirtyEntities(DirtyMask.TRANSFORM);

        if (dirtyEntities.length === 0) {
            return null;
        }

        const poolEntry = this.checkoutBuffer();
        const { buffer, view, u8 } = poolEntry;

        try {
            let offset = 0;

            // Header: Type (1) + Timestamp (4) + Count (2)
            u8[offset++] = SchemaPacketType.TRANSFORM_UPDATE;
            view.setFloat32(offset, timestamp, true);
            offset += 4;
            view.setUint16(offset, dirtyEntities.length, true);
            offset += 2;

            // Entity data: ID (2) + X (4) + Y (4)
            for (const entityId of dirtyEntities) {
                view.setUint16(offset, entityId, true);
                offset += 2;
                view.setFloat32(offset, TransformStore.getX(entityId), true);
                offset += 4;
                view.setFloat32(offset, TransformStore.getY(entityId), true);
                offset += 4;
            }

            return buffer.slice(0, offset);
        } finally {
            this.returnBuffer(poolEntry);
        }
    }

    /**
     * Pack physics updates for dirty entities (Fast Lane)
     */
    packPhysicsUpdates(timestamp: number): ArrayBuffer | null {
        const dirtyEntities = this.dirtyTracker.getDirtyEntities(DirtyMask.PHYSICS);

        if (dirtyEntities.length === 0) {
            return null;
        }

        const poolEntry = this.checkoutBuffer();
        const { buffer, view, u8 } = poolEntry;

        try {
            let offset = 0;

            // Header
            u8[offset++] = SchemaPacketType.PHYSICS_UPDATE;
            view.setFloat32(offset, timestamp, true);
            offset += 4;
            view.setUint16(offset, dirtyEntities.length, true);
            offset += 2;

            // Entity data: ID (2) + VX (4) + VY (4) + Radius (4)
            for (const entityId of dirtyEntities) {
                view.setUint16(offset, entityId, true);
                offset += 2;
                view.setFloat32(offset, PhysicsStore.getVelocityX(entityId), true);
                offset += 4;
                view.setFloat32(offset, PhysicsStore.getVelocityY(entityId), true);
                offset += 4;
                view.setFloat32(offset, PhysicsStore.getRadius(entityId), true);
                offset += 4;
            }

            return buffer.slice(0, offset);
        } finally {
            this.returnBuffer(poolEntry);
        }
    }

    /**
     * Pack component delta updates (Smart Lane)
     * Encodes only changed fields for arbitrary components
     */
    packComponentDelta(
        componentId: string,
        timestamp: number
    ): ArrayBuffer | null {
        const schema = this.schema.getSchema(componentId);
        if (!schema) {
            return null;
        }

        // Map component to dirty mask
        const dirtyMask = this.componentIdToMask(componentId);
        const dirtyEntities = this.dirtyTracker.getDirtyEntities(dirtyMask);

        if (dirtyEntities.length === 0) {
            return null;
        }

        const poolEntry = this.checkoutBuffer();
        const { buffer, view, u8 } = poolEntry;

        try {
            let offset = 0;

            // Header
            u8[offset++] = SchemaPacketType.COMPONENT_DELTA;
            view.setFloat32(offset, timestamp, true);
            offset += 4;

            // Component ID length and string
            const idBytes = new TextEncoder().encode(schema.id);
            u8[offset++] = idBytes.length;
            u8.set(idBytes, offset);
            offset += idBytes.length;

            // Entity count
            view.setUint16(offset, dirtyEntities.length, true);
            offset += 2;

            // Entity data based on schema
            for (const entityId of dirtyEntities) {
                view.setUint16(offset, entityId, true);
                offset += 2;

                // Encode each field according to schema
                for (const field of schema.fields) {
                    offset = this.encodeField(
                        view,
                        offset,
                        entityId,
                        field.type,
                        field.offset
                    );
                }
            }

            return buffer.slice(0, offset);
        } finally {
            this.returnBuffer(poolEntry);
        }
    }

    /**
     * Pack entity spawn event
     */
    packEntitySpawn(entityId: number, templateId: string): ArrayBuffer {
        const poolEntry = this.checkoutBuffer();
        const { buffer, view, u8 } = poolEntry;

        try {
            let offset = 0;

            u8[offset++] = SchemaPacketType.ENTITY_SPAWN;
            view.setUint16(offset, entityId, true);
            offset += 2;

            const idBytes = new TextEncoder().encode(templateId);
            u8[offset++] = idBytes.length;
            u8.set(idBytes, offset);
            offset += idBytes.length;

            return buffer.slice(0, offset);
        } finally {
            this.returnBuffer(poolEntry);
        }
    }

    /**
     * Pack entity destroy event
     */
    packEntityDestroy(entityId: number): ArrayBuffer {
        const poolEntry = this.checkoutBuffer();
        const { buffer, view, u8 } = poolEntry;

        try {
            let offset = 0;

            u8[offset++] = SchemaPacketType.ENTITY_DESTROY;
            view.setUint16(offset, entityId, true);
            offset += 2;

            return buffer.slice(0, offset);
        } finally {
            this.returnBuffer(poolEntry);
        }
    }

    /**
     * Clear dirty flags after successful send
     */
    clearSentDeltas(componentMask: number = 0): void {
        const dirtyEntities = this.dirtyTracker.getDirtyEntities(componentMask);

        for (const entityId of dirtyEntities) {
            // Clear the mask bits we're sending
            if (componentMask === 0) {
                this.dirtyTracker.clearDirty(entityId);
            } else {
                // Clear specific component bits
                for (let bit = 1; bit <= DirtyMask.CUSTOM; bit <<= 1) {
                    if (componentMask & bit) {
                        this.dirtyTracker.clearComponentDirty(entityId, bit);
                    }
                }
            }
        }
    }

    /**
     * Map component ID to dirty mask
     */
    private componentIdToMask(componentId: string): number {
        switch (componentId) {
            case 'Transform':
                return DirtyMask.TRANSFORM;
            case 'Physics':
                return DirtyMask.PHYSICS;
            case 'Stats':
                return DirtyMask.STATS;
            case 'State':
                return DirtyMask.STATE;
            case 'Skills':
                return DirtyMask.SKILLS;
            default:
                return DirtyMask.CUSTOM;
        }
    }

    /**
     * Encode a single field value
     */
    private encodeField(
        view: DataView,
        offset: number,
        entityId: number,
        type: string,
        fieldOffset: number
    ): number {
        // Calculate array index from entityId and fieldOffset
        const stride = 8; // Default stride
        const idx = entityId * stride + fieldOffset / 4;

        switch (type) {
            case 'f32':
                view.setFloat32(offset, TransformStore.data[idx] || 0, true);
                return offset + 4;
            case 'u16':
                view.setUint16(offset, Math.floor(TransformStore.data[idx] || 0), true);
                return offset + 2;
            case 'u32':
                view.setUint32(offset, Math.floor(TransformStore.data[idx] || 0), true);
                return offset + 4;
            default:
                return offset;
        }
    }
}
