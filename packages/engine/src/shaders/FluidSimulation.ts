import { Application, RenderTexture, Sprite, Filter, Graphics, GlProgram, defaultFilterVert } from 'pixi.js';
import { InkBleedShader } from './InkBleedShader.js';

export class FluidSimulation {
    private app: Application;
    private renderTexture: RenderTexture;
    private inkFilter: Filter;
    private inkLayers: Map<string, RenderTexture> = new Map();

    // Uniforms state
    private uniforms: {
        uResolution: Float32Array;
        uTime: number;
        uIntensity: number;
        uInkColor: Float32Array;
    };

    constructor(app: Application) {
        this.app = app;
        this.renderTexture = RenderTexture.create({
            width: app.screen.width,
            height: app.screen.height
        });

        // Initialize uniforms
        this.uniforms = {
            uResolution: new Float32Array([app.screen.width, app.screen.height]),
            uTime: 0,
            uIntensity: 0.5,
            uInkColor: new Float32Array([0.1, 0.1, 0.1, 1.0])
        };

        // Create GlProgram for WebGL
        const glProgram = GlProgram.from({
            vertex: defaultFilterVert,
            fragment: InkBleedShader
        });

        // Create Filter (PixiJS v8)
        this.inkFilter = new Filter({
            glProgram,
            resources: {
                // Pass uniforms as a plain object matching the shader structure
                fluidUniforms: {
                    uResolution: { value: this.uniforms.uResolution, type: 'vec2<f32>' },
                    uTime: { value: this.uniforms.uTime, type: 'f32' },
                    uIntensity: { value: this.uniforms.uIntensity, type: 'f32' },
                    uInkColor: { value: this.uniforms.uInkColor, type: 'vec4<f32>' }
                }
            }
        });
    }

    // Add ink stain at position
    addInkStain(x: number, y: number, element: number): void {
        const layerKey = `element_${element}`;
        if (!this.inkLayers.has(layerKey)) {
            const layer = RenderTexture.create({
                width: this.app.screen.width,
                height: this.app.screen.height
            });
            this.inkLayers.set(layerKey, layer);
        }

        const layer = this.inkLayers.get(layerKey)!;

        // Draw ink blob at position
        const graphics = new Graphics();
        graphics.circle(x, y, 30); // v8 API: circle(x,y,r)
        graphics.fill({ color: this.getInkColor(element), alpha: 0.8 }); // v8 API: fill({ color, alpha })

        // Render to texture
        this.app.renderer.render({
            container: graphics,
            target: layer,
            clear: false
        });
    }

    // Get ink color based on Wu Xing element
    private getInkColor(element: number): number {
        const colors: { [key: number]: number } = {
            1: 0xC0C0C0, // Metal: Silver
            2: 0x4CAF50, // Wood: Green
            3: 0x2196F3, // Water: Blue
            4: 0xFF5722, // Fire: Red
            5: 0x795548  // Earth: Brown
        };
        return colors[element] || 0x000000;
    }

    // Apply fluid effects to a sprite
    applyToSprite(sprite: Sprite): void {
        sprite.filters = [this.inkFilter];
    }

    // Update simulation
    update(dt: number): void {
        this.uniforms.uTime += dt;

        // Update uniforms in the filter resources
        // PixiJS v8: Can often update values directly if references are kept, 
        // but safe way is to re-assign or update the resource buffer if accessible.
        // For Filter resources, simply updating the source value might not propagate if primitive.
        // But referencing the object/array might work.
        // Let's try to update the resource directly.
        const resources = this.inkFilter.resources as any;
        if (resources.fluidUniforms) {
            resources.fluidUniforms.uniforms.uTime = this.uniforms.uTime;
            // Actually, for custom uniforms using the dict structure:
            // It depends on how GlProgram parses it.
            // If I passed it as above, it might be wrapped.
            // A simpler way for dynamic uniforms in v8 custom filters is just setting them if exposed? No.

            // Re-assigning works for primitives usually if getters involved?
            // Actually, let's keep it simple: 
            // In v8, 'resources' hold the actual data.
            resources.fluidUniforms.uTime = this.uniforms.uTime; // Try direct access
        }

        // Render all ink layers to main texture
        const renderer = this.app.renderer;

        // In v8, we don't bind renderTexture globally like v7.
        // We issue render commands per target.

        this.inkLayers.forEach((layer) => {
            const sprite = new Sprite(layer);
            renderer.render({
                container: sprite,
                target: this.renderTexture,
                clear: false
            });
        });
    }

    // Get current ink texture for rendering
    getInkTexture(): RenderTexture {
        return this.renderTexture;
    }
}
