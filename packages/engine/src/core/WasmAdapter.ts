import init, { Simulation } from 'core-rust';
import { FluidSystem } from '../client/FluidSystem.js';
import { PerformanceManager, PerformanceTier } from '../systems/PerformanceManager.js';

export class WasmAdapter {
    private simulation: Simulation | null = null;
    private fluidSystem: FluidSystem | null = null;
    private initialized = false;
    private animationFrameId: number | null = null;
    private isRunning = false;

    async initialize(wasmUrl?: string) {
        if (this.initialized) return;

        // Initialize WASM module
        // If wasmUrl provided, use it. Otherwise rely on default bundle logic.
        await init(wasmUrl);

        // Initialize with default 8x8 grid and random seed for now
        // TODO: Pass these from config
        const width = 8;
        const height = 8;
        const seed = BigInt(Math.floor(Math.random() * 1000000));
        this.simulation = new Simulation(width, height, seed);
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
            // Adaptive Quality: Skip fluid update on LOW tier if pressured
            const pm = PerformanceManager.getInstance();
            if (pm.currentTier <= PerformanceTier.MID) {
                this.fluidSystem.update(dt / 1000.0); // Fluid expects seconds
            } else {
                // Low Tier: Update less frequently? Or skip?
                // For now, let's just update. Frame skip handled in loop.
                this.fluidSystem.update(dt / 1000.0);
            }
        }
    }

    // Legacy/Standalone loop if needed
    startLoop() {
        if (!this.simulation) throw new Error("WasmAdapter not initialized");
        if (this.isRunning) return;

        this.isRunning = true;
        let lastTime = performance.now();

        const loop = (time: number) => {
            if (!this.isRunning) return;

            // Performance Manager Hook
            const pm = PerformanceManager.getInstance();
            // Start of frame: Update metrics
            if (!pm.update(time)) {
                // If update returns false, we skip this frame (throttling)
                // But we must request next frame to keep loop alive.
                this.animationFrameId = requestAnimationFrame(loop);
                return;
            }

            // Adaptive DT: If we are lagging, clamp DT to prevent spiral of death
            let dt = time - lastTime;
            if (dt > 100) dt = 100; // Cap at 100ms

            lastTime = time;

            this.update(dt);
            this.animationFrameId = requestAnimationFrame(loop);
        };
        this.animationFrameId = requestAnimationFrame(loop);
    }

    stopLoop() {
        this.isRunning = false;
        if (this.animationFrameId !== null) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }
    }

    cleanup() {
        this.stopLoop();
        this.simulation = null;
        this.fluidSystem = null;
        this.initialized = false;
    }
}
