import { Container, Sprite, Texture } from 'pixi.js';
import advectionShader from './shaders/advection';
import divergenceShader from './shaders/divergence';
import pressureShader from './shaders/pressure';
import gradientSubtractShader from './shaders/gradientSubtract';
import injectionShader from './shaders/injection';

export interface FluidEvent {
    x: number;
    y: number;
    element: number;
    intensity: number;
}

export class FluidRenderer {
    public view: Container;
    private sprite: Sprite;

    private device: GPUDevice | null = null;

    // Pipelines
    private advectionPipeline: GPUComputePipeline | null = null;
    private divergencePipeline: GPUComputePipeline | null = null;
    private pressurePipeline: GPUComputePipeline | null = null;
    private gradientSubtractPipeline: GPUComputePipeline | null = null;
    private injectionPipeline: GPUComputePipeline | null = null;

    // Textures (Ping-Pong)
    // Velocity: RG = xy velocity
    private velocity: { read: GPUTexture, write: GPUTexture } | null = null;
    // Density: R = density (ink amount)
    private density: { read: GPUTexture, write: GPUTexture } | null = null;
    // Pressure: R = pressure
    private pressure: { read: GPUTexture, write: GPUTexture } | null = null;
    // Divergence: R = divergence
    private divergence: GPUTexture | null = null;


    // Uniform Buffer
    private uniformBuffer: GPUBuffer | null = null;
    // Event Buffer
    private eventBuffer: GPUBuffer | null = null;
    private maxEvents: number = 64;

    private width: number;
    private height: number;
    private time: number = 0;

    constructor(width: number, height: number) {
        this.width = width;
        this.height = height;
        this.view = new Container();

        // Placeholder sprite
        this.sprite = new Sprite(Texture.WHITE);
        this.sprite.width = width;
        this.sprite.height = height;
        this.sprite.alpha = 1.0;
        this.view.addChild(this.sprite);

        this.initWebGPU();
    }

    private async initWebGPU() {
        if (!navigator.gpu) {
            console.error("WebGPU not supported");
            return;
        }
        const adapter = await navigator.gpu.requestAdapter();
        if (!adapter) {
            console.error("No WebGPU adapter");
            return;
        }
        this.device = await adapter.requestDevice();

        // 1. Create Textures
        this.velocity = this.createPingPong();
        this.density = this.createPingPong();
        this.pressure = this.createPingPong();
        this.divergence = this.createTexture();

        // 2. Uniform Buffer
        // Struct: dt (f32), resolution (vec2f), dissipation (f32) -> 16 bytes aligned
        // 4 + 8 + 4 = 16 bytes. Perfect.
        this.uniformBuffer = this.device.createBuffer({
            size: 16,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
        });

        // 3. Create Pipelines
        this.advectionPipeline = this.createPipeline(advectionShader);
        this.divergencePipeline = this.createPipeline(divergenceShader);
        this.pressurePipeline = this.createPipeline(pressureShader);
        this.gradientSubtractPipeline = this.createPipeline(gradientSubtractShader);
        this.injectionPipeline = this.createPipeline(injectionShader);

        // Event Buffer (Storage)
        // Size: 4 + 12 + (maxEvents * 16)
        // 4 bytes count, 12 bytes padding (align 16), Events array
        const bufferSize = 16 + (this.maxEvents * 16);
        this.eventBuffer = this.device.createBuffer({
            size: bufferSize,
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
        });

        console.log("FluidRenderer: WebGPU Pipelines Created");
    }

    private createTexture(): GPUTexture {
        return this.device!.createTexture({
            size: [this.width, this.height, 1],
            format: 'rgba16float',
            usage: GPUTextureUsage.STORAGE_BINDING | GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST
        });
    }

    private createPingPong() {
        return {
            read: this.createTexture(),
            write: this.createTexture()
        };
    }

    private createPipeline(shaderCode: string): GPUComputePipeline {
        return this.device!.createComputePipeline({
            layout: 'auto',
            compute: {
                module: this.device!.createShaderModule({ code: shaderCode }),
                entryPoint: 'main'
            }
        });
    }

    public injectGameplayInfluence(events: FluidEvent[]) {
        if (!this.device || !this.injectionPipeline || events.length === 0) return;

        // limited by maxEvents
        const count = Math.min(events.length, this.maxEvents);

        // Serialize Events
        // Layout: [count (u32), pad, pad, pad, Event1(16b), Event2(16b)...]
        // But Alignment: vec4<f32/u32> is 16 bytes.
        // Struct EventBuffer { count: u32, events: array<FluidEvent> }
        // Default storage buffer layout:
        // count (offset 0)
        // events (offset 16 - array element alignment)? Or offset 4?
        // Array stride is 16 bytes.
        // Let's assume offset 0 = count.
        // offset 4..16 = padding? usually runtime-sized array starts strictly aligned.
        // Let's rely on standard WGSL std430 layout usually used in WebGPU storage buffers?
        // Actually, let's write count at 0, and events starting at 16 (safe).

        const data = new ArrayBuffer(16 + (count * 16));
        const view = new DataView(data);

        view.setUint32(0, count, true); // Little endian

        for (let i = 0; i < count; i++) {
            const evt = events[i];
            const offset = 16 + (i * 16);
            view.setFloat32(offset + 0, evt.x, true);
            view.setFloat32(offset + 4, evt.y, true);
            view.setUint32(offset + 8, evt.element, true);
            view.setFloat32(offset + 12, evt.intensity, true);
        }

        this.device.queue.writeBuffer(this.eventBuffer!, 0, data);

        // Dispatch Injection
        const encoder = this.device.createCommandEncoder();
        const pass = encoder.beginComputePass();
        pass.setPipeline(this.injectionPipeline);

        const bindGroup = this.device.createBindGroup({
            layout: this.injectionPipeline.getBindGroupLayout(0),
            entries: [
                { binding: 0, resource: { buffer: this.uniformBuffer! } },
                { binding: 1, resource: this.velocity!.read.createView() },
                { binding: 2, resource: this.density!.read.createView() },
                { binding: 3, resource: this.velocity!.write.createView() },
                { binding: 4, resource: this.density!.write.createView() },
                { binding: 5, resource: { buffer: this.eventBuffer! } }
            ]
        });

        pass.setBindGroup(0, bindGroup);
        pass.dispatchWorkgroups(Math.ceil(this.width / 8), Math.ceil(this.height / 8));
        pass.end();

        this.device.queue.submit([encoder.finish()]);

        // Swap textures as we wrote to 'write'
        this.swap(this.velocity!);
        this.swap(this.density!);
    }

    public update(dt: number) {
        if (!this.device || !this.advectionPipeline) return;

        this.time += dt;

        // Update Uniforms
        const uniforms = new Float32Array([
            dt,              // dt
            this.width,      // res.x
            this.height,     // res.y
            0.99             // dissipation
        ]);
        this.device.queue.writeBuffer(this.uniformBuffer!, 0, uniforms);

        const commandEncoder = this.device.createCommandEncoder();

        // STEP 1: Advection (Velocity)
        this.dispatch(commandEncoder, this.advectionPipeline!, [
            this.velocity!.read,  // Binding 1: velocityTex (sampler)
            this.velocity!.read,  // Binding 2: sourceTex (quantity)
            this.velocity!.write  // Binding 3: resultTex
        ]);
        this.swap(this.velocity!);

        // STEP 2: Advection (Density)
        this.dispatch(commandEncoder, this.advectionPipeline!, [
            this.velocity!.read, // Binding 1: velocityTex
            this.density!.read,  // Binding 2: sourceTex
            this.density!.write  // Binding 3: resultTex
        ]);
        this.swap(this.density!);

        // STEP 3: Divergence
        this.dispatch(commandEncoder, this.divergencePipeline!, [
            this.velocity!.read, // Binding 1: velocityTex
            this.divergence!,    // Binding 2: divergenceTex
            this.velocity!.read, // Binding 3: Dummy/Unused (hack for shared layout match if needed, else bind separate group)
            // Wait, logic differs. Divergence shader binds:
            // 0: Uniforms, 1: Vel, 2: Div, 3: Sampler
            // This matches the dispatchHelper logic if we verify binding indices
        ], true); // true = Divergence Mode

        // STEP 4: Pressure (Jacobi)
        for (let i = 0; i < 20; i++) {
            this.dispatch(commandEncoder, this.pressurePipeline!, [
                this.pressure!.read, // Binding 1: pressureTex
                this.divergence!,    // Binding 2: divergenceTex
                this.pressure!.write // Binding 3: resultTex
            ]);
            this.swap(this.pressure!);
        }

        // STEP 5: Gradient Subtract
        this.dispatch(commandEncoder, this.gradientSubtractPipeline!, [
            this.pressure!.read, // Binding 1: pressureTex
            this.velocity!.read, // Binding 2: velocityTex
            this.velocity!.write // Binding 3: resultTex
        ]);
        this.swap(this.velocity!);

        this.device.queue.submit([commandEncoder.finish()]);
    }

    private dispatch(
        encoder: GPUCommandEncoder,
        pipeline: GPUComputePipeline,
        resources: GPUTexture[],
        isDivergence: boolean = false
    ) {
        // Create BindGroup on the fly (Not efficient, but simplest for MVP)
        // Ideally cache these.

        const entries: GPUBindGroupEntry[] = [
            { binding: 0, resource: { buffer: this.uniformBuffer! } },
            // Sampler
            { binding: 4, resource: this.device!.createSampler({ magFilter: 'linear', minFilter: 'linear' }) }
        ];

        // Resource Bindings
        // Note: Shaders expect specific bindings. WE MUST MATCH THEM.
        // Advect: 1: Vel, 2: Source, 3: Result
        // Diverge: 1: Vel, 2: Div
        // Pressure: 1: Press, 2: Div, 3: Result
        // Subtract: 1: Press, 2: Vel, 3: Result

        // This helper assumes resources are passed in order 1, 2, 3...
        // But Sampler is always 4.

        for (let i = 0; i < resources.length; i++) {
            entries.push({
                binding: i + 1,
                resource: resources[i].createView()
            });
        }

        // Fix Sampler binding index if resources < 3
        // Actually, let's just hardcode sampler to 4 in shaders.

        const bindGroup = this.device!.createBindGroup({
            layout: pipeline.getBindGroupLayout(0),
            entries
        });

        const pass = encoder.beginComputePass();
        pass.setPipeline(pipeline);
        pass.setBindGroup(0, bindGroup);
        // Dispatch (8x8 workgroups)
        pass.dispatchWorkgroups(Math.ceil(this.width / 8), Math.ceil(this.height / 8));
        pass.end();
    }

    private swap(pair: { read: GPUTexture, write: GPUTexture }) {
        const temp = pair.read;
        pair.read = pair.write;
        pair.write = temp;
    }

    public addDensity(x: number, y: number, amount: number, color: [number, number, number]) {
        // GPU Write
    }

    public addVelocity(x: number, y: number, vx: number, vy: number) {
        // GPU Write
    }

    public resize(width: number, height: number) {
        this.width = width;
        this.height = height;
    }

    public destroy() {
        this.view.destroy({ children: true });
    }
}
