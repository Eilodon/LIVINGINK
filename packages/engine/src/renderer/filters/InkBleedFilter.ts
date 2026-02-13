import { Filter, GlProgram, GpuProgram, Texture, Color } from 'pixi.js';
import inkBleedShader from '../shaders/inkBleed';

export interface InkBleedFilterOptions {
    impactTexture: Texture;
    noiseScale?: number;
    distortionStrength?: number;
    inkColor?: number | string | Float32Array;
    paperColor?: number | string | Float32Array;
}

export class InkBleedFilter extends Filter {
    private _time: number = 0;

    constructor(options: InkBleedFilterOptions) {
        const vertexShader = `
            struct GlobalUniforms {
                uProjectionMatrix: mat3x3<f32>,
                uWorldTransformMatrix: mat3x3<f32>,
                uWorldColorAlpha: vec4<f32>,
                uResolution: vec2<f32>,
            }

            struct LocalUniforms {
                uTransformMatrix: mat3x3<f32>,
                uColor: vec4<f32>,
                uRound: f32,
            }

            @group(0) @binding(0) var<uniform> globalUniforms : GlobalUniforms;
            @group(1) @binding(0) var<uniform> localUniforms : LocalUniforms;

            struct VSOutput {
                @builtin(position) position: vec4<f32>,
                @location(0) uv: vec2<f32>,
            }

            @vertex
            fn main(@location(0) aPosition: vec2<f32>, @location(1) aUV: vec2<f32>) -> VSOutput {
                var v: VSOutput;
                let worldPos = globalUniforms.uWorldTransformMatrix * vec3<f32>(aPosition, 1.0);
                v.position = vec4<f32>(worldPos.xy, 0.0, 1.0);
                v.uv = aUV;
                return v;
            }
        `;

        const gpuProgram = GpuProgram.from({
            vertex: {
                source: vertexShader,
                entryPoint: 'main'
            },
            fragment: {
                source: inkBleedShader,
                entryPoint: 'main',
            },
        });

        super({
            gpuProgram,
            resources: {
                uImpactTexture: options.impactTexture,
                uniforms: {
                    uTime: { value: 0, type: 'f32' },
                    uNoiseScale: { value: options.noiseScale ?? 10.0, type: 'f32' },
                    uDistortionStrength: { value: options.distortionStrength ?? 0.2, type: 'f32' },
                    uInkColor: { value: new Color(options.inkColor ?? 0x1a1a1a).toRgbArray(), type: 'vec3<f32>' },
                    uPaperColor: { value: new Color(options.paperColor ?? 0xf2e6d9).toRgbArray(), type: 'vec3<f32>' }
                }
            }
        });
    }

    public get time(): number { return this._time; }
    public set time(value: number) {
        this._time = value;
        this.resources.uniforms.uniforms.uTime = value;
    }

    public updateImpactTexture(texture: Texture) {
        this.resources.uImpactTexture = texture;
    }
}
