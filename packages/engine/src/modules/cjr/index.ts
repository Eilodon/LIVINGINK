/**
 * @eidolon/engine - CJR Module
 * Color Jelly Rush specific game logic
 *
 * This module implements IGameModule interface for pluggable game logic.
 */

// CJR Module Class (IGameModule implementation)
export { CJRModule, cjrModule, createCJRModule } from './CJRModule';

// Module Registration Helper
import { getComponentRegistry } from '../../core/ComponentRegistry';
import { cjrModule } from './CJRModule';

/**
 * Register CJR-specific components into the ComponentRegistry.
 * Call this AFTER registerCoreComponents() and BEFORE registry.freeze()
 */
export function registerCJRComponents(): void {
    const registry = getComponentRegistry();
    const schemas = cjrModule.getComponentSchemas();

    console.info('[CJRModule] Registering CJR components...');
    for (const schema of schemas) {
        if (registry.has(schema.id)) {
            console.info(`[CJRModule] ${schema.id} already registered, skipping`);
            continue;
        }
        registry.register(schema);
    }
    console.info(`[CJRModule] Registered ${schemas.length} CJR components`);
}

// Types
export * from './types';

// CJR-specific Flags
export * from './flags';

// CJR State Interfaces (extends base engine interfaces)
export * from './state';

// CJR Constants
export * from './constants';

// Color Math
export {
    getColorHint,
    calcMatchPercent,
    calcMatchPercentFast,
    mixPigment,
    pigmentToInt,
    pigmentToHex,
    hexToInt,
    intToHex,
    intToRgbString,
    getSnapAlpha,
} from './colorMath';

// Ring System
export {
    getRingAtPosition,
    updateRingLogic,
    updateRingLogicLegacy,
    checkRingTransition,
    type IRingEntity,
} from './ringSystem';

// Tattoos System
export {
    getTattooById,
    applyTattoo,
    triggerTattooOnSkill,
    triggerTattooOnHit,
    triggerTattooOnConsume,
    triggerTattooOnUpdate,
    getTattooChoices,
    getAllTattoos,
    TattooFlag,
    StatusFlag,
    type TattooDefinition,
    type TattooChoice,
    type ITattooEntity,
    type ITattooFood,
} from './tattoos';

// Win Condition
export {
    updateWinConditionLogic,
    updateWinCondition,
    type IWinEntity,
    type IWinState,
    type ILevelConfig,
} from './winCondition';

// Boss Logic
export {
    updateBossLogic,
    resetBossState,
    isRushWindowActive,
    getRushThreshold,
    onBossDeath,
    type IBossEntity,
    type IPlayerEntity,
    type IBossState,
} from './bossCjr';

// Wave Spawner
export {
    updateWaveSpawner,
    resetWaveTimers,
    updateWaveSpawnerLegacy,
    resetWaveTimersLegacy,
    spawnFoodAt,
    type IFood,
    type IWaveState,
    type ISpawnResult,
} from './waveSpawner';
