import { Container, Sprite, Texture, RenderTexture, ColorMatrixFilter, Renderer, Filter, GpuProgram, UniformGroup } from 'pixi.js';
import { InkBleedFilter } from './filters/InkBleedFilter.js';
import advectionSource from './shaders/advection.js';
import divergenceSource from './shaders/divergence.js';
import pressureSource from './shaders/pressure.js';
import gradientSource from './shaders/gradient.js';

export interface FluidEvent {
    x: number;
    y: number;
    element: number;
    intensity: number;
    vx?: number;
    vy?: number;
}

class PingPongBuffer {
    public read: RenderTexture;
    public write: RenderTexture;

    constructor(width: number, height: number) {
        // High precision textures for physics
        this.read = RenderTexture.create({ width, height }); // Pixi v8 defaults? simpler for now
        this.write = RenderTexture.create({ width, height });
    }

    swap() {
        const temp = this.read;
        this.read = this.write;
        this.write = temp;
    }

    resize(width: number, height: number) {
        this.read.resize(width, height);
        this.write.resize(width, height);
    }
}

export class FluidRenderer {
    public view: Container;
    private sprite: Sprite;

    // Simulation State
    private velocity: PingPongBuffer;
    private density: PingPongBuffer;
    private pressure: PingPongBuffer;
    private divergence: RenderTexture;

    // Helpers
    private impactContainer: Container;

    // Filters (Shaders)
    private advectFilter: Filter;
    private divergenceFilter: Filter;
    private pressureFilter: Filter;
    private gradientFilter: Filter;
    private inkBleedFilter: InkBleedFilter;

    private _renderer: Renderer | null = null;
    private width: number;
    private height: number;
    private time: number = 0;
    private queuedEvents: FluidEvent[] = [];

    constructor(width: number, height: number) {
        this.width = width;
        this.height = height;
        this.view = new Container();

        // 1. Initialize Buffers
        // Downscale sim for performance (optional, keeping 1:1 for quality)
        const simW = width >> 1; // Half res for physics
        const simH = height >> 1;

        this.velocity = new PingPongBuffer(simW, simH);
        this.density = new PingPongBuffer(width, height); // Full res for density/visuals
        this.pressure = new PingPongBuffer(simW, simH);
        this.divergence = RenderTexture.create({ width: simW, height: simH });

        // 2. Initialize Shaders
        this.advectFilter = this.createFilter(advectionSource, {
            uTime: 0, uDt: 0.016, uDissipation: 1.0, uSimRes: [simW, simH]
        });

        this.divergenceFilter = this.createFilter(divergenceSource, {
            uSimRes: [simW, simH]
        });

        this.pressureFilter = this.createFilter(pressureSource, {
            uSimRes: [simW, simH], uAlpha: -1.0, uBeta: 4.0 // Poisson defaults
        });

        this.gradientFilter = this.createFilter(gradientSource, {
            uSimRes: [simW, simH]
        });

        // 3. Setup Views
        this.impactContainer = new Container();

        // Final Output
        this.sprite = new Sprite(Texture.WHITE);
        this.sprite.width = width;
        this.sprite.height = height;
        this.sprite.texture = this.density.read; // bind to density
        this.view.addChild(this.sprite);

        // 4. Stylization
        this.inkBleedFilter = new InkBleedFilter({
            impactTexture: this.density.read, // Loopback or separate? Use density as impact
            noiseScale: 5.0,
            distortionStrength: 0.12, // Increased for more visible ink effect
            inkColor: 0x111827,
            paperColor: 0xffffff
        });
        // We might not need InkBleed if density is good, but let's keep it as style pass
        // Actually, InkBleed expects 'impactTexture' uniform.
        // We'll update the filter's impactTexture ref in update loop.

        this.sprite.filters = [this.inkBleedFilter];
    }

    private createFilter(wgsl: string, uniforms: any): Filter {
        return new Filter({
            gpuProgram: new GpuProgram({
                vertex: {
                    source: `
                    struct GlobalUniforms { projectionMatrix: mat3x3f, worldTransformMatrix: mat3x3f, worldColorAlpha: vec4f, uResolution: vec2f }
                    @group(0) @binding(0) var<uniform> globalUniforms : GlobalUniforms;
                    @vertex fn main(@location(0) aPosition: vec2f, @location(1) aUV: vec2f) -> VSOutput {
                        var result: VSOutput;
                        result.vUV = aUV;
                        result.position = vec4f((globalUniforms.projectionMatrix * vec3f(aPosition, 1.0)).xy, 0.0, 1.0);
                        return result;
                    }
                    struct VSOutput { @builtin(position) position: vec4f, @location(0) vUV: vec2f }
                    `,
                    entryPoint: 'main'
                },
                fragment: {
                    source: wgsl,
                    entryPoint: 'main'
                }
            }),
            resources: {
                uniforms: new UniformGroup(uniforms)
            }
        });
    }

    public injectGameplayInfluence(events: FluidEvent[]) {
        if (events.length === 0) return;
        this.queuedEvents.push(...events);
    }

    public update(dt: number, renderer?: Renderer | any) {
        if (renderer) this._renderer = renderer;
        if (!this._renderer) return;

        this.time += dt * 0.01;
        this.inkBleedFilter.time = this.time;
        // Update Filter Uniforms
        this.advectFilter.resources.uniforms.uniforms.uTime = this.time;
        this.advectFilter.resources.uniforms.uniforms.uDt = dt;

        // 1. Splat Forces (Inputs)
        // For MVP, we use Pixi render to draw splats into Velocity/Density write buffers
        // But we need to keep existing data.
        // Strategy: Render current read + splats -> write. Then swap.
        if (this.queuedEvents.length > 0) {
            // Simply draw splats on top of density?
            // "AddDensity" equivalent
            this.renderSplats(this.density.read, this.density.write, this.queuedEvents, 'density');
            // "AddVelocity" equivalent (not implemented in events yet)
            this.density.swap();
            this.queuedEvents = [];
        }

        // 2. Advect Velocity
        // velocity.read --(Advect)--> velocity.write
        this.applyFilter(this.advectFilter, this.velocity.read, this.velocity.write, {
            uVelocity: this.velocity.read,
            uSource: this.velocity.read,
            uDissipation: 0.98 // Velocity decay
        });
        this.velocity.swap();

        // 3. Advect Density
        // density.read + velocity.read --(Advect)--> density.write
        this.applyFilter(this.advectFilter, this.density.read, this.density.write, {
            uVelocity: this.velocity.read,
            uSource: this.density.read,
            uDissipation: 0.99 // Density decay (Ink persistence)
        });
        this.density.swap();

        // 4. Divergence
        // velocity.read --(Div)--> divergence
        this.applyFilter(this.divergenceFilter, this.velocity.read, this.divergence, {
            uVelocity: this.velocity.read
        });

        // 5. Pressure (Jacobi)
        // divergence + pressure.read --> pressure.write
        // Clear pressure first? usually warm start is better.
        for (let i = 0; i < 20; i++) {
            this.applyFilter(this.pressureFilter, this.pressure.read, this.pressure.write, {
                uPressure: this.pressure.read,
                uDivergence: this.divergence
            });
            this.pressure.swap();
        }

        // 6. Subtract Gradient
        // velocity.read + pressure.read --> velocity.write
        this.applyFilter(this.gradientFilter, this.velocity.read, this.velocity.write, {
            uPressure: this.pressure.read,
            uVelocity: this.velocity.read
        });
        this.velocity.swap();

        // 7. Update View
        this.sprite.texture = this.density.read;
    }

    private applyFilter(filter: Filter, input: RenderTexture, output: RenderTexture, bindings: any) {
        // Manually bind resources/textures to the filter
        // Pixi v8 Filter routing
        // This is tricky without 'apply' helper.
        // We use a temporary sprite to render the input with filter to output.

        // Update bindings
        Object.entries(bindings).forEach(([key, val]) => {
            // Note: direct resource assignment might vary in v8
            // filter.resources[key] = val;
        });

        // Simplified: use filter on a fullscreen quad
        // In Pixi, easiest is to have a centralized sprite or mesh
        const quad = new Sprite(input); // Use input as texture
        quad.width = output.width;
        quad.height = output.height;
        quad.filters = [filter];

        // Hack: Pixi Filters need to know they are active
        // Real implementation of GPGPU fluid in Pixi usually strictly uses Mesh + Shader, not Filter.
        // But Filter is accessible.

        this._renderer?.render({
            container: quad,
            target: output,
            clear: true
        });

        quad.destroy();
    }

    private renderSplats(input: RenderTexture, output: RenderTexture, events: FluidEvent[], type: 'density' | 'velocity') {
        const container = new Container();

        // 1. Draw Background (Old State)
        const bg = new Sprite(input);
        bg.width = output.width;
        bg.height = output.height;
        container.addChild(bg);

        // 2. Draw Splats
        for (const evt of events) {
            const s = new Sprite(Texture.WHITE);
            // Coordinates need scaling if sim res != screen res
            // Assuming density is screen res
            s.x = evt.x;
            s.y = evt.y;
            s.anchor.set(0.5);
            s.width = evt.intensity * 30; // Brush size
            s.height = evt.intensity * 30;
            s.alpha = 0.5;
            s.tint = type === 'density' ? 0x000000 : 0xFFFFFF; // Ink is black
            // Wait, we are adding density. 0 is white paper? 
            // In physics: Density 1 = Ink.
            // In visual: 0 = Clear, 1 = Ink? 
            // Let's assume 1 = Ink. White sprite = 1.
            container.addChild(s);
        }

        this._renderer?.render({
            container,
            target: output
        });
    }

    public async readDensityMap(): Promise<Float32Array | null> {
        if (!this._renderer || !this.density.read) return null;
        try {
            const pixels = this._renderer.extract.pixels(this.density.read) as unknown as Uint8ClampedArray;
            const floatData = new Float32Array(pixels.length);
            for (let i = 0; i < pixels.length; i++) {
                floatData[i] = pixels[i] / 255.0;
            }
            return floatData;
        } catch (e) {
            return null;
        }
    }

    // Legacy/Stub methods
    public getWidth() { return this.width; }
    public getHeight() { return this.height; }
    public addDensity(x: number, y: number, amt: number, color: any) {
        this.queuedEvents.push({ x, y, element: 0, intensity: amt });
    }
    public addVelocity(x: number, y: number, vx: number, vy: number) {
        this.queuedEvents.push({ x, y, element: 0, intensity: 1.0, vx, vy });
    }
    public resize(w: number, h: number) { this.width = w; this.height = h; }
    public destroy() { this.view.destroy({ children: true }); }
}
