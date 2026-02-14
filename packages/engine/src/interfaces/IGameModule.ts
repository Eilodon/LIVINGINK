/**
 * @eidolon/engine - IGameModule Interface
 *
 * The contract that all game modules must implement.
 * This is the core abstraction that enables platformization.
 *
 * A GameModule is a "cartridge" that can be loaded into the engine.
 * Examples: CJR (Color Jelly Rush), MOBA, RPG, etc.
 */

import type { IComponentSchema } from './IComponent.js';
import type { ISystem, SystemFactory } from './ISystem.js';

/**
 * Network schema for module-specific packet encoding.
 */
export interface INetworkSchema {
    /** Packet types defined by this module */
    packetTypes: Record<string, number>;

    /** Entity state fields to sync */
    syncFields: {
        /** Component ID */
        componentId: string;
        /** Field names to sync */
        fields: string[];
        /** Sync frequency: 'fast' (every tick) or 'change' (on dirty) */
        frequency: 'fast' | 'change';
    }[];
}

/**
 * Event type definition for module events.
 */
export interface IEventDefinition {
    /** Event type ID (numeric for binary encoding) */
    id: number;
    /** Event name for debugging */
    name: string;
    /** Event payload schema */
    payload?: {
        name: string;
        type: 'f32' | 'u16' | 'u32' | 'string';
    }[];
}

/**
 * Input action mapping.
 */
export interface IInputMapping {
    /** Action name (e.g., "FIRE", "MOVE", "SKILL") */
    action: string;
    /** Keyboard keys that trigger this action */
    keys?: string[];
    /** Mouse buttons (0=left, 1=middle, 2=right) */
    mouseButtons?: number[];
    /** Touch gesture type */
    touch?: 'tap' | 'hold' | 'swipe';
    /** Gamepad buttons */
    gamepadButtons?: number[];
}

/**
 * Asset manifest entry.
 */
export interface IAssetEntry {
    /** Asset key for runtime lookup */
    key: string;
    /** Asset path relative to assets folder */
    path: string;
    /** Asset type */
    type: 'texture' | 'spritesheet' | 'audio' | 'json' | 'font';
    /** Preload priority (higher = load first) */
    priority?: number;
}

/**
 * Entity template for spawning.
 */
export interface IEntityTemplate {
    /** Template ID */
    id: string;
    /** Human-readable name */
    name: string;
    /** Component data */
    components: Record<string, Record<string, number>>;
    /** Entity flags to set */
    flags?: number;
    /** Tags for filtering */
    tags?: string[];
}

/**
 * Inspector schema for dev tools (State Viewer).
 */
export interface IInspectorSchema {
    /** Entity categories for tree view */
    categories: {
        id: string;
        name: string;
        /** Entity flag mask to filter */
        flagMask: number;
        /** Icon for UI */
        icon?: string;
    }[];

    /** Custom panels for module-specific data */
    panels?: {
        id: string;
        name: string;
        /** Component to display */
        componentId: string;
        /** Custom renderer (optional) */
        renderer?: string;
    }[];
}

/**
 * Module configuration options.
 */
export interface IModuleConfig {
    /** Max entities for this module */
    maxEntities?: number;
    /** Fixed timestep in seconds */
    fixedTimestep?: number;
    /** Enable debug mode */
    debug?: boolean;
    /** Module-specific config */
    [key: string]: unknown;
}

/**
 * Game state interface for module lifecycle hooks.
 */
export interface IModuleGameState {
    /** Current game time in seconds */
    gameTime: number;
    /** Is game paused? */
    isPaused: boolean;
    /** Game result (null = in progress) */
    result: 'win' | 'lose' | null;
    /** Level/stage configuration */
    levelConfig?: unknown;
}

/**
 * Main Game Module Interface.
 *
 * Every game built on Eidolon Engine must implement this interface.
 * The engine uses this contract to:
 * - Register game-specific components
 * - Load game systems
 * - Handle input mapping
 * - Manage assets
 * - Encode network packets
 */
export interface IGameModule {
    // ==================== IDENTIFICATION ====================

    /** Unique module identifier (e.g., "cjr_v1", "moba_v1") */
    readonly id: string;

    /** Human-readable module name */
    readonly name: string;

    /** Module version (semver) */
    readonly version: string;

    /** Module description */
    readonly description?: string;

    // ==================== SCHEMA REGISTRATION ====================

    /**
     * Get component schemas defined by this module.
     * Called once during module initialization.
     *
     * @returns Array of component schemas to register
     *
     * @example
     * ```ts
     * getComponentSchemas() {
     *   return [
     *     { id: 'Pigment', fields: [...], stride: 12 },
     *     { id: 'Ring', fields: [...], stride: 4 },
     *   ];
     * }
     * ```
     */
    getComponentSchemas(): IComponentSchema[];

    /**
     * Get system factories for this module.
     * Systems are instantiated by the engine during initialization.
     *
     * @returns Array of system factories
     */
    getSystemFactories(): SystemFactory[];

    // ==================== EVENTS & NETWORKING ====================

    /**
     * Get event types defined by this module.
     * Used for engine→client event bridge.
     *
     * @returns Map of event name → event definition
     */
    getEventDefinitions(): IEventDefinition[];

    /**
     * Get network schema for multiplayer sync.
     *
     * @returns Network sync configuration
     */
    getNetworkSchema(): INetworkSchema;

    // ==================== INPUT & ASSETS ====================

    /**
     * Get input action mappings.
     *
     * @returns Array of input mappings
     */
    getInputMappings(): IInputMapping[];

    /**
     * Get asset manifest for preloading.
     *
     * @returns Array of asset entries
     */
    getAssetManifest(): IAssetEntry[];

    // ==================== ENTITIES ====================

    /**
     * Get entity templates for spawning.
     *
     * @returns Array of entity templates
     */
    getEntityTemplates(): IEntityTemplate[];

    // ==================== TOOLS INTEGRATION ====================

    /**
     * Get inspector schema for dev tools.
     *
     * @returns Inspector configuration (optional)
     */
    getInspectorSchema?(): IInspectorSchema;

    // ==================== LIFECYCLE HOOKS ====================

    /**
     * Called when module is loaded into engine.
     * Use for one-time initialization.
     *
     * @param config Module configuration
     */
    onLoad?(config: IModuleConfig): void;

    /**
     * Called when module is unloaded.
     * Use for cleanup.
     */
    onUnload?(): void;

    /**
     * Called when a game session starts.
     *
     * @param state Initial game state
     */
    onGameStart?(state: IModuleGameState): void;

    /**
     * Called when a game session ends.
     *
     * @param state Final game state
     */
    onGameEnd?(state: IModuleGameState): void;

    /**
     * Called when an entity is spawned.
     *
     * @param entityId Entity's DOD index
     * @param templateId Template used to spawn
     */
    onEntitySpawn?(entityId: number, templateId: string): void;

    /**
     * Called when an entity is destroyed.
     *
     * @param entityId Entity's DOD index
     */
    onEntityDestroy?(entityId: number): void;

    /**
     * Called every frame for module-specific updates.
     * Use sparingly - prefer systems for regular updates.
     *
     * @param dt Delta time in seconds
     * @param state Current game state
     */
    onUpdate?(dt: number, state: IModuleGameState): void;
}

/**
 * Module registration result.
 */
export interface IModuleRegistration {
    /** Module instance */
    module: IGameModule;
    /** Registered component IDs */
    componentIds: string[];
    /** Registered system IDs */
    systemIds: string[];
    /** Registration timestamp */
    registeredAt: number;
}

/**
 * Module loader interface for dynamic loading.
 */
export interface IModuleLoader {
    /**
     * Load a module by ID.
     *
     * @param moduleId Module identifier
     * @returns Promise resolving to module instance
     */
    load(moduleId: string): Promise<IGameModule>;

    /**
     * Check if module is available.
     *
     * @param moduleId Module identifier
     * @returns True if module can be loaded
     */
    isAvailable(moduleId: string): boolean;

    /**
     * Get list of available modules.
     *
     * @returns Array of module IDs
     */
    getAvailableModules(): string[];
}
