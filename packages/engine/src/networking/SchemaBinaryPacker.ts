/**
 * @eidolon/engine - SchemaBinaryPacker
 * 
 * EIDOLON-V: Smart Lane packet encoding.
 * Uses generated NetworkSerializer for zero-overhead packing.
 */

import {
    COMPONENT_IDS,
    NetworkSerializer,
    WorldState,
    defaultWorld,
} from '../generated';

import { DirtyTracker } from './DirtyTracker';
import { SchemaPacketType } from './ProtocolSchema';

// Pool for reuse
interface IPacketBuffer {
    buffer: ArrayBuffer;
    view: DataView;
    offset: number;
}

export class SchemaBinaryPacker {
    // Shared buffer pool
    private static POOL_SIZE = 10;
    private static BUFFER_SIZE = 64 * 1024; // Increased to 64KB for snapshots
    private static _pool: IPacketBuffer[] = [];
    private static _poolInitialized = false;

    constructor() {
        SchemaBinaryPacker.initPool();
    }

    static initPool() {
        if (SchemaBinaryPacker._poolInitialized) return;

        for (let i = 0; i < SchemaBinaryPacker.POOL_SIZE; i++) {
            const buffer = new ArrayBuffer(SchemaBinaryPacker.BUFFER_SIZE);
            SchemaBinaryPacker._pool.push({
                buffer,
                view: new DataView(buffer),
                offset: 0
            });
        }
        SchemaBinaryPacker._poolInitialized = true;
    }

    /**
     * Acquire a buffer from the pool (reset offset)
     */
    private static acquire(): IPacketBuffer {
        this.initPool();
        if (this._pool.length > 0) {
            const entry = this._pool.pop()!;
            entry.offset = 0;
            return entry;
        }
        // Fallback if empty
        const buffer = new ArrayBuffer(this.BUFFER_SIZE);
        return { buffer, view: new DataView(buffer), offset: 0 };
    }

    private static release(entry: IPacketBuffer) {
        if (this._pool.length < this.POOL_SIZE) {
            this._pool.push(entry);
        }
    }

    /**
     * Pack optimized Transform Snapshot (Fast Lane)
     * Replaces BinaryPacker.packTransforms/Indexed
     * 
     * Uses explicit X/Y packing for maximum density (8 bytes/entity + overhead)
     * instead of full NetworkSerializer (32 bytes/entity).
     */
    static packTransformSnapshot(
        world: WorldState,
        timestamp: number
    ): ArrayBuffer {
        const entry = this.acquire();
        const { view } = entry;
        let { offset } = entry;

        // Header: Type(1) + Timestamp(4) + Count(2)
        view.setUint8(offset, SchemaPacketType.TRANSFORM_UPDATE); offset += 1;
        view.setFloat32(offset, timestamp, true); offset += 4;

        const countOffset = offset;
        view.setUint16(offset, 0, true); offset += 2; // Placeholder for count

        let count = 0;
        const maxEnt = world.maxEntities;
        const tView = world.transformView; // DataView access

        // Loop all active entities
        for (let id = 0; id < maxEnt; id++) {
            if (!world.isValidEntityId(id)) continue;

            // Write ID (2)
            view.setUint16(offset, id, true); offset += 2;

            // Manual optimization: Only pack X/Y (Fast Lane)
            // Stride is 32 bytes (8 floats). 
            // X is float 0 (bytes 0-3), Y is float 1 (bytes 4-7)
            const ptr = id * 32;
            const x = tView.getFloat32(ptr + 0, true);
            const y = tView.getFloat32(ptr + 4, true);

            view.setFloat32(offset, x, true); offset += 4;
            view.setFloat32(offset, y, true); offset += 4;

            count++;
        }

        view.setUint16(countOffset, count, true);

        // Copy to result buffer
        const result = entry.buffer.slice(0, offset);
        this.release(entry);
        return result;
    }

    /**
     * Pack Component Deltas (Smart Lane) using Generated Serializer
     */
    static packComponentDeltas(
        world: WorldState,
        timestamp: number,
        dirtyTracker: DirtyTracker // Used to identify WHO is dirty
    ): ArrayBuffer | null {
        // For simplicity in this refactor, we iterate component types and dirty masks
        // This assumes DirtyTracker aligns with component IDs.

        const entry = this.acquire();
        const { view } = entry;
        let { offset } = entry;

        // Header
        view.setUint8(offset, SchemaPacketType.COMPONENT_DELTA); offset += 1;
        view.setFloat32(offset, timestamp, true); offset += 4;

        let hasData = false;

        // List of components (excluding Transform/Physics which are Fast Lane)
        const components = [
            'STATS', 'SKILL', 'PIGMENT', 'TATTOO', 'CONFIG', 'INPUT'
        ];

        // Inverse map for ID string
        const compIds = COMPONENT_IDS as any;

        for (const compName of components) {
            const compId = compIds[compName] as number;
            if (!compId) continue;

            // Check dirty entities for this component
            const dirtyEntities = dirtyTracker.getDirtyEntities(1 << (compId - 1));
            if (dirtyEntities.length === 0) continue;

            hasData = true;

            // Component Section: [IDLen][IDStr][Count][ (ID + Data)... ]
            const idStr = compName; // Send UPPERCASE ID (e.g. STATS) or adjust as needed
            const idBytes = new TextEncoder().encode(idStr);
            view.setUint8(offset, idBytes.length); offset += 1;
            new Uint8Array(entry.buffer).set(idBytes, offset); offset += idBytes.length;

            const countOffset = offset;
            view.setUint16(offset, 0, true); offset += 2;
            let count = 0;

            for (const entityId of dirtyEntities) {
                if (!world.isValidEntityId(entityId)) continue;

                view.setUint16(offset, entityId, true); offset += 2;

                // USE GENERATED SERIALIZER
                offset = NetworkSerializer.packEntityComponent(world, entityId, compId, view, offset);
                count++;
            }

            view.setUint16(countOffset, count, true);
        }

        if (!hasData) {
            this.release(entry);
            return null;
        }

        const result = entry.buffer.slice(0, offset);
        this.release(entry);
        return result;
    }
}
