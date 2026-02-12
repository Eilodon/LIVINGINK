/**
 * @cjr/engine - EventRingBuffer
 * Zero-allocation event system for engine-to-client communication
 * 
 * The engine emits events (VFX requests, gameplay events) into this buffer.
 * The client drains the buffer and translates events to actual VFX calls.
 * The server can ignore these events entirely (headless mode).
 */

/**
 * Engine Event Types
 * Pure numeric enum for maximum performance
 */
export const enum EngineEventType {
    NONE = 0,
    RING_COMMIT = 1,
    TATTOO_ACTIVATE = 2,
    SCREEN_SHAKE = 3,
    PARTICLE_BURST = 4,
    ENTITY_DEATH = 5,
    FLOATING_TEXT = 6,
    SHOCKWAVE = 7,
    EXPLODE = 8,
    SPAWN_PROJECTILE = 9,
}

/**
 * Engine Event structure
 * Packed for cache efficiency
 */
export interface IEngineEvent {
    type: EngineEventType;
    entityId: number;
    x: number;
    y: number;
    data: number; // Packed data (color, intensity, textId, etc.)
}

const DEFAULT_CAPACITY = 1024;
const SERVER_CAPACITY = 256;

/**
 * Determine capacity based on environment
 */
function getDefaultCapacity(): number {
    // Server environment has no window (use globalThis for cross-platform)
    const isBrowser = typeof globalThis !== 'undefined' &&
        typeof (globalThis as { window?: unknown }).window !== 'undefined';
    if (!isBrowser) {
        return SERVER_CAPACITY;
    }
    return DEFAULT_CAPACITY;
}

/**
 * Fixed-size ring buffer for engine events
 * Zero allocation during push/drain operations
 */
export class EventRingBuffer {
    private readonly buffer: IEngineEvent[];
    private count = 0;
    private readonly capacity: number;
    private overflowCount = 0;

    constructor(capacity?: number) {
        this.capacity = capacity ?? getDefaultCapacity();
        this.buffer = new Array(this.capacity);

        // Pre-allocate event objects
        for (let i = 0; i < this.capacity; i++) {
            this.buffer[i] = {
                type: EngineEventType.NONE,
                entityId: 0,
                x: 0,
                y: 0,
                data: 0
            };
        }
    }

    /**
     * Push event to buffer (zero allocation)
     * @returns true if event was added, false if buffer overflow
     */
    push(
        type: EngineEventType,
        entityId: number,
        x: number,
        y: number,
        data: number = 0
    ): boolean {
        if (this.count >= this.capacity) {
            this.overflowCount++;
            if (this.overflowCount === 1) {
                console.warn(`[Engine] Event buffer overflow: ${this.capacity} capacity reached`);
            }
            return false;
        }

        const event = this.buffer[this.count];
        event.type = type;
        event.entityId = entityId;
        event.x = x;
        event.y = y;
        event.data = data;
        this.count++;
        return true;
    }

    /**
     * Drain all events to callback (zero allocation)
     * Clears buffer after processing
     */
    drain(callback: (e: IEngineEvent) => void): void {
        for (let i = 0; i < this.count; i++) {
            callback(this.buffer[i]);
        }
        this.count = 0;
        this.overflowCount = 0;
    }

    /**
     * Get all events as array (allocates - use drain() for zero-alloc)
     */
    getEvents(): IEngineEvent[] {
        const events: IEngineEvent[] = [];
        for (let i = 0; i < this.count; i++) {
            const e = this.buffer[i];
            events.push({
                type: e.type,
                entityId: e.entityId,
                x: e.x,
                y: e.y,
                data: e.data,
            });
        }
        this.count = 0;
        this.overflowCount = 0;
        return events;
    }

    /**
     * Clear buffer without processing
     */
    clear(): void {
        this.count = 0;
        this.overflowCount = 0;
    }

    /**
     * Get current event count
     */
    getCount(): number {
        return this.count;
    }

    /**
     * Check if buffer has events
     */
    hasEvents(): boolean {
        return this.count > 0;
    }

    /**
     * Get overflow statistics
     */
    getOverflowCount(): number {
        return this.overflowCount;
    }
}

// Global engine event buffer singleton
export const eventBuffer = new EventRingBuffer();

/**
 * Text IDs for zero-allocation floating text
 * Client uses these to lookup the actual string
 */
export const TEXT_IDS = {
    NONE: 0,
    CATALYST: 1,
    SHIELD: 2,
    CLEANSE: 3,
    MASS: 4,
    BOSS_SLAIN: 5,
    RING_2: 6,
    RING_3: 7,
    RING_1: 8,
    CANDY_VEIN: 9,
    MUTATION: 10,
    OVERDRIVE: 11,
    INKED: 12,
} as const;

export type TextId = typeof TEXT_IDS[keyof typeof TEXT_IDS];
