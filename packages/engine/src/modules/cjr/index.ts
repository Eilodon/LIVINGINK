/**
 * @eidolon/engine - CJR Module
 * Color Jelly Rush specific game logic
 *
 * This module implements IGameModule interface for pluggable game logic.
 */

// CJR Module Class (IGameModule implementation)
export { CJRModule, cjrModule, createCJRModule } from './CJRModule.js';

// Module Registration Helper
import { getComponentRegistry } from '../../core/ComponentRegistry.js';
import { cjrModule } from './CJRModule.js';

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
export * from './types.js';

// CJR-specific Flags
export * from './flags.js';

// CJR State Interfaces (extends base engine interfaces)
export * from './state.js';

// CJR Constants
export * from './constants.js';

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
} from './colorMath.js';

// Ring System
export {
    getRingAtPosition,
    updateRingLogic,
    updateRingLogicLegacy,
    checkRingTransition,
    checkRingTransitionDOD,  // EIDOLON-V Finding 6: DOD-native ring check
    type IRingEntity,
} from './ringSystem.js';

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
} from './tattoos.js';

// Tattoo Entity Adapter (Zero-Allocation DOD Bridge)
export {
    TattooEntityAdapter,
    tattooEntityAdapter,
    TattooEntityPool,
    tattooEntityPool,
} from './TattooEntityAdapter.js';

// Win Condition
export {
    updateWinConditionLogic,
    updateWinCondition,
    type IWinEntity,
    type IWinState,
    type ILevelConfig,
} from './winCondition.js';

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
} from './bossCjr.js';

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
} from './waveSpawner.js';
