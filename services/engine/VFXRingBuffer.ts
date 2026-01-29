/**
 * VFXRingBuffer.ts
 * Zero-allocation VFX event system using TypedArrays
 * Replaces string template events for maximum performance
 */

export interface VFXEvent {
  x: number;
  y: number;
  color: number; // Packed RGB (Required for Engine, default 0 for UI)
  type: number;  // 0=explode, 1=shockwave, 2=floating text
  data?: number; // Additional data (count, text char code, etc)

  // UI/React Compatibility
  id?: string;
  seq?: number;
}

export class VFXRingBuffer {
  private data: Float32Array;
  private head: number;
  private capacity: number;
  private readonly EVENT_SIZE = 5; // x, y, color, type, data

  constructor(capacity: number = 1000) {
    this.capacity = capacity;
    this.data = new Float32Array(capacity * this.EVENT_SIZE);
    this.head = 0;
  }

  /**
   * Add VFX event to buffer (zero allocation)
   */
  push(x: number, y: number, color: number, type: number, data: number = 0): void {
    const index = this.head * this.EVENT_SIZE;
    this.data[index] = x;
    this.data[index + 1] = y;
    this.data[index + 2] = color;
    this.data[index + 3] = type;
    this.data[index + 4] = data;

    this.head = (this.head + 1) % this.capacity;
  }

  /**
   * Pop last event (LIFO) - Efficient for frame processing
   */
  pop(): VFXEvent | null {
    if (this.head === 0) return null;

    this.head--;
    const index = this.head * this.EVENT_SIZE;

    return {
      x: this.data[index],
      y: this.data[index + 1],
      color: this.data[index + 2],
      type: this.data[index + 3],
      data: this.data[index + 4]
    };
  }

  /**
   * Get all events since last read
   */
  getEvents(): VFXEvent[] {
    const events: VFXEvent[] = [];

    for (let i = 0; i < this.head; i++) {
      const index = i * this.EVENT_SIZE;
      events.push({
        x: this.data[index],
        y: this.data[index + 1],
        color: this.data[index + 2],
        type: this.data[index + 3],
        data: this.data[index + 4]
      });
    }

    // Reset head for next frame
    this.head = 0;
    return events;
  }

  /**
   * Clear buffer
   */
  clear(): void {
    this.head = 0;
  }

  /**
   * Get current count
   */
  get count(): number {
    return this.head;
  }

  /**
   * Check if buffer is full
   */
  get isFull(): boolean {
    return this.head >= this.capacity;
  }
}

// VFX Event Types
export const VFX_TYPES = {
  EXPLODE: 0,
  SHOCKWAVE: 1,
  FLOATING_TEXT: 2,
  PARTICLE_BURST: 3,
  SCREEN_SHAKE: 4
} as const;

// Text Message IDs for Zero-GC Text
export const TEXT_IDS = {
  NONE: 0,
  CATALYST: 1, // "Catalyst!"
  SHIELD: 2,   // "Shield!"
  CLEANSE: 3,  // "Cleanse"
  MASS: 4,     // "+Mass"
  BOSS_SLAIN: 5, // "BOSS SLAIN"
  RING_1: 8,   // "RING 1!" (Added for consistency)
  RING_2: 6,   // "RING 2!"
  RING_3: 7,   // "RING 3!"
  CANDY_VEIN: 9, // "CANDY VEIN!"
  MUTATION: 10   // "MUTATION!"
} as const;

// Color packing utilities
export const packRGB = (r: number, g: number, b: number): number => {
  return (Math.floor(r * 255) << 16) | (Math.floor(g * 255) << 8) | Math.floor(b * 255);
};

export const packHex = (hex: string): number => {
  return parseInt(hex.replace('#', ''), 16);
};

export const unpackRGB = (packed: number): { r: number; g: number; b: number } => {
  return {
    r: ((packed >> 16) & 255) / 255,
    g: ((packed >> 8) & 255) / 255,
    b: (packed & 255) / 255
  };
};

// Global buffer instance
export const vfxBuffer = new VFXRingBuffer(1000);
