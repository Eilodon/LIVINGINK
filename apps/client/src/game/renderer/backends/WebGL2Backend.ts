/**
 * EIDOLON-V P1-1: WebGL2 Render Backend Implementation
 * 
 * Production-ready WebGL2 backend implementing IRenderBackend.
 * Uses hardware instancing for O(1) draw calls per entity type.
 * Features:
 * - Instanced Circle Rendering (SDF-based for infinite resolution)
 * - Ring Rendering (SDF-based)
 * - Dynamic Batching
 */

import {
    IRenderBackend,
    RenderBatch,
    RenderViewport,
    RenderBackendType,
    RenderCapability,
} from './IRenderBackend';

// Shader Sources
const CIRCLE_VS = `#version 300 es
precision highp float;

// Per-vertex (Quad)
layout(location = 0) in vec2 a_pos;

// Per-instance
layout(location = 1) in vec2 a_instancePos; // World Position
layout(location = 2) in float a_instanceSize; // Radius
layout(location = 3) in uint a_instanceColor; // Packed ABGR

uniform mat4 u_projection;
uniform mat4 u_view;

out vec2 v_uv;
out vec4 v_color;

vec4 unpackColor(uint c) {
  return vec4(
    float((c >> 0u) & 0xFFu) / 255.0,
    float((c >> 8u) & 0xFFu) / 255.0,
    float((c >> 16u) & 0xFFu) / 255.0,
    1.0 // Alpha handled via edge fade, assume opaque core
  );
}

void main() {
  v_uv = a_pos; // -1 to 1
  v_color = unpackColor(a_instanceColor);
  
  // Billboard calculation
  vec2 worldPos = a_instancePos + (a_pos * a_instanceSize);
  gl_Position = u_projection * u_view * vec4(worldPos, 0.0, 1.0);
}
`;

const CIRCLE_FS = `#version 300 es
precision highp float;

in vec2 v_uv;
in vec4 v_color;

out vec4 fragColor;

void main() {
  // SDF Circle: distance from center (0,0)
  float dist = length(v_uv);
  
  // Anti-aliased edge (fwidth for consistent AA width regardless of zoom)
  float delta = fwidth(dist);
  float alpha = 1.0 - smoothstep(1.0 - delta, 1.0, dist);
  
  // Optional: Inner border for cells
  // float border = smoothstep(0.85, 0.9, dist);
  // vec3 finalColor = mix(v_color.rgb, v_color.rgb * 0.8, border);

  if (alpha <= 0.0) discard;
  
  fragColor = vec4(v_color.rgb, v_color.a * alpha);
}
`;

const RING_VS = `#version 300 es
precision highp float;

layout(location = 0) in vec2 a_pos; // -1 to +1 quad covering screen or area

uniform vec2 u_center;
uniform float u_outerRadius;
uniform mat4 u_projection;
uniform mat4 u_view;

out vec2 v_worldPos;

void main() {
  // Expand quad to cover ring area + padding
  vec2 worldPos = u_center + (a_pos * u_outerRadius * 1.1);
  v_worldPos = worldPos;
  gl_Position = u_projection * u_view * vec4(worldPos, 0.0, 1.0);
}
`;

const RING_FS = `#version 300 es
precision highp float;

in vec2 v_worldPos;

uniform vec2 u_center;
uniform float u_innerRadius;
uniform float u_outerRadius;
uniform vec4 u_color;

out vec4 fragColor;

void main() {
  float dist = distance(v_worldPos, u_center);
  
  // SDF Ring
  // Inside outer radius AND outside inner radius
  float alphaOuter = 1.0 - smoothstep(u_outerRadius - 2.0, u_outerRadius, dist);
  float alphaInner = smoothstep(u_innerRadius, u_innerRadius + 2.0, dist);
  
  float alpha = alphaOuter * alphaInner;
  
  if (alpha <= 0.0) discard;
  
  fragColor = vec4(u_color.rgb, u_color.a * alpha);
}
`;

export class WebGL2Backend implements IRenderBackend {
    readonly type = RenderBackendType.WEBGL2;
    readonly capabilities = RenderCapability.INSTANCING | RenderCapability.MULTI_DRAW;

    private gl: WebGL2RenderingContext | null = null;
    private canvas: HTMLCanvasElement | null = null;

    // State
    private viewport: RenderViewport = { x: 0, y: 0, width: 800, height: 600, zoom: 1 };
    private drawCalls = 0;
    private triangles = 0;

    // Shaders
    private circleProgram: WebGLProgram | null = null;
    private ringProgram: WebGLProgram | null = null;

    // Locations
    private uProjCircle: WebGLUniformLocation | null = null;
    private uViewCircle: WebGLUniformLocation | null = null;

    private uProjRing: WebGLUniformLocation | null = null;
    private uViewRing: WebGLUniformLocation | null = null;
    private uCenterRing: WebGLUniformLocation | null = null;
    private uInnerRing: WebGLUniformLocation | null = null;
    private uOuterRing: WebGLUniformLocation | null = null;
    private uColorRing: WebGLUniformLocation | null = null;

    // Buffers
    private quadVBO: WebGLBuffer | null = null; // Shared quad geometry
    private instanceVBOs: {
        pos: WebGLBuffer | null;
        size: WebGLBuffer | null;
        color: WebGLBuffer | null;
    } = { pos: null, size: null, color: null };

    private circleVAO: WebGLVertexArrayObject | null = null;

    async init(canvas: HTMLCanvasElement): Promise<boolean> {
        this.canvas = canvas;
        this.gl = canvas.getContext('webgl2', {
            alpha: false,
            antialias: false,
            powerPreference: 'high-performance',
            desynchronized: true
        });

        if (!this.gl) {
            console.error('WebGL2 not supported');
            return false;
        }

        // Enable Blending
        this.gl.enable(this.gl.BLEND);
        this.gl.blendFunc(this.gl.SRC_ALPHA, this.gl.ONE_MINUS_SRC_ALPHA);
        this.gl.disable(this.gl.DEPTH_TEST); // 2D game

        this.initShaders();
        this.initBuffers();

        return true;
    }

    dispose(): void {
        if (!this.gl) return;
        this.gl.deleteProgram(this.circleProgram);
        this.gl.deleteProgram(this.ringProgram);
        this.gl.deleteBuffer(this.quadVBO);
        this.gl.deleteBuffer(this.instanceVBOs.pos);
        this.gl.deleteBuffer(this.instanceVBOs.size);
        this.gl.deleteBuffer(this.instanceVBOs.color);
        this.gl.deleteVertexArray(this.circleVAO);
    }

    private initShaders() {
        if (!this.gl) return;

        // Circle Program
        this.circleProgram = this.createProgram(CIRCLE_VS, CIRCLE_FS);
        if (this.circleProgram) {
            this.uProjCircle = this.gl.getUniformLocation(this.circleProgram, 'u_projection');
            this.uViewCircle = this.gl.getUniformLocation(this.circleProgram, 'u_view');
        }

        // Ring Program
        this.ringProgram = this.createProgram(RING_VS, RING_FS);
        if (this.ringProgram) {
            this.uProjRing = this.gl.getUniformLocation(this.ringProgram, 'u_projection');
            this.uViewRing = this.gl.getUniformLocation(this.ringProgram, 'u_view');
            this.uCenterRing = this.gl.getUniformLocation(this.ringProgram, 'u_center');
            this.uInnerRing = this.gl.getUniformLocation(this.ringProgram, 'u_innerRadius');
            this.uOuterRing = this.gl.getUniformLocation(this.ringProgram, 'u_outerRadius');
            this.uColorRing = this.gl.getUniformLocation(this.ringProgram, 'u_color');
        }
    }

    private initBuffers() {
        if (!this.gl) return;

        // Static Quad (-1 to 1)
        const quad = new Float32Array([
            -1, -1,
            1, -1,
            -1, 1,
            1, 1
        ]);
        this.quadVBO = this.gl.createBuffer();
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.quadVBO);
        this.gl.bufferData(this.gl.ARRAY_BUFFER, quad, this.gl.STATIC_DRAW);

        // Dynamic Instance Buffers (Initial capacity 10,000)
        // We will use bufferData to resize if needed or bufferSubData to update
        this.instanceVBOs.pos = this.gl.createBuffer();
        this.instanceVBOs.size = this.gl.createBuffer();
        this.instanceVBOs.color = this.gl.createBuffer();

        // Setup Circle VAO
        this.circleVAO = this.gl.createVertexArray();
        this.gl.bindVertexArray(this.circleVAO);

        // 0: Quad Geometry (Per Vertex)
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.quadVBO);
        this.gl.enableVertexAttribArray(0);
        this.gl.vertexAttribPointer(0, 2, this.gl.FLOAT, false, 0, 0);

        // 1: Instance Position (Per Instance)
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.instanceVBOs.pos);
        this.gl.enableVertexAttribArray(1);
        this.gl.vertexAttribPointer(1, 2, this.gl.FLOAT, false, 0, 0);
        this.gl.vertexAttribDivisor(1, 1);

        // 2: Instance Size (Per Instance)
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.instanceVBOs.size);
        this.gl.enableVertexAttribArray(2);
        this.gl.vertexAttribPointer(2, 1, this.gl.FLOAT, false, 0, 0);
        this.gl.vertexAttribDivisor(2, 1);

        // 3: Instance Color (Per Instance)
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.instanceVBOs.color);
        this.gl.enableVertexAttribArray(3);
        this.gl.vertexAttribIPointer(3, 1, this.gl.UNSIGNED_INT, 0, 0); // Note: IPointer for uint
        this.gl.vertexAttribDivisor(3, 1);

        this.gl.bindVertexArray(null);
    }

    beginFrame(): void {
        if (!this.gl) return;
        this.drawCalls = 0;
        this.triangles = 0;
        // Clearing is usually handled by the game loop, but method exists
    }

    endFrame(): void {
        // Flush if needed
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
        // Fallback: Creates a single-item batch
        // Inefficient, but functional
        const pos = new Float32Array([x, y]);
        const size = new Float32Array([radius]);
        const col = new Uint32Array([color]);
        this.drawCircleBatch({ type: 0, count: 1, positions: pos, scales: size, colors: col });
    }

    drawCircleBatch(batch: RenderBatch): void {
        if (!this.gl || !this.circleProgram || batch.count === 0) return;

        this.gl.useProgram(this.circleProgram);

        // Update Uniforms
        this.uploadMatrixUniforms(this.uProjCircle, this.uViewCircle);

        this.gl.bindVertexArray(this.circleVAO);

        // Upload Instance Data (Buffer Orphan/SubData)
        // Note: In production, consider double-buffering or mapping
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.instanceVBOs.pos);
        this.gl.bufferData(this.gl.ARRAY_BUFFER, batch.positions, this.gl.DYNAMIC_DRAW);

        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.instanceVBOs.size);
        this.gl.bufferData(this.gl.ARRAY_BUFFER, batch.scales, this.gl.DYNAMIC_DRAW);

        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.instanceVBOs.color);
        this.gl.bufferData(this.gl.ARRAY_BUFFER, batch.colors, this.gl.DYNAMIC_DRAW);

        // Draw
        this.gl.drawArraysInstanced(this.gl.TRIANGLE_STRIP, 0, 4, batch.count);

        this.drawCalls++;
        this.triangles += batch.count * 2;
        this.gl.bindVertexArray(null);
    }

    drawRing(centerX: number, centerY: number, innerRadius: number, outerRadius: number, color: number): void {
        if (!this.gl || !this.ringProgram) return;

        this.gl.useProgram(this.ringProgram);

        // Common Uniforms
        this.uploadMatrixUniforms(this.uProjRing, this.uViewRing);

        // Ring Specifics
        this.gl.uniform2f(this.uCenterRing, centerX, centerY);
        this.gl.uniform1f(this.uInnerRing, innerRadius);
        this.gl.uniform1f(this.uOuterRing, outerRadius);

        const r = ((color >> 16) & 0xff) / 255;
        const g = ((color >> 8) & 0xff) / 255;
        const b = (color & 0xff) / 255;
        this.gl.uniform4f(this.uColorRing, r, g, b, 1.0); // Assume opaque logic rings usually

        // Reuse Quad Buffer (index 0 is a_pos in RING_VS too)
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.quadVBO);
        this.gl.enableVertexAttribArray(0);
        this.gl.vertexAttribPointer(0, 2, this.gl.FLOAT, false, 0, 0);

        this.gl.drawArrays(this.gl.TRIANGLE_STRIP, 0, 4);

        this.drawCalls++;
        this.triangles += 2;
    }

    drawText(text: string, x: number, y: number, size: number, color: number): void {
        // Not implemented in WebGL2 yet. Use overlay.
    }

    getDrawCallCount(): number {
        return this.drawCalls;
    }

    getTriangleCount(): number {
        return this.triangles;
    }

    // --- Helpers ---

    private uploadMatrixUniforms(uProj: WebGLUniformLocation | null, uView: WebGLUniformLocation | null) {
        if (!this.gl) return;

        // Projection: Ortho (0, width, height, 0)
        // 2D Projection Mapping
        const w = this.viewport.width / 2;
        const h = this.viewport.height / 2;

        // Simple Ortho Projection Matrix
        // left: -w, right: w, bottom: -h, top: h
        const invZoom = 1.0 / this.viewport.zoom;
        const left = -w * invZoom;
        const right = w * invZoom;
        const bottom = -h * invZoom;
        const top = h * invZoom;

        // Row-major or Col-major? WebGL is Col-major.
        // Ortho matrix:
        // 2/(r-l)    0         0        -(r+l)/(r-l)
        // 0          2/(t-b)   0        -(t+b)/(t-b)
        // 0          0        -2/(f-n)  -(f+n)/(f-n)
        // 0          0         0        1

        const proj = new Float32Array([
            2 / (right - left), 0, 0, 0,
            0, 2 / (top - bottom), 0, 0,
            0, 0, -1, 0,
            -(right + left) / (right - left), -(top + bottom) / (top - bottom), 0, 1
        ]);

        // View Matrix: Translate camera
        // Camera is at viewport.x, viewport.y
        const tx = -this.viewport.x;
        const ty = -this.viewport.y;
        const view = new Float32Array([
            1, 0, 0, 0,
            0, 1, 0, 0,
            0, 0, 1, 0,
            tx, ty, 0, 1
        ]);

        this.gl.uniformMatrix4fv(uProj, false, proj);
        this.gl.uniformMatrix4fv(uView, false, view);
    }

    // EIDOLON-V AUDIT FIX: Detach and delete shaders after linking to prevent GPU resource leak
    private createProgram(vsSource: string, fsSource: string): WebGLProgram | null {
        if (!this.gl) return null;
        const vs = this.compileShader(vsSource, this.gl.VERTEX_SHADER);
        const fs = this.compileShader(fsSource, this.gl.FRAGMENT_SHADER);
        if (!vs || !fs) {
            if (vs) this.gl.deleteShader(vs);
            if (fs) this.gl.deleteShader(fs);
            return null;
        }

        const program = this.gl.createProgram();
        if (!program) {
            this.gl.deleteShader(vs);
            this.gl.deleteShader(fs);
            return null;
        }

        this.gl.attachShader(program, vs);
        this.gl.attachShader(program, fs);
        this.gl.linkProgram(program);

        // Always detach and delete shaders after linking (GPU retains internal copy)
        this.gl.detachShader(program, vs);
        this.gl.detachShader(program, fs);
        this.gl.deleteShader(vs);
        this.gl.deleteShader(fs);

        if (!this.gl.getProgramParameter(program, this.gl.LINK_STATUS)) {
            console.error(this.gl.getProgramInfoLog(program));
            this.gl.deleteProgram(program);
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
            console.error(this.gl.getShaderInfoLog(shader));
            this.gl.deleteShader(shader);
            return null;
        }
        return shader;
    }
}
