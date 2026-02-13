import init, { Simulation } from 'core-rust';
import { FluidSystem } from '../client/FluidSystem';

export class WasmAdapter {
    private simulation: Simulation | null = null;
    private fluidSystem: FluidSystem | null = null;
    private initialized = false;

    async initialize(wasmUrl?: string) {
        if (this.initialized) return;

        // Initialize WASM module
        // If wasmUrl provided, use it. Otherwise rely on default bundle logic.
        await init(wasmUrl);

        this.simulation = new Simulation();
        this.initialized = true;
        console.log("Benchmarks: Rust Core initialized successfully.");
    }

    public setFluidSystem(system: FluidSystem) {
        this.fluidSystem = system;
    }

    /**
     * Advances the simulation by dt milliseconds.
     * Can be called from requestAnimationFrame or PixiJS ticker.
     */
    public update(dt: number) {
        if (!this.simulation) return;

        // Fixed Timestep Update via Rust
        this.simulation.update(dt);

        // Fluid Update
        if (this.fluidSystem) {
            this.fluidSystem.update(dt / 1000.0); // Fluid expects seconds
        }
    }

    // Legacy/Standalone loop if needed
    startLoop() {
        if (!this.simulation) throw new Error("WasmAdapter not initialized");

        let lastTime = performance.now();
        const loop = (time: number) => {
            const dt = time - lastTime;
            lastTime = time;
            this.update(dt);
            requestAnimationFrame(loop);
        };
        requestAnimationFrame(loop);
    }
}
