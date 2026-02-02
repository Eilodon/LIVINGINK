/**
 * EIDOLON-V P1-1: Render Backend Abstraction Layer
 * 
 * This interface defines the contract for render backends (WebGL2, WebGPU).
 * Allows seamless migration from WebGL2 to WebGPU when browser support improves.
 * 
 * Design principles:
 * - Zero-allocation hot path
 * - Batch rendering for performance
 * - Backend-agnostic API
 */

import type { RenderEntity, Vec2, RGB } from '../RenderTypes';

// Backend capability flags
export const enum RenderCapability {
    INSTANCING = 1 << 0,
    COMPUTE_SHADERS = 1 << 1,
    STORAGE_BUFFERS = 1 << 2,
    INDIRECT_DRAW = 1 << 3,
    MULTI_DRAW = 1 << 4,
}

// Backend type enum
export const enum RenderBackendType {
    WEBGL1 = 'webgl1',
    WEBGL2 = 'webgl2',
    WEBGPU = 'webgpu',
}

// Render batch for instanced rendering
export interface RenderBatch {
    readonly type: number; // EntityType
    readonly count: number;
    // TypedArrays for zero-alloc update
    positions: Float32Array; // [x, y, x, y, ...]
    scales: Float32Array; // [scale, scale, ...]
    colors: Uint32Array; // [packed color, ...]
}

// Camera/viewport info
export interface RenderViewport {
    x: number;
    y: number;
    width: number;
    height: number;
    zoom: number;
}

/**
 * The core render backend interface.
 * Implementations: WebGL2Backend, WebGPUBackend
 */
export interface IRenderBackend {
    // Lifecycle
    readonly type: RenderBackendType;
    readonly capabilities: number; // Bitfield of RenderCapability

    init(canvas: HTMLCanvasElement): Promise<boolean>;
    dispose(): void;

    // Frame control
    beginFrame(): void;
    endFrame(): void;

    // Viewport
    setViewport(viewport: RenderViewport): void;

    // Clear
    clear(color?: number): void;

    // Entity rendering (batch-friendly)
    drawCircle(x: number, y: number, radius: number, color: number): void;
    drawCircleBatch(batch: RenderBatch): void;

    // Ring rendering
    drawRing(centerX: number, centerY: number, innerRadius: number, outerRadius: number, color: number): void;

    // Text rendering (via sprite atlas or canvas fallback)
    drawText(text: string, x: number, y: number, size: number, color: number): void;

    // Stats
    getDrawCallCount(): number;
    getTriangleCount(): number;
}

/**
 * Feature detection for backend selection
 */
export function detectBestBackend(): RenderBackendType {
    // Check WebGPU support (SOTA 2026)
    if (typeof navigator !== 'undefined' && 'gpu' in navigator) {
        return RenderBackendType.WEBGPU;
    }

    // Check WebGL2 support
    try {
        const canvas = document.createElement('canvas');
        if (canvas.getContext('webgl2')) {
            return RenderBackendType.WEBGL2;
        }
    } catch (e) {
        // Ignore
    }

    // Fallback to WebGL1 (legacy)
    return RenderBackendType.WEBGL1;
}

/**
 * Check if WebGPU is available
 */
export async function isWebGPUAvailable(): Promise<boolean> {
    if (typeof navigator === 'undefined' || !('gpu' in navigator)) {
        return false;
    }

    try {
        const adapter = await (navigator as any).gpu.requestAdapter();
        return adapter !== null;
    } catch (e) {
        return false;
    }
}
