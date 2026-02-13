import { Container, Sprite, Texture } from 'pixi.js';
import advectionShader from './shaders/advection';
import divergenceShader from './shaders/divergence';
import pressureShader from './shaders/pressure';
import gradientSubtractShader from './shaders/gradientSubtract';

export class FluidRenderer {
    public view: Container;
    private sprite: Sprite;

    private device: GPUDevice | null = null;

    // Pipelines
    private advectionPipeline: GPUComputePipeline | null = null;
    private divergencePipeline: GPUComputePipeline | null = null;
    private pressurePipeline: GPUComputePipeline | null = null;
    private gradientSubtractPipeline: GPUComputePipeline | null = null;

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
