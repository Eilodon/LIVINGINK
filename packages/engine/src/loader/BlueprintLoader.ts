/**
 * @eidolon/engine - BlueprintLoader
 *
 * Loads level configurations from JSON and spawns entities into the game.
 * Connects Level Editor output to Engine runtime.
 *
 * ## Usage
 * ```ts
 * const loader = new BlueprintLoader();
 * const level = await loader.loadLevel(1); // Load level_1.json
 * loader.spawnLevelEntities(level, gameState);
 * ```
 */

import type { LevelConfig } from '../config/levels';
import { validateLevelBlueprint, type LevelBlueprint } from './LevelValidator';
import { EntitySpawner, type SpawnContext } from './EntitySpawner';
import { WorldState } from '../generated/WorldState';

/**
 * Entity template for dynamic spawning
 */
export interface EntityTemplate {
    id: string;
    components: Record<string, Record<string, number>>;
    tags?: string[];
}

/**
 * Loader configuration
 */
export interface LoaderConfig {
    /** Base URL for level JSON files */
    baseUrl: string;
    /** Enable hot reload */
    hotReload?: boolean;
    /** WebSocket URL for live updates */
    wsUrl?: string;
}

/**
 * BlueprintLoader - Bridge between Level Editor and Engine
 *
 * Responsibilities:
 * 1. Load level JSON from various sources (file, HTTP, WebSocket)
 * 2. Validate JSON against schema
 * 3. Spawn entities based on config
 * 4. Support hot reload for development
 */
export class BlueprintLoader {
    private config: LoaderConfig;
    private spawner: EntitySpawner;
    private ws: WebSocket | null = null;
    private cachedLevels = new Map<number, LevelConfig>();

    constructor(config: LoaderConfig) {
        this.config = {
            hotReload: false,
            ...config,
        };
        this.spawner = new EntitySpawner();
    }

    /**
     * Load a level configuration by ID
     *
     * @param levelId Level identifier (e.g., 1 for level_1.json)
     * @returns Validated LevelConfig
     */
    async loadLevel(levelId: number): Promise<LevelConfig> {
        // Check cache first
        const cached = this.cachedLevels.get(levelId);
        if (cached) {
            return cached;
        }

        const url = `${this.config.baseUrl}/level_${levelId}.json`;

        try {
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`Failed to load level ${levelId}: ${response.status}`);
            }

            const json = await response.json();
            const blueprint = validateLevelBlueprint(json);

            if (!blueprint.valid || !blueprint.data) {
                throw new Error(
                    `Level ${levelId} validation failed: ${blueprint.errors?.join(', ')}`
                );
            }

            const levelConfig = this.transformBlueprintToConfig(blueprint.data);
            this.cachedLevels.set(levelId, levelConfig);

            console.info(`[BlueprintLoader] Level ${levelId} loaded successfully`);
            return levelConfig;
        } catch (error) {
            console.error(`[BlueprintLoader] Error loading level ${levelId}:`, error);
            throw error;
        }
    }

    /**
     * Load level from inline JSON (for bundled levels)
     *
     * @param json Level JSON object
     * @returns Validated LevelConfig
     */
    loadLevelFromJson(json: object): LevelConfig {
        const blueprint = validateLevelBlueprint(json);

        if (!blueprint.valid || !blueprint.data) {
            throw new Error(
                `Level validation failed: ${blueprint.errors?.join(', ')}`
            );
        }

        return this.transformBlueprintToConfig(blueprint.data);
    }

    /**
     * Spawn all entities for a level
     *
     * @param level Level configuration
     * @param context Spawn context (game time, callbacks, etc.)
     * @returns Array of spawned entity IDs
     */
    spawnLevelEntities(world: WorldState, level: LevelConfig, context: SpawnContext): number[] {
        const spawnedIds: number[] = [];

        // Spawn bots based on botCount
        for (let i = 0; i < level.botCount; i++) {
            const botId = this.spawner.spawnBot(world, {
                ...context,
                name: `Bot ${i + 1}`,
                spawnDelay: i * 0.5, // Stagger spawns
            });
            spawnedIds.push(botId);
        }

        // Configure boss entities if enabled
        if (level.boss.boss1Enabled) {
            const bossId = this.spawner.spawnBoss(world, {
                ...context,
                health: level.boss.boss1Health,
                spawnTime: level.boss.boss1Time,
            });
            spawnedIds.push(bossId);
        }

        if (level.boss.boss2Enabled) {
            const bossId = this.spawner.spawnBoss(world, {
                ...context,
                health: level.boss.boss2Health,
                spawnTime: level.boss.boss2Time,
            });
            spawnedIds.push(bossId);
        }

        console.info(`[BlueprintLoader] Spawned ${spawnedIds.length} entities for level ${level.id}`);
        return spawnedIds;
    }

    /**
     * Spawn entity from template
     *
     * @param template Entity template
     * @param x X position
     * @param y Y position
     * @returns Entity ID
     */
    spawnFromTemplate(world: WorldState, template: EntityTemplate, x: number, y: number): number {
        return this.spawner.spawnFromTemplate(world, template, x, y);
    }

    /**
     * Start hot reload watcher (WebSocket connection to Level Editor)
     */
    startHotReload(): void {
        if (!this.config.hotReload || !this.config.wsUrl) {
            return;
        }

        try {
            this.ws = new WebSocket(this.config.wsUrl);

            this.ws.onmessage = (event) => {
                const message = JSON.parse(event.data);
                this.handleWsMessage(message);
            };

            this.ws.onopen = () => {
                console.info('[BlueprintLoader] Hot reload WebSocket connected');
            };

            this.ws.onclose = () => {
                console.info('[BlueprintLoader] Hot reload WebSocket disconnected');
                // Attempt reconnect after 5s
                setTimeout(() => this.startHotReload(), 5000);
            };
        } catch (error) {
            console.error('[BlueprintLoader] Failed to start hot reload:', error);
        }
    }

    /**
     * Stop hot reload watcher
     */
    stopHotReload(): void {
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
    }

    /**
     * Clear level cache
     */
    clearCache(): void {
        this.cachedLevels.clear();
    }

    /**
     * Handle WebSocket messages for hot reload
     */
    private handleWsMessage(message: { type: string; levelId?: number; level?: object }): void {
        switch (message.type) {
            case 'LEVEL_UPDATED':
                if (message.levelId && message.level) {
                    // Update cache
                    const config = this.loadLevelFromJson(message.level);
                    this.cachedLevels.set(message.levelId, config);
                    console.info(`[BlueprintLoader] Hot reload: Level ${message.levelId} updated`);
                }
                break;

            case 'INITIAL_STATE':
                // Preload all levels
                console.info('[BlueprintLoader] Hot reload: Received initial state');
                break;
        }
    }

    /**
     * Transform blueprint data to LevelConfig
     */
    private transformBlueprintToConfig(blueprint: LevelBlueprint): LevelConfig {
        return {
            id: blueprint.id,
            name: blueprint.name,
            thresholds: blueprint.thresholds,
            winHoldSeconds: blueprint.winHoldSeconds,
            timeLimit: blueprint.timeLimit,
            waveIntervals: blueprint.waveIntervals,
            burstSizes: blueprint.burstSizes,
            spawnWeights: blueprint.spawnWeights,
            botCount: blueprint.botCount,
            boss: blueprint.boss,
            pity: blueprint.pity,
            ring3Debuff: blueprint.ring3Debuff,
            rushWindowDuration: blueprint.rushWindowDuration,
            winCondition: blueprint.winCondition,
        };
    }
}

/**
 * Singleton instance for global access
 */
let globalLoader: BlueprintLoader | null = null;

export function getBlueprintLoader(config?: LoaderConfig): BlueprintLoader {
    if (!globalLoader && config) {
        globalLoader = new BlueprintLoader(config);
    }
    if (!globalLoader) {
        throw new Error('[BlueprintLoader] Not initialized. Call with config first.');
    }
    return globalLoader;
}

export function resetBlueprintLoader(): void {
    globalLoader?.stopHotReload();
    globalLoader = null;
}
