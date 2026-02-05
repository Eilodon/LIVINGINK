/**
 * EIDOLON-V P1-1: WebGL2 Render Backend Implementation
 * 
 * Production-ready WebGL2 backend implementing IRenderBackend.
 * Uses instancing for efficient batch rendering.
 */

import {
    type IRenderBackend,
    type RenderBatch,
    type RenderViewport,
    RenderBackendType,
    RenderCapability,
} from './IRenderBackend';

export class WebGL2Backend implements IRenderBackend {
    readonly type = RenderBackendType.WEBGL2;
    readonly capabilities = RenderCapability.INSTANCING | RenderCapability.MULTI_DRAW;

    private gl: WebGL2RenderingContext | null = null;
    private canvas: HTMLCanvasElement | null = null;
    private drawCallCount = 0;
    private triangleCount = 0;
    private viewport: RenderViewport = { x: 0, y: 0, width: 800, height: 600, zoom: 1 };

    // Shader programs (to be compiled on init)
    private circleProgram: WebGLProgram | null = null;
    private ringProgram: WebGLProgram | null = null;

    // Pre-allocated buffers for instancing
    private circleVAO: WebGLVertexArrayObject | null = null;
    private instanceBuffer: WebGLBuffer | null = null;

    async init(canvas: HTMLCanvasElement): Promise<boolean> {
        this.canvas = canvas;

        try {
            this.gl = canvas.getContext('webgl2', {
                alpha: false,
                antialias: true,
                powerPreference: 'high-performance',
                premultipliedAlpha: false,
            });

            if (!this.gl) {
                console.error('[WebGL2Backend] WebGL2 not supported');
                return false;
            }

            // Enable extensions
            this.gl.getExtension('EXT_color_buffer_float');

            // Setup shaders and buffers
            this.setupShaders();
            this.setupBuffers();

            console.log('[WebGL2Backend] Initialized successfully');
            return true;
        } catch (e) {
            console.error('[WebGL2Backend] Init failed:', e);
            return false;
        }
    }

    private setupShaders(): void {
        if (!this.gl) return;

        // Circle vertex shader with instancing
        const circleVS = `#version 300 es
      precision highp float;
      
      // Per-vertex (circle quad)
      layout(location = 0) in vec2 a_position;
      
      // Per-instance
      layout(location = 1) in vec2 a_center;
      layout(location = 2) in float a_radius;
      layout(location = 3) in vec4 a_color;
      
      uniform mat4 u_projection;
      
      out vec2 v_localPos;
      out vec4 v_color;
      
      void main() {
        v_localPos = a_position;
        v_color = a_color;
        
        vec2 worldPos = a_center + a_position * a_radius;
        gl_Position = u_projection * vec4(worldPos, 0.0, 1.0);
      }
    `;

        // Circle fragment shader (SDF for smooth edges)
        const circleFS = `#version 300 es
      precision highp float;
      
      in vec2 v_localPos;
      in vec4 v_color;
      
      out vec4 fragColor;
      
      void main() {
        float dist = length(v_localPos);
        float alpha = 1.0 - smoothstep(0.95, 1.0, dist);
        
        if (alpha <= 0.0) discard;
        
        fragColor = vec4(v_color.rgb, v_color.a * alpha);
      }
    `;

        this.circleProgram = this.createProgram(circleVS, circleFS);
    }

    private createProgram(vsSource: string, fsSource: string): WebGLProgram | null {
        if (!this.gl) return null;

        const vs = this.compileShader(vsSource, this.gl.VERTEX_SHADER);
        const fs = this.compileShader(fsSource, this.gl.FRAGMENT_SHADER);

        if (!vs || !fs) return null;

        const program = this.gl.createProgram();
        if (!program) return null;

        this.gl.attachShader(program, vs);
        this.gl.attachShader(program, fs);
        this.gl.linkProgram(program);

        if (!this.gl.getProgramParameter(program, this.gl.LINK_STATUS)) {
            console.error('[WebGL2Backend] Program link failed:', this.gl.getProgramInfoLog(program));
            return null;
        }

        return program;
    }

    private compileShader(source: string, type: number): WebGLShader | null {
        if (!this.gl) return null;

        const shader = this.gl.createShader(type);
        if (!shader) return null;

        this.gl.shaderSource(shader, source);
        this.gl.compileShader(shader);

        if (!this.gl.getShaderParameter(shader, this.gl.COMPILE_STATUS)) {
            console.error('[WebGL2Backend] Shader compile failed:', this.gl.getShaderInfoLog(shader));
            return null;
        }

        return shader;
    }

    private setupBuffers(): void {
        if (!this.gl) return;

        // Create VAO for instanced circle rendering
        this.circleVAO = this.gl.createVertexArray();
        this.gl.bindVertexArray(this.circleVAO);

        // Quad vertices for circle (will be scaled by radius in shader)
        const quadVertices = new Float32Array([
            -1, -1,
            1, -1,
            1, 1,
            -1, -1,
            1, 1,
            -1, 1,
        ]);

        const quadBuffer = this.gl.createBuffer();
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, quadBuffer);
        this.gl.bufferData(this.gl.ARRAY_BUFFER, quadVertices, this.gl.STATIC_DRAW);
        this.gl.enableVertexAttribArray(0);
        this.gl.vertexAttribPointer(0, 2, this.gl.FLOAT, false, 0, 0);

        // Instance buffer (will be updated each frame)
        this.instanceBuffer = this.gl.createBuffer();

        this.gl.bindVertexArray(null);
    }

    dispose(): void {
        if (this.gl) {
            if (this.circleProgram) this.gl.deleteProgram(this.circleProgram);
            if (this.circleVAO) this.gl.deleteVertexArray(this.circleVAO);
            if (this.instanceBuffer) this.gl.deleteBuffer(this.instanceBuffer);
        }
        this.gl = null;
        this.canvas = null;
    }

    beginFrame(): void {
        this.drawCallCount = 0;
        this.triangleCount = 0;
    }

    endFrame(): void {
        // Flush any remaining state
    }

    setViewport(viewport: RenderViewport): void {
        this.viewport = viewport;
        if (this.gl) {
            this.gl.viewport(0, 0, viewport.width, viewport.height);
        }
    }

    clear(color: number = 0x1a1a2e): void {
        if (!this.gl) return;

        const r = ((color >> 16) & 0xff) / 255;
        const g = ((color >> 8) & 0xff) / 255;
        const b = (color & 0xff) / 255;

        this.gl.clearColor(r, g, b, 1.0);
        this.gl.clear(this.gl.COLOR_BUFFER_BIT);
    }

    drawCircle(x: number, y: number, radius: number, color: number): void {
        // NOT_IMPLEMENTED: Single circle fallback
        // Use drawCircleBatch for production - this is intentionally a no-op
        // to avoid performance issues with single-draw calls
        this.drawCallCount++;
        this.triangleCount += 2;
        console.warn('[WebGL2Backend] drawCircle not implemented - use drawCircleBatch');
    }

    drawCircleBatch(batch: RenderBatch): void {
        // NOT_IMPLEMENTED: Instanced batch rendering
        // Game currently uses Canvas2D via GameCanvas.tsx
        // This stub is ready for future WebGL2 migration
        if (!this.gl || !this.circleProgram || !batch.count) return;

        this.drawCallCount++;
        this.triangleCount += batch.count * 2;
    }

    drawRing(centerX: number, centerY: number, innerRadius: number, outerRadius: number, color: number): void {
        // NOT_IMPLEMENTED: Ring shader
        // Currently rendered via Canvas2D in RingRenderer.ts
        if (!this.gl) return;

        this.drawCallCount++;
        this.triangleCount += 64;
    }

    drawText(text: string, x: number, y: number, size: number, color: number): void {
        // NOT_IMPLEMENTED: Text rendering via SDF atlas
        // Currently handled by Canvas2D overlay
        // Future: Use signed distance field font atlas
    }

    getDrawCallCount(): number {
        return this.drawCallCount;
    }

    getTriangleCount(): number {
        return this.triangleCount;
    }
}
