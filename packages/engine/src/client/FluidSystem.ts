import { Container } from 'pixi.js';
import { FluidRenderer } from '../renderer/FluidRenderer.js';

export class FluidSystem {
    private renderer: FluidRenderer;
    private container: Container;

    constructor(container: Container, width: number, height: number) {
        this.container = container;
        this.renderer = new FluidRenderer(width, height);
        this.container.addChild(this.renderer.view);
    }

    public async init() {
        // Renderer init is handled in constructor but is async. 
    }

    public update(dt: number) {
        this.renderer.update(dt);
    }

    public addDensity(x: number, y: number, amount: number, color: [number, number, number]) {
        this.renderer.addDensity(x, y, amount, color);
    }

    public addVelocity(x: number, y: number, vx: number, vy: number) {
        this.renderer.addVelocity(x, y, vx, vy);
    }

    public resize(width: number, height: number) {
        this.renderer.resize(width, height);
    }

    public destroy() {
        this.renderer.destroy();
    }
}
