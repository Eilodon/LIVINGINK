import {
  BOT_COUNT,
  FOOD_COUNT,
  MAP_RADIUS,
  WORLD_HEIGHT,
  WORLD_WIDTH,
  MUTATION_CHOICES,
} from '../../constants';
import { Bot, Entity, Food, GameState, Player } from '../../types';
import { bindEngine, createGameEngine, getCurrentSpatialGrid } from './context';
import { createBot, createFood, createPlayer } from './factories';

import { resetWaveTimersLegacy as resetWaveTimers, resetBossState } from '@cjr/engine/modules/cjr';

import { assignRandomPersonality } from '../cjr/botPersonalities';
import { getTattooChoices } from '../cjr/tattoos';
import { TattooId } from '../cjr/cjrTypes';
import { getLevelConfig } from '../cjr/levels';

import { tattooSynergyManager } from '../cjr/tattooSynergies';
import { resetContributionLog } from '../cjr/contribution';

import { cjrClientRunner } from './runner/CJRClientRunner';
import { gameStateManager } from './GameStateManager';
import { createVFXEventPool } from './VFXRingBuffer';

// EIDOLON-V FIX: Import DOD reset functions from @cjr/engine where safe
import { resetAllStores } from '@cjr/engine';
import { entityManager } from './dod/EntityManager';

// EIDOLON-V FIX: Export unified game state manager and new runner
export { gameStateManager, cjrClientRunner };

// EIDOLON-V: Legacy exports REMOVED - use cjrClientRunner instead
// Use: cjrClientRunner.setGameState(state); cjrClientRunner.update(dt)
// Use: cjrClientRunner.setGameState(state); cjrClientRunner.updateVisualsOnly(dt)

export const createInitialState = (level: number = 1): GameState => {
  // EIDOLON-V FIX: Reset DOD stores and entity manager FIRST
  // This prevents stale data from previous game sessions causing bugs
  resetAllStores();
  entityManager.reset();

  const engine = createGameEngine();
  bindEngine(engine);
  const player = createPlayer('Hero');
  if (!player) throw new Error('Failed to allocate initial player');

  const levelConfig = getLevelConfig(level);
  const runtime = {
    wave: {
      ring1: levelConfig.waveIntervals.ring1,
      ring2: levelConfig.waveIntervals.ring2,
      ring3: levelConfig.waveIntervals.ring3,
    },
    boss: {
      bossDefeated: false,
      rushWindowTimer: 0,
      rushWindowRing: null,
      currentBossActive: false,
      attackCharging: false,
      attackTarget: null,
      attackChargeTimer: 0,
    },
    contribution: { damageLog: new Map<string, number>(), lastHitBy: new Map<string, string>() },
  };
  resetWaveTimers(runtime, levelConfig);
  resetBossState(runtime);
  resetContributionLog(runtime);
  tattooSynergyManager.reset();
  const initialFood = Math.max(50, levelConfig.burstSizes.ring1 * 8);

  // Create food and insert as static entities
  // EIDOLON-V FIX: Filter nulls
  const foodArray: Food[] = Array.from({ length: initialFood }, () => createFood()).filter(
    (f): f is Food => f !== null
  );

  const grid = getCurrentSpatialGrid();
  foodArray.forEach(food => grid.insertStatic(food));

  // EIDOLON-V FIX: Filter null bots
  const bots: Bot[] = Array.from({ length: Math.max(levelConfig.botCount, 10) }, (_, i) => {
    const b = createBot(`${i}`);
    if (b) assignRandomPersonality(b);
    return b;
  }).filter((b): b is Bot => b !== null);

  return {
    player,
    players: [player],
    bots,
    creeps: [],
    boss: null,
    food: foodArray,
    particles: [], // Không dùng nữa, để trống
    projectiles: [],
    floatingTexts: [],
    delayedActions: [],
    engine,
    runtime,
    worldSize: { x: WORLD_WIDTH, y: WORLD_HEIGHT },
    zoneRadius: MAP_RADIUS,
    gameTime: 0,
    currentRound: 1,
    camera: { x: player.position.x, y: player.position.y }, // EIDOLON-V FIX: Start camera at player position
    shakeIntensity: 0,
    kingId: null,
    level,
    levelConfig,
    tattooChoices: null,
    unlockedTattoos: [],
    isPaused: false,
    result: null,
    // EIDOLON-V: Pre-allocated event objects for zero-GC VFX consumption.
    // (vfxBuffer is the producer; this array is the UI-consumable staging pool.)
    vfxEvents: createVFXEventPool(500),
    vfxHead: 0,
    vfxTail: 0,
  };
};
