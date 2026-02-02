/**
 * EIDOLON-V P1-1: Render Backend Factory & Exports
 * 
 * Auto-selects best available backend based on browser capabilities.
 */

export { type IRenderBackend, RenderBackendType, RenderCapability, detectBestBackend, isWebGPUAvailable } from './IRenderBackend';
export type { RenderBatch, RenderViewport } from './IRenderBackend';
export { WebGL2Backend } from './WebGL2Backend';
export { WebGPUBackend } from './WebGPUBackend';

import { detectBestBackend, RenderBackendType, type IRenderBackend } from './IRenderBackend';
import { WebGL2Backend } from './WebGL2Backend';
import { WebGPUBackend } from './WebGPUBackend';

/**
 * Create the best available render backend for the current browser.
 * Falls back gracefully: WebGPU -> WebGL2 -> WebGL1 (error)
 */
export async function createRenderBackend(canvas: HTMLCanvasElement): Promise<IRenderBackend | null> {
    const preferredType = detectBestBackend();

    // Try WebGPU first if detected
    if (preferredType === RenderBackendType.WEBGPU) {
        const webgpu = new WebGPUBackend();
        if (await webgpu.init(canvas)) {
            console.log('[RenderBackend] Using WebGPU');
            return webgpu;
        }
        console.warn('[RenderBackend] WebGPU init failed, falling back to WebGL2');
    }

    // Try WebGL2
    const webgl2 = new WebGL2Backend();
    if (await webgl2.init(canvas)) {
        console.log('[RenderBackend] Using WebGL2');
        return webgl2;
    }

    console.error('[RenderBackend] No suitable backend available');
    return null;
}
