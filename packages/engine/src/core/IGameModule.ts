import { WorldState } from '../generated/WorldState';
import { EntityManager } from './EntityManager';

/**
 * Interface that all Game Modules must implement.
 * This allows the Engine to hot-swap game logic.
 */
/**
 * Context provided to the module on mount.
 * Allows the module to interact with the host environment (Visuals, Audio).
 */
export interface IGameContext {
    spawnVisual(entityId: number, color: number, shape: number): void;
    setVisualState(entityId: number, state: number): void;
    onPreviewInteraction?: (data: any) => void;
    entityManager: EntityManager;
}

export interface IGameModule {
    /** unique id for the game (e.g. 'jelly-sumo') */
    readonly id: string;

    /** Human readable name */
    readonly name: string;

    /**
     * Called when the module is loaded.
     * Setup initial state, spawn entities, load assets.
     */
    onMount(world: WorldState, context: IGameContext): Promise<void>;

    /**
     * Called every tick (Fixed Update).
     * Core game logic goes here (Win/Lose, Rules).
     */
    onUpdate(world: WorldState, dt: number): void;

    /**
     * Called when the module is unloaded.
     * Cleanup specialized resources.
     */
    onUnmount(world: WorldState): void;

    /**
     * Handle player input (Action mapping).
     * @param world The current world state
     * @param input Abstract input snapshot (to be defined)
     */
    onPlayerInput(world: WorldState, input: any): void;
}
