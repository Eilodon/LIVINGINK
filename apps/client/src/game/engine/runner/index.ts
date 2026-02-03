/**
 * @cjr/client - Engine Runner Module
 *
 * Exports the CJRClientRunner for game simulation.
 */

export { CJRClientRunner, type ICJRSimulationConfig } from './CJRClientRunner';
export { AISystem, getAISystem, resetAISystem } from '../dod/systems/AISystem';
export type { AISystemConfig } from '../dod/systems/AISystem';
