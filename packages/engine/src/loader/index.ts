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
} from './BlueprintLoader';

export {
    validateLevelBlueprint,
    type LevelBlueprint,
    type ValidationResult,
} from './LevelValidator';

export {
    EntitySpawner,
    type SpawnContext,
    type BotSpawnOptions,
    type BossSpawnOptions,
} from './EntitySpawner';
