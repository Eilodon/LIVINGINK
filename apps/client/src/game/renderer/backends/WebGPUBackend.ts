/**
 * EIDOLON-V P1-1: WebGPU Render Backend Stub
 * 
 * Placeholder for future WebGPU implementation.
 * WebGPU offers significant performance improvements:
 * - Compute shaders for physics/particles
 * - Storage buffers for large entity counts
 * - Bindless rendering
 * - Multi-threaded command encoding
 * 
 * Current status: Stub - delegates to WebGL2Backend for now
 */

import {
    type IRenderBackend,
    type RenderBatch,
    type RenderViewport,
    RenderBackendType,
    RenderCapability,
} from './IRenderBackend';

export class WebGPUBackend implements IRenderBackend {
    readonly type = RenderBackendType.WEBGPU;
    readonly capabilities =
        RenderCapability.INSTANCING |
        RenderCapability.COMPUTE_SHADERS |
        RenderCapability.STORAGE_BUFFERS |
        RenderCapability.INDIRECT_DRAW |
        RenderCapability.MULTI_DRAW;

    private device: GPUDevice | null = null;
    private context: GPUCanvasContext | null = null;
    private canvas: HTMLCanvasElement | null = null;
    private drawCallCount = 0;
    private triangleCount = 0;

    async init(canvas: HTMLCanvasElement): Promise<boolean> {
        this.canvas = canvas;

        if (!('gpu' in navigator)) {
            console.warn('[WebGPUBackend] WebGPU not available, falling back');
            return false;
        }

        try {
            const adapter = await (navigator as any).gpu.requestAdapter({
                powerPreference: 'high-performance',
            });

            if (!adapter) {
                console.warn('[WebGPUBackend] No adapter found');
                return false;
            }

            this.device = await adapter.requestDevice({
                requiredFeatures: [],
                requiredLimits: {},
            });

            this.context = canvas.getContext('webgpu') as GPUCanvasContext;
            if (!this.context) {
                console.warn('[WebGPUBackend] Could not get WebGPU context');
                return false;
            }

            this.context.configure({
                device: this.device!,
                format: navigator.gpu.getPreferredCanvasFormat(),
                alphaMode: 'opaque',
            });

            console.log('[WebGPUBackend] Initialized successfully');
            return true;
        } catch (e) {
            console.warn('[WebGPUBackend] Init failed:', e);
            return false;
        }
    }

    dispose(): void {
        if (this.device) {
            this.device.destroy();
        }
        this.device = null;
        this.context = null;
        this.canvas = null;
    }

    beginFrame(): void {
        this.drawCallCount = 0;
        this.triangleCount = 0;
    }

    endFrame(): void {
        // Submit command buffer
    }

    setViewport(viewport: RenderViewport): void {
        // WebGPU viewport is set per render pass
    }

    clear(color: number = 0x1a1a2e): void {
        // Clear is done via render pass load action
    }

    drawCircle(x: number, y: number, radius: number, color: number): void {
        // NOT_IMPLEMENTED: WebGPU stub - game uses Canvas2D
        this.drawCallCount++;
        this.triangleCount += 2;
    }

    drawCircleBatch(batch: RenderBatch): void {
        // NOT_IMPLEMENTED: WebGPU instanced rendering with compute shader
        // Future: Use compute shader for transform calculations
        if (!batch.count) return;
        this.drawCallCount++;
        this.triangleCount += batch.count * 2;
    }

    drawRing(centerX: number, centerY: number, innerRadius: number, outerRadius: number, color: number): void {
        // NOT_IMPLEMENTED: WebGPU ring shader
        this.drawCallCount++;
        this.triangleCount += 64;
    }

    drawText(text: string, x: number, y: number, size: number, color: number): void {
        // NOT_IMPLEMENTED: SDF text atlas
        // Future: Use signed distance field font rendering
    }

    getDrawCallCount(): number {
        return this.drawCallCount;
    }

    getTriangleCount(): number {
        return this.triangleCount;
    }
}
