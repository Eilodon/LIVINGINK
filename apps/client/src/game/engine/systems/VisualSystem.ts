/**
 * EIDOLON-V: VisualSystem
 * 
 * Maps entity visual data (color, shape, flags) for rendering.
 * This is the bridge between DOD WorldState and Pixi renderer.
 * 
 * Design: Zero-allocation during hot path by using pre-allocated arrays.
 */

import { MAX_ENTITIES } from '@cjr/engine';

// Visual flags bitmask
export const VisualFlags = {
    VISIBLE: 1 << 0,
    HIGHLIGHTED: 1 << 1,
    FADING: 1 << 2,
    GLOWING: 1 << 3,
} as const;

// Shape IDs for rendering
export const ShapeId = {
    CIRCLE: 0,
    SQUARE: 1,
    TRIANGLE: 2,
    HEX: 3,
} as const;

/**
 * VisualStore: Contiguous typed arrays for visual data
 * This allows O(1) access during render loop without Map overhead.
 */
export class VisualStore {
    // Packed RGBA color as 32-bit integer (0xRRGGBBAA)
    public readonly color: Uint32Array;

    // Shape type (circle, square, triangle, hex)
    public readonly shape: Uint8Array;

    // Bitmask flags (visible, highlighted, fading, etc.)
    public readonly flags: Uint8Array;

    // Scale multiplier (for animations)
    public readonly scale: Float32Array;

    // Alpha/opacity (0.0 - 1.0)
    public readonly alpha: Float32Array;

    constructor(capacity: number = MAX_ENTITIES) {
        this.color = new Uint32Array(capacity);
        this.shape = new Uint8Array(capacity);
        this.flags = new Uint8Array(capacity);
        this.scale = new Float32Array(capacity);
        this.alpha = new Float32Array(capacity);

        // Initialize defaults
        this.color.fill(0xffffffff); // White
        this.shape.fill(ShapeId.CIRCLE);
        this.flags.fill(VisualFlags.VISIBLE);
        this.scale.fill(1.0);
        this.alpha.fill(1.0);
    }

    /**
     * Set visual properties for an entity
     */
    set(id: number, color: number, shape: number = ShapeId.CIRCLE, visible: boolean = true): void {
        this.color[id] = color;
        this.shape[id] = shape;
        this.flags[id] = visible ? VisualFlags.VISIBLE : 0;
        this.scale[id] = 1.0;
        this.alpha[id] = 1.0;
    }

    /**
     * Mark entity as invisible (for pooling)
     */
    hide(id: number): void {
        this.flags[id] &= ~VisualFlags.VISIBLE;
    }

    /**
     * Mark entity as visible
     */
    show(id: number): void {
        this.flags[id] |= VisualFlags.VISIBLE;
    }

    /**
     * Check if entity is visible
     */
    isVisible(id: number): boolean {
        return (this.flags[id] & VisualFlags.VISIBLE) !== 0;
    }

    /**
     * Set highlight flag (for UI feedback)
     */
    setHighlight(id: number, highlighted: boolean): void {
        if (highlighted) {
            this.flags[id] |= VisualFlags.HIGHLIGHTED;
        } else {
            this.flags[id] &= ~VisualFlags.HIGHLIGHTED;
        }
    }

    /**
     * Update color (e.g., after pigment mixing)
     */
    setColor(id: number, color: number): void {
        this.color[id] = color;
    }

    /**
     * Reset entity visual to defaults (for entity recycling)
     */
    reset(id: number): void {
        this.color[id] = 0xffffffff;
        this.shape[id] = ShapeId.CIRCLE;
        this.flags[id] = VisualFlags.VISIBLE;
        this.scale[id] = 1.0;
        this.alpha[id] = 1.0;
    }
}

/**
 * VisualSystem: Manages visual data lifecycle
 * Syncs with entity spawn/despawn events.
 */
export class VisualSystem {
    private store: VisualStore;

    constructor(store?: VisualStore) {
        this.store = store || new VisualStore();
    }

    getStore(): VisualStore {
        return this.store;
    }

    /**
     * Called when entity is spawned - initialize visual data
     */
    onEntitySpawn(id: number, color: number, shapeId: number = ShapeId.CIRCLE): void {
        this.store.set(id, color, shapeId, true);
    }

    /**
     * Called when entity is despawned - hide visual
     */
    onEntityDespawn(id: number): void {
        this.store.hide(id);
        this.store.reset(id);
    }

    /**
     * Get color for rendering (O(1) access)
     */
    getColor(id: number): number {
        return this.store.color[id];
    }

    /**
     * Get shape for rendering (O(1) access)
     */
    getShape(id: number): number {
        return this.store.shape[id];
    }

    /**
     * Check if should render (O(1) access)
     */
    shouldRender(id: number): boolean {
        return this.store.isVisible(id);
    }

    /**
     * Update color (e.g., after pigment mixing)
     */
    updateColor(id: number, color: number): void {
        this.store.setColor(id, color);
    }

    /**
     * Batch update for frame animations
     */
    update(_dt: number): void {
        // TODO: Handle fading, pulsing, etc.
    }
}

// Singleton instances
export const visualStore = new VisualStore();
export const visualSystem = new VisualSystem(visualStore);
