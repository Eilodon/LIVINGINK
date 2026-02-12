/**
 * @eidolon/engine - SchemaBinaryUnpacker
 * 
 * EIDOLON-V: Decodes Smart Lane packets directly into WorldState.
 * Uses generated NetworkDeserializer for component deltas.
 */

import { SchemaPacketType } from './ProtocolSchema';
import {
    COMPONENT_IDS,
    NetworkDeserializer,
    WorldState,
    TransformAccess,
    PhysicsAccess
} from '../generated';
import { ISnapshotReceiver } from './ISnapshotReceiver';

export class SchemaBinaryUnpacker {

    /**
     * Unpack a binary packet directly into WorldState
     * @returns Packet timestamp or null if invalid
     */
    static unpack(
        buffer: ArrayBuffer,
        world: WorldState,
        receiver?: ISnapshotReceiver // EIDOLON-V: Optional receiver for buffering (if not provided, writes to world)
    ): number | null {
        const view = new DataView(buffer);
        let offset = 0;

        // Header: Packet Type (1 byte)
        if (buffer.byteLength < 1) return null;
        const type = view.getUint8(offset++);

        // Dispatch based on packet type
        switch (type) {
            case SchemaPacketType.TRANSFORM_UPDATE:
                return SchemaBinaryUnpacker.unpackTransformUpdate(view, offset, world, receiver);

            case SchemaPacketType.PHYSICS_UPDATE:
                return SchemaBinaryUnpacker.unpackPhysicsUpdate(view, offset, world, receiver);

            case SchemaPacketType.COMPONENT_DELTA:
                // Component Deltas still write directly to world for now as Deserializer is coupled
                // TODO: Update Deserializer or Receiver to handle generic components?
                // For now, they are less critical for physics glitching (Smart Lane vs Fast Lane)
                return SchemaBinaryUnpacker.unpackComponentDelta(view, offset, world);

            default:
                // Unknown or unhandled packet type
                return null;
        }
    }

    /**
     * Unpack optimized Transform updates (Fast Lane)
     * Format: Timestamp(4) + Count(2) + [ID(2) + X(4) + Y(4)]...
     */
    private static unpackTransformUpdate(
        view: DataView,
        offset: number,
        world: WorldState,
        receiver?: ISnapshotReceiver
    ): number | null {
        if (view.byteLength < offset + 6) return null;

        const timestamp = view.getFloat32(offset, true); offset += 4;
        const count = view.getUint16(offset, true); offset += 2;

        for (let i = 0; i < count; i++) {
            if (view.byteLength < offset + 10) break;

            const id = view.getUint16(offset, true); offset += 2;
            const x = view.getFloat32(offset, true); offset += 4;
            const y = view.getFloat32(offset, true); offset += 4;

            // Direct SSOT Write or Receiver Buffer
            if (world.isValidEntityId(id)) {
                if (receiver) {
                    receiver.onTransform(id, x, y);
                } else {
                    TransformAccess.setX(world, id, x);
                    TransformAccess.setY(world, id, y);
                    // EIDOLON-V: Initialize prevX/Y to current for interpolation stability
                    // If we don't do this, they might be 0, causing a huge smear on first frame
                    if (TransformAccess.getPrevX(world, id) === 0 && TransformAccess.getPrevY(world, id) === 0) {
                        TransformAccess.setPrevX(world, id, x);
                        TransformAccess.setPrevY(world, id, y);
                    }
                }
            }
        }
        return timestamp;
    }

    /**
     * Unpack optimized Physics updates (Fast Lane)
     * Format: Timestamp(4) + Count(2) + [ID(2) + VX(4) + VY(4) + Radius(4)]...
     */
    private static unpackPhysicsUpdate(
        view: DataView,
        offset: number,
        world: WorldState,
        receiver?: ISnapshotReceiver
    ): number | null {
        if (view.byteLength < offset + 6) return null;

        const timestamp = view.getFloat32(offset, true); offset += 4;
        const count = view.getUint16(offset, true); offset += 2;

        for (let i = 0; i < count; i++) {
            if (view.byteLength < offset + 14) break;

            const id = view.getUint16(offset, true); offset += 2;
            const vx = view.getFloat32(offset, true); offset += 4;
            const vy = view.getFloat32(offset, true); offset += 4;
            const radius = view.getFloat32(offset, true); offset += 4;

            if (world.isValidEntityId(id)) {
                if (receiver) {
                    receiver.onPhysics(id, vx, vy, radius);
                } else {
                    PhysicsAccess.setVx(world, id, vx);
                    PhysicsAccess.setVy(world, id, vy);
                    PhysicsAccess.setRadius(world, id, radius);
                }
            }
        }
        return timestamp;
    }

    /**
     * Unpack generic Component Deltas (Smart Lane)
     * Use generated NetworkDeserializer
     * Format: Timestamp(4) + ID_LEN(1) + ID_STR(...) + Count(2) + [ID(2) + DATA...]...
     */
    private static unpackComponentDelta(
        view: DataView,
        offset: number,
        world: WorldState
    ): number | null {
        if (view.byteLength < offset + 5) return null;

        const timestamp = view.getFloat32(offset, true); offset += 4;

        // Read Component ID String
        const idLen = view.getUint8(offset++);
        if (view.byteLength < offset + idLen + 2) return null;

        // We need to decode the string to map it to COMPONENT_IDS
        // Note: TextDecoder overhead. In optimized env, might pre-hash or use numeric IDs on wire.
        // For now, consistent with SchemaBinaryPacker.
        const idBytes = new Uint8Array(view.buffer, view.byteOffset + offset, idLen);
        const compStringId = new TextDecoder().decode(idBytes);
        offset += idLen;

        // Map String ID to Numeric ID
        // COMPONENT_IDS keys are UPPERCASE in generated code? 
        // generate.js: `componentMeta.push({ name: compName, ... })`
        // packerCode: `COMPONENT_IDS = { ${meta.name.toUpperCase()}: ... }`
        // So we need to match. Schema uses PascalCase (Transform, Physics).
        // COMPONENT_IDS uses UPPERCASE (TRANSFORM, PHYSICS).
        const upperId = compStringId.toUpperCase();
        const numericId = (COMPONENT_IDS as Record<string, number | undefined>)[upperId];

        const count = view.getUint16(offset, true); offset += 2;

        if (numericId === undefined) {
            console.warn(`[SchemaBinaryUnpacker] Unknown component ID: ${compStringId}`);
            return timestamp; // Skip decoding if unknown
        }

        // Use Generated Deserializer
        for (let i = 0; i < count; i++) {
            if (view.byteLength < offset + 2) break;
            const entityId = view.getUint16(offset, true); offset += 2;

            if (world.isValidEntityId(entityId)) {
                offset = NetworkDeserializer.deserializeComponent(world, entityId, numericId, view, offset);
            } else {
                // Skip if invalid entity? We can't easily skip without knowing stride.
                // Actually NetworkDeserializer returns new offset regardless of validity?
                // deserializeComponent signature: (world, id, ...)
                // It writes to world.view. 
                // We should probably safeguard or ensuring unpacking advances offset correctly.
                // The generated code DOES advance offset.
                offset = NetworkDeserializer.deserializeComponent(world, entityId, numericId, view, offset);
            }
        }

        return timestamp;
    }

    /**
     * Unpack Entity Spawn Events (Smart Lane)
     */
    static unpackSpawnEvents(
        view: DataView,
        offset: number
    ): { id: number, x: number, y: number, r: number, g: number, b: number, type: number }[] {
        const events: { id: number, x: number, y: number, r: number, g: number, b: number, type: number }[] = [];

        if (view.byteLength < offset + 2) return events;
        const count = view.getUint16(offset, true); offset += 2;

        for (let i = 0; i < count; i++) {
            if (view.byteLength < offset + 14) break;

            const id = view.getUint16(offset, true); offset += 2;
            const x = view.getFloat32(offset, true); offset += 4;
            const y = view.getFloat32(offset, true); offset += 4;

            const r = view.getUint8(offset++);
            const g = view.getUint8(offset++);
            const b = view.getUint8(offset++);
            const type = view.getUint8(offset++);

            events.push({ id, x, y, r, g, b, type });
        }
        return events;
    }

    /**
     * Unpack Entity Despawn Events (Smart Lane)
     */
    static unpackDespawnEvents(
        view: DataView,
        offset: number
    ): number[] {
        const ids: number[] = [];

        if (view.byteLength < offset + 2) return ids;
        const count = view.getUint16(offset, true); offset += 2;

        for (let i = 0; i < count; i++) {
            if (view.byteLength < offset + 2) break;
            const id = view.getUint16(offset, true); offset += 2;
            ids.push(id);
        }
        return ids;
    }
}
