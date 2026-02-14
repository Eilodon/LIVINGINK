import { WebGPURenderer, Texture, TextureSource } from 'pixi.js';
import advectShader from './shaders/compute/advect.wgsl?raw';
import divergenceShader from './shaders/compute/divergence.wgsl?raw';
import pressureShader from './shaders/compute/pressure.wgsl?raw';
import gradientShader from './shaders/compute/gradient.wgsl?raw';

export class ComputeFluidRenderer {
    private renderer!: WebGPURenderer;
    private width: number;
    private height: number;

    private velocity!: GPUTexture[];
    private density!: GPUTexture[];
    private pressure!: GPUTexture[];
    private divergence!: GPUTexture;

    private uniformBuffer!: GPUBuffer;

    // Bind Groups
    private advectVelBG!: GPUBindGroup[];
    private advectDenBG!: GPUBindGroup[];
    private divBG!: GPUBindGroup[];
    private pressureBG!: GPUBindGroup[];
    private gradientBG!: GPUBindGroup[];

    // Pipelines
    private advectPipeline!: GPUComputePipeline;
    private divergencePipeline!: GPUComputePipeline;
    private pressurePipeline!: GPUComputePipeline;
    private gradientPipeline!: GPUComputePipeline;

    private initialized: boolean = false;
    public outputTexture: Texture;

    constructor(width: number, height: number) {
        this.width = width;
        this.height = height;
        this.outputTexture = Texture.EMPTY;
    }

    public async init(renderer: WebGPURenderer) {
        if (this.initialized) return;
        this.renderer = renderer;
        const device = renderer.gpu.device;

        // 1. Textures
        const texDesc: GPUTextureDescriptor = {
            size: [this.width, this.height],
            format: 'rgba32float',
            usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.STORAGE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.COPY_SRC,
        };

        this.velocity = [device.createTexture({ ...texDesc, label: 'vel0' }), device.createTexture({ ...texDesc, label: 'vel1' })];
        this.density = [device.createTexture({ ...texDesc, label: 'den0' }), device.createTexture({ ...texDesc, label: 'den1' })];
        this.pressure = [device.createTexture({ ...texDesc, label: 'pres0' }), device.createTexture({ ...texDesc, label: 'pres1' })];
        this.divergence = device.createTexture({ ...texDesc, label: 'div' });

        // 2. Uniform Buffer (3 Slots of 256 bytes)
        // 0: Advect (dt, w, h, damp)
        // 256: Pressure (Alpha -1, Beta 0.25)
        // 512: Density (dt, w, h, damp)
        this.uniformBuffer = device.createBuffer({
            size: 256 * 3,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
            label: 'FluidUniforms'
        });

        // 3. Layouts & Pipelines
        await this.createPipelines(device);
        this.createBindGroups(device);

        this.initialized = true;
    }

    private async createPipelines(device: GPUDevice) {
        // Layout with Dynamic Offset for Binding 0
        const layoutEntriesCommon = (textureCount: number): GPUBindGroupLayoutEntry[] => {
            const entries: GPUBindGroupLayoutEntry[] = [
                { binding: 0, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'uniform', hasDynamicOffset: true } }
            ];
            // Read Textures
            for (let i = 1; i < textureCount; i++) {
                entries.push({ binding: i, visibility: GPUShaderStage.COMPUTE, texture: { sampleType: 'unfilterable-float', viewDimension: '2d' } });
            }
            // Write Texture (Last binding)
            entries.push({ binding: textureCount, visibility: GPUShaderStage.COMPUTE, storageTexture: { access: 'write-only', format: 'rgba32float' } });
            return entries;
        };

        // Advect: 0:Uniform, 1:Vel(Read), 2:Source(Read), 3:Out(Write) -> 4 Bindings

        const bindGroupLayout4 = device.createBindGroupLayout({
            entries: [
                { binding: 0, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'uniform', hasDynamicOffset: true } },
                { binding: 1, visibility: GPUShaderStage.COMPUTE, texture: { sampleType: 'unfilterable-float' } },
                { binding: 2, visibility: GPUShaderStage.COMPUTE, texture: { sampleType: 'unfilterable-float' } },
                { binding: 3, visibility: GPUShaderStage.COMPUTE, storageTexture: { access: 'write-only', format: 'rgba32float' } }
            ]
        });

        // Divergence: 0:Uni, 1:Vel, 2:Out -> 3 Bindings
        const bindGroupLayout3 = device.createBindGroupLayout({
            entries: [
                { binding: 0, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'uniform', hasDynamicOffset: true } },
                { binding: 1, visibility: GPUShaderStage.COMPUTE, texture: { sampleType: 'unfilterable-float' } },
                { binding: 2, visibility: GPUShaderStage.COMPUTE, storageTexture: { access: 'write-only', format: 'rgba32float' } }
            ]
        });

        const moduleAdvect = device.createShaderModule({ code: advectShader });
        const moduleDiv = device.createShaderModule({ code: divergenceShader });
        const modulePres = device.createShaderModule({ code: pressureShader });
        const moduleGrad = device.createShaderModule({ code: gradientShader });

        const createPipeline = (module: GPUShaderModule, layout: GPUBindGroupLayout) => {
            return device.createComputePipeline({
                layout: device.createPipelineLayout({ bindGroupLayouts: [layout] }),
                compute: { module, entryPoint: 'main' }
            });
        };

        this.advectPipeline = createPipeline(moduleAdvect, bindGroupLayout4);
        this.divergencePipeline = createPipeline(moduleDiv, bindGroupLayout3);
        this.pressurePipeline = createPipeline(modulePres, bindGroupLayout4);
        this.gradientPipeline = createPipeline(moduleGrad, bindGroupLayout4);
    }

    private createBindGroups(device: GPUDevice) {
        const createBG = (pipeline: GPUComputePipeline, entries: GPUBindGroupEntry[]) => {
            return device.createBindGroup({
                layout: pipeline.getBindGroupLayout(0),
                entries
            });
        };

        const uniformEntry = { binding: 0, resource: { buffer: this.uniformBuffer, offset: 0, size: 16 } }; // Offset 0 is base, dynamic adds to it

        // Advect Vel
        this.advectVelBG = [
            createBG(this.advectPipeline, [uniformEntry, { binding: 1, resource: this.velocity[0].createView() }, { binding: 2, resource: this.velocity[0].createView() }, { binding: 3, resource: this.velocity[1].createView() }]),
            createBG(this.advectPipeline, [uniformEntry, { binding: 1, resource: this.velocity[1].createView() }, { binding: 2, resource: this.velocity[1].createView() }, { binding: 3, resource: this.velocity[0].createView() }])
        ];

        // Advect Density (Source is Density, Vel is constant V[0] usually or V[Previous])
        // We will assume V[0] is the current advecting field for this frame.
        this.advectDenBG = [
            createBG(this.advectPipeline, [uniformEntry, { binding: 1, resource: this.velocity[0].createView() }, { binding: 2, resource: this.density[0].createView() }, { binding: 3, resource: this.density[1].createView() }]),
            createBG(this.advectPipeline, [uniformEntry, { binding: 1, resource: this.velocity[1].createView() }, { binding: 2, resource: this.density[1].createView() }, { binding: 3, resource: this.density[0].createView() }])
        ];

        // Divergence (Read V[1], Write Div) - Assuming V[1] is result of AdvectVel step 0->1
        this.divBG = [
            createBG(this.divergencePipeline, [uniformEntry, { binding: 1, resource: this.velocity[1].createView() }, { binding: 2, resource: this.divergence.createView() }]),
            createBG(this.divergencePipeline, [uniformEntry, { binding: 1, resource: this.velocity[0].createView() }, { binding: 2, resource: this.divergence.createView() }])
        ];

        // Pressure
        this.pressureBG = [
            createBG(this.pressurePipeline, [uniformEntry, { binding: 1, resource: this.pressure[0].createView() }, { binding: 2, resource: this.divergence.createView() }, { binding: 3, resource: this.pressure[1].createView() }]),
            createBG(this.pressurePipeline, [uniformEntry, { binding: 1, resource: this.pressure[1].createView() }, { binding: 2, resource: this.divergence.createView() }, { binding: 3, resource: this.pressure[0].createView() }])
        ];

        // Gradient (Read P[Final], V[Advected], Write V[Final])
        // If 20 iters, P starts 0, ends at 0.
        // V[Advected] is V[1]. Write to V[0].
        this.gradientBG = [
            createBG(this.gradientPipeline, [uniformEntry, { binding: 1, resource: this.pressure[0].createView() }, { binding: 2, resource: this.velocity[1].createView() }, { binding: 3, resource: this.velocity[0].createView() }])
        ];
    }

    public update(dt: number) {
        if (!this.initialized) return;
        const device = this.renderer.gpu.device;
        const width = this.width;
        const height = this.height;

        // Update Uniforms
        const upload = (offset: number, data: Float32Array) => device.queue.writeBuffer(this.uniformBuffer, offset, data as any);

        // 0: Advect Vel (dissipation 0.99)
        upload(0, new Float32Array([dt, width, height, 0.99]) as any);
        // 256: Pressure (Alpha -1, Beta 0.25)
        upload(256, new Float32Array([-1.0, 0.25, width, height]) as any);
        // 512: Advect Den (dissipation 0.98)
        upload(512, new Float32Array([dt, width, height, 0.98]) as any);

        const encoder = device.createCommandEncoder();
        const wgX = Math.ceil(width / 16);
        const wgY = Math.ceil(height / 16);

        const pass = encoder.beginComputePass();

        // 1. Advect Vel: V0 -> V1. Uniform Offset 0.
        pass.setPipeline(this.advectPipeline);
        pass.setBindGroup(0, this.advectVelBG[0], [0]); // Dynamic Offset 0
        pass.dispatchWorkgroups(wgX, wgY);

        // 2. Divergence: V1 -> Div. Uniform Offset 0 (params match mostly).
        pass.setPipeline(this.divergencePipeline);
        pass.setBindGroup(0, this.divBG[0], [0]);
        pass.dispatchWorkgroups(wgX, wgY);

        // 3. Pressure: P0 <-> P1. Uniform Offset 256.
        pass.setPipeline(this.pressurePipeline);
        for (let i = 0; i < 20; i++) {
            pass.setBindGroup(0, this.pressureBG[i % 2], [256]);
            pass.dispatchWorkgroups(wgX, wgY);
        }

        // 4. Gradient: P0, V1 -> V0. Uniform Offset 0.
        pass.setPipeline(this.gradientPipeline);
        pass.setBindGroup(0, this.gradientBG[0], [0]);
        pass.dispatchWorkgroups(wgX, wgY);

        // 5. Advect Density: V0, D0 -> D1. Uniform Offset 512.
        pass.setPipeline(this.advectPipeline);
        pass.setBindGroup(0, this.advectDenBG[0], [512]);
        pass.dispatchWorkgroups(wgX, wgY);

        pass.end();
        device.queue.submit([encoder.finish()]);

        // Swap Density: D1 is new D0.
        this.density.reverse();

        // Output D[0] (which contains result)
        // Need to wrap in Pixi TextureSource if using in Pixi.
        // For now, this class manages the sim.
    }
}
