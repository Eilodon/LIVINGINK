/**
 * EIDOLON-V: Zero-Allocation Input Ring Buffer
 * 
 * Replaces array of input objects with TypedArray backing.
 * Eliminates GC pressure from spread operators and .filter() calls.
 * 
 * Memory Layout (per entry, STRIDE = 5):
 * [seq, targetX, targetY, inputFlags, dt]
 */

export class InputRingBuffer {
    private static readonly STRIDE = 5;
    private readonly buffer: Float32Array;
    private readonly capacity: number;
    private head = 0;  // Write position
    private tail = 0;  // Read position (oldest unprocessed)
    private _count = 0;

    constructor(capacity: number = 256) {
        this.capacity = capacity;
        this.buffer = new Float32Array(capacity * InputRingBuffer.STRIDE);
    }

    /** Number of pending inputs */
    get count(): number {
        return this._count;
    }

    /** Push new input (zero allocation) */
    push(seq: number, targetX: number, targetY: number, space: boolean, w: boolean, dt: number): void {
        const idx = this.head * InputRingBuffer.STRIDE;
        this.buffer[idx] = seq;
        this.buffer[idx + 1] = targetX;
        this.buffer[idx + 2] = targetY;
        this.buffer[idx + 3] = (space ? 1 : 0) | (w ? 2 : 0); // Bitflags
        this.buffer[idx + 4] = dt;

        this.head = (this.head + 1) % this.capacity;

        if (this._count < this.capacity) {
            this._count++;
        } else {
            // Buffer full, advance tail (lose oldest)
            this.tail = (this.tail + 1) % this.capacity;
        }
    }

    /** Filter out processed inputs (seq <= lastProcessedSeq) - IN-PLACE */
    filterProcessed(lastProcessedSeq: number): void {
        // Advance tail past all processed inputs
        while (this._count > 0) {
            const idx = this.tail * InputRingBuffer.STRIDE;
            const seq = this.buffer[idx];
            if (seq > lastProcessedSeq) {
                break; // Found first unprocessed
            }
            this.tail = (this.tail + 1) % this.capacity;
            this._count--;
        }
    }

    /** Iterate over pending inputs for replay (no allocation) */
    forEach(callback: (seq: number, targetX: number, targetY: number, space: boolean, w: boolean, dt: number) => void): void {
        let current = this.tail;
        for (let i = 0; i < this._count; i++) {
            const idx = current * InputRingBuffer.STRIDE;
            const seq = this.buffer[idx];
            const targetX = this.buffer[idx + 1];
            const targetY = this.buffer[idx + 2];
            const flags = this.buffer[idx + 3];
            const dt = this.buffer[idx + 4];

            callback(seq, targetX, targetY, (flags & 1) !== 0, (flags & 2) !== 0, dt);

            current = (current + 1) % this.capacity;
        }
    }

    /** Clear all inputs */
    clear(): void {
        this.head = 0;
        this.tail = 0;
        this._count = 0;
    }

    /** Get input at index (for replay) - returns null if out of bounds */
    getAt(index: number, out: { seq: number; targetX: number; targetY: number; space: boolean; w: boolean; dt: number }): boolean {
        if (index < 0 || index >= this._count) return false;

        const bufferIdx = ((this.tail + index) % this.capacity) * InputRingBuffer.STRIDE;
        out.seq = this.buffer[bufferIdx];
        out.targetX = this.buffer[bufferIdx + 1];
        out.targetY = this.buffer[bufferIdx + 2];
        const flags = this.buffer[bufferIdx + 3];
        out.space = (flags & 1) !== 0;
        out.w = (flags & 2) !== 0;
        out.dt = this.buffer[bufferIdx + 4];
        return true;
    }
}
