/**
 * @eidolon/engine - Loader Module
 *
 * Blueprint loading and entity spawning functionality.
 * Connects Level Editor JSON output to Engine runtime.
 */

export {
    BlueprintLoader,
    type EntityTemplate,
    type LoaderConfig,
    getBlueprintLoader,
    resetBlueprintLoader,
} from './BlueprintLoader.js';

export {
    validateLevelBlueprint,
    type LevelBlueprint,
    type ValidationResult,
} from './LevelValidator.js';

export {
    EntitySpawner,
    type SpawnContext,
    type BotSpawnOptions,
    type BossSpawnOptions,
} from './EntitySpawner.js';
