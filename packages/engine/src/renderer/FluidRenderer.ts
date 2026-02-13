import { Container, Sprite, Texture, RenderTexture, ColorMatrixFilter, Renderer } from 'pixi.js';
import { InkBleedFilter } from './filters/InkBleedFilter';

export interface FluidEvent {
    x: number;
    y: number;
    element: number;
    intensity: number;
}

export class FluidRenderer {
    public view: Container;
    private sprite: Sprite; // Main display sprite for the effect
    private impactTexture: RenderTexture;
    private impactSprite: Sprite; // Helper to draw splats
    private impactContainer: Container; // Container to hold splats for rendering
    private inkBleedFilter: InkBleedFilter;
    private fadeFilter: ColorMatrixFilter;

    // Renderer reference captured from update
    private _renderer: Renderer | null = null;

    private width: number;
    private height: number;
    private time: number = 0;

    constructor(width: number, height: number) {
        this.width = width;
        this.height = height;
        this.view = new Container();

        // 1. Setup Impact Logic strategy
        // We use a RenderTexture to accumulate "ink"
        this.impactTexture = RenderTexture.create({ width, height });

        // Helper container to draw splats into the texture
        this.impactContainer = new Container();

        // Helper sprite for a single splat (we'll reuse or create on fly)
        this.impactSprite = new Sprite(Texture.WHITE);
        this.impactSprite.anchor.set(0.5);

        // 2. Setup Main View
        this.sprite = new Sprite(Texture.WHITE); // Just a placeholder to fill screen
        this.sprite.width = width;
        this.sprite.height = height;
        this.sprite.alpha = 0; // Transparent base, filter adds color
        this.sprite.texture = Texture.EMPTY;

        this.view.addChild(this.sprite);

        // 3. Setup Filter
        this.inkBleedFilter = new InkBleedFilter({
            impactTexture: this.impactTexture,
            noiseScale: 8.0,
            distortionStrength: 0.15,
            inkColor: 0x111111, // Dark Ink
            paperColor: 0xffffff // Unused if we only overlay
        });

        this.sprite.filters = [this.inkBleedFilter];

        // Fade filter for dissipation (applied to impact texture)
        this.fadeFilter = new ColorMatrixFilter();
        // Matrix to decay alpha: retain 92% per frame
        this.fadeFilter.matrix = [
            1, 0, 0, 0, 0,
            0, 1, 0, 0, 0,
            0, 0, 1, 0, 0,
            0, 0, 0, 0.92, 0
        ];
    }

    public injectGameplayInfluence(events: FluidEvent[]) {
        if (events.length === 0) return;
        this.queuedEvents.push(...events);
    }

    private queuedEvents: FluidEvent[] = [];

    public update(dt: number, renderer?: Renderer | any) {
        this.time += dt * 0.01;
        this.inkBleedFilter.time = this.time;

        if (renderer) this._renderer = renderer;
        if (!this._renderer) return;

        // 1. Draw new ink
        if (this.queuedEvents.length > 0) {
            this.impactContainer.removeChildren();

            for (const evt of this.queuedEvents) {
                const s = new Sprite(Texture.WHITE);
                s.position.set(evt.x, evt.y);
                s.width = evt.intensity * 20;
                s.height = evt.intensity * 20;
                s.alpha = 1.0;
                s.rotation = Math.random() * Math.PI * 2;
                s.tint = 0xFFFFFF;
                this.impactContainer.addChild(s);
            }

            this._renderer.render({
                container: this.impactContainer,
                target: this.impactTexture,
                clear: false
            });

            this.queuedEvents = [];
        }

        // 2. Dissipation (Fade out)
        const fade = new Sprite(Texture.WHITE);
        fade.width = this.width;
        fade.height = this.height;
        fade.tint = 0x000000;
        fade.alpha = 0.05; // Fade speed

        this._renderer.render({
            container: fade,
            target: this.impactTexture,
            clear: false
        });
    }

    public addDensity(x: number, y: number, amount: number, color: [number, number, number]) {
        this.queuedEvents.push({
            x,
            y,
            element: 0,
            intensity: amount
        });
    }

    public addVelocity(x: number, y: number, vx: number, vy: number) {
        // No-op
    }

    public async readDensityMap(): Promise<Float32Array | null> {
        if (!this._renderer || !this.impactTexture) return null;

        try {
            // Extract pixels from Impact Texture
            // Cast to Uint8ClampedArray because v8 extract.pixels returns GetPixelsOutput which is array-like
            const pixels = this._renderer.extract.pixels(this.impactTexture) as unknown as Uint8ClampedArray;

            // Convert to Float32Array (0-1 range)
            const floatData = new Float32Array(pixels.length);
            for (let i = 0; i < pixels.length; i++) {
                floatData[i] = pixels[i] / 255.0;
            }
            return floatData;
        } catch (e) {
            console.warn("Fluid Readback Failed", e);
            return null;
        }
    }

    public getWidth(): number { return this.width; }
    public getHeight(): number { return this.height; }

    public resize(width: number, height: number) {
        this.width = width;
        this.height = height;
        this.sprite.width = width;
        this.sprite.height = height;
        this.impactTexture.resize(width, height);
    }

    public destroy() {
        this.view.destroy({ children: true });
        this.impactTexture.destroy(true);
    }
}
