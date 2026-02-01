/**
 * BinaryPacker - Zero-allocation binary serialization
 * Headless version for @cjr/engine (runs on both client and server)
 */

export const PacketType = {
  TRANSFORM_UPDATE: 1,
  EVENT_UPDATE: 2,
} as const;

export type PacketTypeValue = typeof PacketType[keyof typeof PacketType];

export class BinaryPacker {
  private static _buffer = new ArrayBuffer(4096 * 32); // 128KB buffer
  private static _view = new DataView(BinaryPacker._buffer);
  private static _u8 = new Uint8Array(BinaryPacker._buffer);

  /**
   * Pack entity transforms into binary format
   * Format: [type: u8][timestamp: f32][count: u16][entity data...]
   */
  static packTransforms(
    entities: { id: string; x: number; y: number; vx: number; vy: number }[],
    timestamp: number
  ): ArrayBuffer {
    // EIDOLON-V P0: Overflow protection
    // Header (7) + per entity: id_len (1) + id (~10 avg) + transforms (16) = ~27 bytes/entity
    const maxSafeEntities = Math.floor((this._buffer.byteLength - 7) / 30);
    if (entities.length > maxSafeEntities) {
      console.error('[BinaryPacker] Buffer overflow prevented, truncating', {
        count: entities.length,
        max: maxSafeEntities
      });
      entities = entities.slice(0, maxSafeEntities);
    }

    let offset = 0;
    const view = this._view;
    const u8 = this._u8;

    // Header: Type (1) + Time (4) + Count (2)
    u8[offset++] = PacketType.TRANSFORM_UPDATE;
    view.setFloat32(offset, timestamp, true);
    offset += 4;
    view.setUint16(offset, entities.length, true);
    offset += 2;

    for (const ent of entities) {
      // ID (Length + Bytes)
      const idLen = ent.id.length;
      u8[offset++] = idLen;
      for (let i = 0; i < idLen; i++) {
        u8[offset++] = ent.id.charCodeAt(i);
      }

      // Transform (4x4 = 16 bytes)
      view.setFloat32(offset, ent.x, true);
      offset += 4;
      view.setFloat32(offset, ent.y, true);
      offset += 4;
      view.setFloat32(offset, ent.vx, true);
      offset += 4;
      view.setFloat32(offset, ent.vy, true);
      offset += 4;
    }

    // Return sliced copy (not shared buffer)
    return this._buffer.slice(0, offset);
  }

  /**
   * Pack server events into binary format
   * Format: [type: u8][timestamp: f32][count: u8][events...]
   */
  static packEvents(
    events: { type: number; entityId: string; data?: number; x?: number; y?: number }[],
    timestamp: number
  ): ArrayBuffer {
    let offset = 0;
    const view = this._view;
    const u8 = this._u8;

    // Header
    u8[offset++] = PacketType.EVENT_UPDATE;
    view.setFloat32(offset, timestamp, true);
    offset += 4;
    u8[offset++] = events.length;

    for (const evt of events) {
      // Event type
      u8[offset++] = evt.type;

      // Entity ID
      const idLen = evt.entityId.length;
      u8[offset++] = idLen;
      for (let i = 0; i < idLen; i++) {
        u8[offset++] = evt.entityId.charCodeAt(i);
      }

      // Data (f32)
      view.setFloat32(offset, evt.data ?? 0, true);
      offset += 4;

      // Position (f32 x 2)
      view.setFloat32(offset, evt.x ?? 0, true);
      offset += 4;
      view.setFloat32(offset, evt.y ?? 0, true);
      offset += 4;
    }

    return this._buffer.slice(0, offset);
  }

  // Pre-allocated buffers for zero-allocation unpacking
  private static _textDecoder = new TextDecoder('utf-8');
  private static _idBuffer = new Uint8Array(64);

  /**
   * Zero-allocation transform unpacker using visitor pattern
   */
  static unpackAndApply(
    buffer: ArrayBuffer,
    callback: (id: string, x: number, y: number, vx: number, vy: number) => void
  ): number | null {
    const view = new DataView(buffer);
    const u8 = new Uint8Array(buffer);
    let offset = 0;

    // Validate packet type
    const packetType = u8[offset++];
    if (packetType !== PacketType.TRANSFORM_UPDATE) return null;

    const timestamp = view.getFloat32(offset, true);
    offset += 4;
    const count = view.getUint16(offset, true);
    offset += 2;

    for (let k = 0; k < count; k++) {
      const idLen = u8[offset++];

      // Decode ID using pre-allocated buffer
      this._idBuffer.set(u8.subarray(offset, offset + idLen));
      const id = this._textDecoder.decode(this._idBuffer.subarray(0, idLen));
      offset += idLen;

      const x = view.getFloat32(offset, true);
      offset += 4;
      const y = view.getFloat32(offset, true);
      offset += 4;
      const vx = view.getFloat32(offset, true);
      offset += 4;
      const vy = view.getFloat32(offset, true);
      offset += 4;

      callback(id, x, y, vx, vy);
    }

    return timestamp;
  }

  /**
   * Zero-allocation event unpacker
   */
  static unpackEvents(
    buffer: ArrayBuffer,
    callback: (type: number, entityId: string, data: number, x: number, y: number) => void
  ): number | null {
    const view = new DataView(buffer);
    const u8 = new Uint8Array(buffer);
    let offset = 0;

    const packetType = u8[offset++];
    if (packetType !== PacketType.EVENT_UPDATE) return null;

    const timestamp = view.getFloat32(offset, true);
    offset += 4;
    const count = u8[offset++];

    for (let k = 0; k < count; k++) {
      const type = u8[offset++];

      const idLen = u8[offset++];
      this._idBuffer.set(u8.subarray(offset, offset + idLen));
      const entityId = this._textDecoder.decode(this._idBuffer.subarray(0, idLen));
      offset += idLen;

      const data = view.getFloat32(offset, true);
      offset += 4;
      const x = view.getFloat32(offset, true);
      offset += 4;
      const y = view.getFloat32(offset, true);
      offset += 4;

      callback(type, entityId, data, x, y);
    }

    return timestamp;
  }

  /**
   * Legacy API - returns array of updates (creates objects)
   * @deprecated Use unpackAndApply for zero-allocation
   */
  static unpackTransforms(
    buffer: ArrayBuffer
  ): {
    timestamp: number;
    updates: { id: string; x: number; y: number; vx: number; vy: number }[];
  } | null {
    const updates: { id: string; x: number; y: number; vx: number; vy: number }[] = [];
    const timestamp = this.unpackAndApply(buffer, (id, x, y, vx, vy) => {
      updates.push({ id, x, y, vx, vy });
    });
    if (timestamp === null) return null;
    return { timestamp, updates };
  }
}
