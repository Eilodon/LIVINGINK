import { WorldState, IWorldConfig } from '../generated/WorldState';

/**
 * Manages two WorldState instances for lockless reading/writing.
 * - Render state: Read-only for main thread rendering.
 * - Simulation state: Read-write for physics loop (Worker).
 */
export class DoubleBufferWorld {
    private currentBufferIndex = 0;
    private worlds: WorldState[];

    constructor(config?: IWorldConfig) {
        // EIDOLON-V: Auto-detect SharedArrayBuffer support
        // If available, we allocate SABs to enable zero-copy threading.
        const useSAB = typeof SharedArrayBuffer !== 'undefined';

        const maxEntities = config?.maxEntities || 10000;

        // Helper to allocate buffer (SAB or AB)
        const alloc = (bytes: number) => useSAB ? new SharedArrayBuffer(bytes) : new ArrayBuffer(bytes);

        // We need 2 sets of buffers for Double Buffering.
        const createBuffers = () => ({
            stateFlags: alloc(maxEntities),
            transform: alloc(maxEntities * 32),
            physics: alloc(maxEntities * 32),
            pigment: alloc(maxEntities * 32),
            stats: alloc(maxEntities * 32),
            input: alloc(maxEntities * 16),
            skill: alloc(maxEntities * 16),
            config: alloc(maxEntities * 32),
            projectile: alloc(maxEntities * 16),
            tattoo: alloc(maxEntities * 20),
        });

        // 1. Render State (Buffer A)
        this.worlds = [
            new WorldState({ ...config, buffers: createBuffers() }),
            new WorldState({ ...config, buffers: createBuffers() })
        ];
    }

    /**
     * Get the world state safe for RENDERING (Read-Only)
     * This is the "Stable" buffer from the previous completed tick.
     */
    public getRenderState(): WorldState {
        return this.worlds[this.currentBufferIndex];
    }

    /**
     * Get the world state for PHYSICS SIMULATION (Read-Write)
     * This is the "Next" buffer being computed.
     */
    public getSimulationState(): WorldState {
        return this.worlds[1 - this.currentBufferIndex];
    }

    /**
     * Swap buffers after Physics Tick is complete.
     * This makes the "Next" buffer the new "Stable" buffer.
     */


    /**
     * EIDOLON-V: Copy entire state from Source to Target
     * Critical for correct simulation on non-deterministic steps.
     * Uses fast TypedArray.set (memcpy).
     */
    public copyState(source: WorldState, target: WorldState): void {
        // Explicit Component Copying
        target.stateFlags.set(source.stateFlags);
        target.transform.set(source.transform);
        target.physics.set(source.physics);
        target.pigment.set(source.pigment);
        target.stats.set(source.stats);
        target.input.set(source.input);
        target.skill.set(source.skill);
        target.config.set(source.config);
        target.projectile.set(source.projectile);
        target.tattoo.set(source.tattoo);

        // Copy scalar properties
        target.activeCount = source.activeCount;
        target.activeEntities.set(source.activeEntities); // Sparse Set Copy
        target.entityToIndex.set(source.entityToIndex);
    }

    /**
     * Sync Render State -> Simulation State.
     * Call this at the START of a simulation tick to ensure
     * we are building upon the latest valid state.
     */
    public sync(): void {
        const render = this.getRenderState();
        const sim = this.getSimulationState();
        this.copyState(render, sim);
    }

    public swap(): void {
        this.currentBufferIndex = 1 - this.currentBufferIndex;
    }
}
