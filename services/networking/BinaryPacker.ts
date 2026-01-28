
export const PacketType = {
    TRANSFORM_UPDATE: 1
};

export class BinaryPacker {
    private static _buffer = new ArrayBuffer(4096 * 32); // 128KB buffer
    private static _view = new DataView(BinaryPacker._buffer);
    private static _u8 = new Uint8Array(BinaryPacker._buffer);

    static packTransforms(
        entities: { id: string, x: number, y: number, vx: number, vy: number }[],
        timestamp: number
    ): ArrayBuffer {
        let offset = 0;
        const view = this._view;
        const u8 = this._u8;

        // Header: Type (1) + Time (4) + Count (2)
        u8[offset++] = PacketType.TRANSFORM_UPDATE;
        view.setFloat32(offset, timestamp, true); offset += 4;
        view.setUint16(offset, entities.length, true); offset += 2;

        for (const ent of entities) {
            // ID (Length + Bytes)
            const idLen = ent.id.length;
            u8[offset++] = idLen;
            for (let i = 0; i < idLen; i++) {
                u8[offset++] = ent.id.charCodeAt(i);
            }

            // Transform (4x4 = 16 bytes)
            view.setFloat32(offset, ent.x, true); offset += 4;
            view.setFloat32(offset, ent.y, true); offset += 4;
            view.setFloat32(offset, ent.vx, true); offset += 4;
            view.setFloat32(offset, ent.vy, true); offset += 4;
        }

        // Slice used portion (or copy)
        return this._buffer.slice(0, offset);
    }

    static unpackTransforms(buffer: ArrayBuffer): { timestamp: number, updates: { id: string, x: number, y: number, vx: number, vy: number }[] } | null {
        const view = new DataView(buffer);
        const u8 = new Uint8Array(buffer);
        let offset = 0;

        if (u8[offset++] !== PacketType.TRANSFORM_UPDATE) return null;

        const timestamp = view.getFloat32(offset, true); offset += 4;
        const count = view.getUint16(offset, true); offset += 2;

        const updates = [];
        for (let k = 0; k < count; k++) {
            const idLen = u8[offset++];
            let id = "";
            for (let i = 0; i < idLen; i++) {
                id += String.fromCharCode(u8[offset++]);
            }

            const x = view.getFloat32(offset, true); offset += 4;
            const y = view.getFloat32(offset, true); offset += 4;
            const vx = view.getFloat32(offset, true); offset += 4;
            const vy = view.getFloat32(offset, true); offset += 4;

            updates.push({ id, x, y, vx, vy });
        }

        return { timestamp, updates };
    }
}
