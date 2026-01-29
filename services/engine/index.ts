import {
  BOT_COUNT,
  FOOD_COUNT,
  MAP_RADIUS,
  WORLD_HEIGHT,
  WORLD_WIDTH,
  MUTATION_CHOICES,
} from '../../constants';
import {
  Bot,
  Entity,
  Food,
  GameState,
  Player,
} from '../../types';
import { bindEngine, createGameEngine, getCurrentSpatialGrid } from './context';
import {
  createBot,
  createFood,
  createPlayer,
} from './factories';



import { resetWaveTimers } from '../cjr/waveSpawner';

import { resetBossState } from '../cjr/bossCjr';

import { assignRandomPersonality } from '../cjr/botPersonalities';
import { getTattooChoices } from '../cjr/tattoos';
import { TattooId } from '../cjr/cjrTypes';
import { getLevelConfig } from '../cjr/levels';

import { tattooSynergyManager } from '../cjr/tattooSynergies';
import { resetContributionLog } from '../cjr/contribution';

import { optimizedEngine } from './OptimizedEngine';
import { gameStateManager } from './GameStateManager';

// EIDOLON-V FIX: Export unified game state manager
export { gameStateManager, optimizedEngine };

// EIDOLON-V: Legacy exports REMOVED - import directly from OptimizedEngine
// Use: optimizedEngine.updateGameState(state, dt)
// Use: optimizedEngine.updateClientVisuals(state, dt)


export const createInitialState = (level: number = 1): GameState => {
  // ... (Copy nguyên logic createInitialState cũ) ...
  const engine = createGameEngine();
  bindEngine(engine);
  const player = createPlayer("Hero");
  if (!player) throw new Error("Failed to allocate initial player");

  const levelConfig = getLevelConfig(level);
  const runtime = {
    wave: { ring1: levelConfig.waveIntervals.ring1, ring2: levelConfig.waveIntervals.ring2, ring3: levelConfig.waveIntervals.ring3 },
    boss: { bossDefeated: false, rushWindowTimer: 0, rushWindowRing: null, currentBossActive: false, attackCharging: false, attackTarget: null, attackChargeTimer: 0 },
    contribution: { damageLog: new Map<string, number>(), lastHitBy: new Map<string, string>() },
  };
  resetWaveTimers(runtime, levelConfig);
  resetBossState(runtime);
  resetContributionLog(runtime);
  tattooSynergyManager.reset();
  const initialFood = Math.max(50, levelConfig.burstSizes.ring1 * 8);

  // Create food and insert as static entities
  // EIDOLON-V FIX: Filter nulls
  const foodArray: Food[] = Array.from({ length: initialFood }, () => createFood())
    .filter((f): f is Food => f !== null);

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
    // EIDOLON-V FIX: Replace string array with VFX ring buffer
    // EIDOLON-V FIX: Replace string array with VFX ring buffer
    // vfxEvents: [], // Removed - replaced by VFXRingBuffer
    vfxEvents: Array.from({ length: 50 }, () => ({ type: 0, x: 0, y: 0, data: 0, id: '', seq: 0, color: 0 })) as any[], // Explicit cast to satisfy strict mode
    vfxHead: 0,
    vfxTail: 0,
    inputs: { space: false, w: false },
    inputEvents: [],
  };
};
