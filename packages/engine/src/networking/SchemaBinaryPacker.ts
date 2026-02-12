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
} from '../generated';

import { DirtyTracker } from './DirtyTracker';
import { SchemaPacketType } from './ProtocolSchema';

// EIDOLON-V OPTIMIZATION: Pre-encoded component IDs to eliminate TextEncoder allocation in hot loop
const ID_STATS = new TextEncoder().encode('STATS');
const ID_SKILL = new TextEncoder().encode('SKILL');
const ID_PIGMENT = new TextEncoder().encode('PIGMENT');
const ID_TATTOO = new TextEncoder().encode('TATTOO');
const ID_CONFIG = new TextEncoder().encode('CONFIG');
const ID_INPUT = new TextEncoder().encode('INPUT');

// Map component names to pre-encoded IDs
const PRE_ENCODED_IDS: Record<string, Uint8Array> = {
    'STATS': ID_STATS,
    'SKILL': ID_SKILL,
    'PIGMENT': ID_PIGMENT,
    'TATTOO': ID_TATTOO,
    'CONFIG': ID_CONFIG,
    'INPUT': ID_INPUT,
};

// Pool for reuse
interface IPacketBuffer {
    buffer: ArrayBuffer;
    view: DataView;
    offset: number;
}

/**
 * EIDOLON-V: Network serialization profiling metrics
 * Used to monitor performance under load
 */
export interface PackerMetrics {
    lastPackTimeMs: number;      // Time to pack last packet (ms)
    lastBytesPacked: number;     // Size of last packet (bytes)
    lastEntitiesPacked: number;  // Number of entities in last packet
    totalPackCount: number;      // Total packets packed since reset
    avgPackTimeMs: number;       // Moving average pack time
}

export class SchemaBinaryPacker {
    // Shared buffer pool
    private static POOL_SIZE = 10;
    private static BUFFER_SIZE = 64 * 1024; // Increased to 64KB for snapshots
    private static _pool: IPacketBuffer[] = [];
    private static _poolInitialized = false;

    // EIDOLON-V: Profiling metrics
    private static _metrics: PackerMetrics = {
        lastPackTimeMs: 0,
        lastBytesPacked: 0,
        lastEntitiesPacked: 0,
        totalPackCount: 0,
        avgPackTimeMs: 0,
    };

    constructor() {
        SchemaBinaryPacker.initPool();
    }

    /**
     * Get current profiling metrics
     */
    static getMetrics(): Readonly<PackerMetrics> {
        return this._metrics;
    }

    /**
     * Reset profiling metrics
     */
    static resetMetrics(): void {
        this._metrics = {
            lastPackTimeMs: 0,
            lastBytesPacked: 0,
            lastEntitiesPacked: 0,
            totalPackCount: 0,
            avgPackTimeMs: 0,
        };
    }

    /**
     * Update metrics after pack operation
     */
    private static updateMetrics(timeMs: number, bytes: number, entities: number): void {
        const m = this._metrics;
        m.lastPackTimeMs = timeMs;
        m.lastBytesPacked = bytes;
        m.lastEntitiesPacked = entities;
        m.totalPackCount++;
        // Exponential moving average (alpha = 0.1)
        m.avgPackTimeMs = m.avgPackTimeMs * 0.9 + timeMs * 0.1;
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
            const entry = this._pool.pop();
            if (entry) {
                entry.offset = 0;
                return entry;
            }
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
        const startTime = performance.now();
        const entry = this.acquire();
        const { view } = entry;
        let { offset } = entry;

        // Header: Type(1) + Timestamp(4) + Count(2)
        view.setUint8(offset, SchemaPacketType.TRANSFORM_UPDATE); offset += 1;
        view.setFloat32(offset, timestamp, true); offset += 4;

        const countOffset = offset;
        view.setUint16(offset, 0, true); offset += 2; // Placeholder for count

        let count = 0;
        const tView = world.transformView; // DataView access

        // EIDOLON-V P2-1 FIX: Use Sparse Set for O(activeCount) iteration
        // Was O(maxEntities) = 10K, now O(activeCount) = typically 50-200
        const activeCount = world.activeCount;
        const activeEntities = world.activeEntities;

        for (let i = 0; i < activeCount; i++) {
            const id = activeEntities[i];

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

        // EIDOLON-V: Update profiling metrics
        this.updateMetrics(performance.now() - startTime, result.byteLength, count);

        return result;
    }

    /**
     * Pack optimized Transform DELTAS (Smart Lane)
     * Replaces full snapshot with only dirty entities
     */
    static packTransformDeltas(
        world: WorldState,
        timestamp: number,
        dirtyTracker: DirtyTracker
    ): ArrayBuffer | null {
        const dirtyEntities = dirtyTracker.getDirtyEntities(1); // 1 = TRANSFORM mask
        if (dirtyEntities.length === 0) return null;

        const entry = this.acquire();
        const { view } = entry;
        let { offset } = entry;

        // Header: Type(1) + Timestamp(4) + Count(2)
        view.setUint8(offset, SchemaPacketType.TRANSFORM_UPDATE); offset += 1;
        view.setFloat32(offset, timestamp, true); offset += 4;

        const countOffset = offset;
        view.setUint16(offset, 0, true); offset += 2;

        let count = 0;
        const tView = world.transformView;

        for (const id of dirtyEntities) {
            if (!world.isValidEntityId(id)) continue;

            // Write ID (2)
            view.setUint16(offset, id, true); offset += 2;

            // Manual optimization: Only pack X/Y (Fast Lane)
            // Stride is 32 bytes (8 floats). 
            const ptr = id * 32;
            const x = tView.getFloat32(ptr + 0, true);
            const y = tView.getFloat32(ptr + 4, true);

            view.setFloat32(offset, x, true); offset += 4;
            view.setFloat32(offset, y, true); offset += 4;

            count++;
        }

        view.setUint16(countOffset, count, true);

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
        const compIds: Record<string, number | undefined> = COMPONENT_IDS;

        for (const compName of components) {
            const compId = compIds[compName] as number;
            if (!compId) continue;

            // Check dirty entities for this component
            const dirtyEntities = dirtyTracker.getDirtyEntities(1 << (compId - 1));
            if (dirtyEntities.length === 0) continue;

            hasData = true;

            // EIDOLON-V OPTIMIZATION: Use pre-encoded ID instead of TextEncoder in hot loop
            const idBytes = PRE_ENCODED_IDS[compName];
            if (!idBytes) continue; // Safety check

            view.setUint8(offset, idBytes.length); offset += 1;

            // EIDOLON-V OPTIMIZATION: Manual unroll for zero allocation
            // Replaces: new Uint8Array(entry.buffer).set(idBytes, offset);
            const len = idBytes.length;
            for (let k = 0; k < len; k++) {
                view.setUint8(offset + k, idBytes[k]);
            }
            offset += len;

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
    /**
     * Pack Entity Spawn Events (Smart Lane)
     * Used for creating lightweight entities (Food, Projectiles) on client
     */
    static packSpawnEvents(
        world: WorldState,
        entityIds: number[],
        types: number[] // Optional: Type ID for each entity (e.g. 0=Neutral, 1=Pigment)
    ): ArrayBuffer | null {
        if (entityIds.length === 0) return null;

        const entry = this.acquire();
        const { view } = entry;
        let { offset } = entry;

        // Header: Type(1) + Count(2)
        view.setUint8(offset, SchemaPacketType.ENTITY_SPAWN); offset += 1;
        view.setUint16(offset, entityIds.length, true); offset += 2;

        const tView = world.transformView;
        const pView = world.pigmentView;

        // EIDOLON-V: Pack essential data only (ID, X, Y, R, G, B, Type)
        // Stride: 2(ID) + 4(X) + 4(Y) + 3(RGB) + 1(Type) = 14 bytes/entity
        for (let i = 0; i < entityIds.length; i++) {
            const id = entityIds[i];
            const type = types[i] || 0;

            view.setUint16(offset, id, true); offset += 2;

            // Position
            const ptr = id * 32;
            const x = tView.getFloat32(ptr + 0, true);
            const y = tView.getFloat32(ptr + 4, true);
            view.setFloat32(offset, x, true); offset += 4;
            view.setFloat32(offset, y, true); offset += 4;

            // Pigment (RGB 0-255)
            // Stride for pigment is 32 bytes (8 floats)
            // But usually we store pigment as float 0-1.
            // Let's pack as Uint8 for network efficiency.
            const pPtr = id * 32;
            const r = pView.getFloat32(pPtr + 0, true) * 255;
            const g = pView.getFloat32(pPtr + 4, true) * 255;
            const b = pView.getFloat32(pPtr + 8, true) * 255;

            view.setUint8(offset, r); offset += 1;
            view.setUint8(offset, g); offset += 1;
            view.setUint8(offset, b); offset += 1;

            // Type
            view.setUint8(offset, type); offset += 1;
        }

        const result = entry.buffer.slice(0, offset);
        this.release(entry);
        return result;
    }

    /**
     * Pack Entity Despawn Events (Smart Lane)
     */
    static packDespawnEvents(
        entityIds: number[]
    ): ArrayBuffer | null {
        if (entityIds.length === 0) return null;

        const entry = this.acquire();
        const { view } = entry;
        let { offset } = entry;

        // Header: Type(1) + Count(2)
        view.setUint8(offset, SchemaPacketType.ENTITY_DESTROY); offset += 1;
        view.setUint16(offset, entityIds.length, true); offset += 2;

        for (const id of entityIds) {
            view.setUint16(offset, id, true); offset += 2;
        }

        const result = entry.buffer.slice(0, offset);
        this.release(entry);
        return result;
    }
}
