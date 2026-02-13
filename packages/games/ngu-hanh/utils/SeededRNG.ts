export class SeededRNG {
    private state: bigint;
    private inc: bigint;

    constructor(seed: number) {
        this.state = 0n;
        this.inc = (BigInt(0xda3e39cb) << 32n) | BigInt(0x94b95bdb); // Stream ID
        this.inc = (this.inc << 1n) | 1n;

        // Initialize state
        this.nextU32();
        this.state = this.state + BigInt(seed);
        this.nextU32();
    }

    private nextU32(): number {
        const oldState = this.state;
        // self.state = oldstate.wrapping_mul(6364136223846793005).wrapping_add(self.inc);
        this.state = (oldState * 6364136223846793005n + this.inc) & 0xFFFFFFFFFFFFFFFFn;

        // Calculate output function (XSH-RR)
        // let xorshifted = (((oldstate >> 18) ^ oldstate) >> 27) as u32;
        const xorshifted = Number(((oldState >> 18n) ^ oldState) >> 27n) >>> 0;

        // let rot = (oldstate >> 59) as u32;
        const rot = Number(oldState >> 59n) >>> 0;

        // xorshifted.rotate_right(rot)
        return ((xorshifted >>> rot) | (xorshifted << (32 - rot))) >>> 0;
    }

    /**
     * Returns a random integer between min (inclusive) and max (exclusive)
     * Exact match for Rust `gen_range`
     */
    public nextInt(min: number, max: number): number {
        if (min >= max) return min;

        const range = max - min;
        const threshold = ((0 - range) >>> 0) % range;

        while (true) {
            const r = this.nextU32();
            if (r >= threshold) {
                return min + (r % range);
            }
        }
    }

    /**
     * Returns a random float between 0.0 (inclusive) and 1.0 (exclusive)
     */
    public next(): number {
        // (self.next_u32() >> 8) as f32 * (1.0 / 16777216.0)
        return (this.nextU32() >>> 8) * (1.0 / 16777216.0);
    }

    // Alias for legacy support if needed
    public nextFloat(): number {
        return this.next();
    }

    /**
     * Returns a random element from an array
     */
    public nextElement<T>(array: T[]): T | undefined {
        if (array.length === 0) return undefined;
        return array[this.nextInt(0, array.length)];
    }

    /**
     * Returns true with probability p (0-1)
     */
    public chance(p: number): boolean {
        return this.next() < p;
    }
}
