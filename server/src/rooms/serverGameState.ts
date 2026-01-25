/**
 * Server Game State Adapter
 * Converts between Colyseus server state and game engine state
 */

import { GameRoomState, PlayerState, FoodState } from '../schema/GameState';
import { GameState, Player, Bot, Food, Entity, GameRuntimeState } from '../../../types';
import { createGameEngine } from '../../../services/engine/context';
import { createPlayer } from '../../../services/engine/factories';
import { getLevelConfig } from '../../../services/cjr/levels';
import { WORLD_WIDTH, WORLD_HEIGHT, MAP_RADIUS, FOOD_RADIUS } from '../../../constants';

export const createServerGameState = (serverState: GameRoomState, runtime: GameRuntimeState): GameState => {
  const engine = createGameEngine();
  const levelConfig = getLevelConfig(1); // Default level 1

  // Convert server players to game engine players
  const players: Player[] = [];
  serverState.players.forEach((serverPlayer, sessionId) => {
    const player: Player = {
      id: sessionId,
      name: serverPlayer.name || 'Jelly',
      score: serverPlayer.score || 0,
      kills: serverPlayer.kills || 0,
      maxHealth: serverPlayer.maxHealth || 100,
      currentHealth: serverPlayer.currentHealth || 100,
      tier: 'Larva' as any, // Default tier
      targetPosition: { x: serverPlayer.position.x, y: serverPlayer.position.y },
      spawnTime: Date.now(),
      position: { x: serverPlayer.position.x, y: serverPlayer.position.y },
      velocity: { x: serverPlayer.velocity.x || 0, y: serverPlayer.velocity.y || 0 },
      radius: serverPlayer.radius || 15,
      color: '#ffffff', // Default color
      pigment: {
        r: serverPlayer.pigment.r,
        g: serverPlayer.pigment.g,
        b: serverPlayer.pigment.b
      },
      targetPigment: {
        r: serverPlayer.targetPigment.r,
        g: serverPlayer.targetPigment.g,
        b: serverPlayer.targetPigment.b
      },
      matchPercent: serverPlayer.matchPercent || 0,
      ring: (serverPlayer.ring as any) || 1,
      emotion: 'happy' as any,
      shape: serverPlayer.shape as any,
      tattoos: (serverPlayer.tattoos as any) || [],
      lastHitTime: 0,
      lastEatTime: 0,
      matchStuckTime: 0,
      ring3LowMatchTime: 0,
      emotionTimer: 0,
      acceleration: 1,
      maxSpeed: 1,
      friction: 1,
      isInvulnerable: serverPlayer.isInvulnerable || false,
      skillCooldown: serverPlayer.skillCooldown || 0,
      maxSkillCooldown: 5,
      defense: 1,
      damageMultiplier: 1,
      critChance: 0,
      critMultiplier: 1,
      lifesteal: 0,
      armorPen: 0,
      reflectDamage: 0,
      visionMultiplier: 1,
      sizePenaltyMultiplier: 1,
      skillCooldownMultiplier: 1,
      skillPowerMultiplier: 1,
      skillDashMultiplier: 1,
      killGrowthMultiplier: 1,
      poisonOnHit: false,
      doubleCast: false,
      reviveAvailable: false,
      magneticFieldRadius: 0,
      mutationCooldowns: {
        speedSurge: 0,
        invulnerable: 0,
        rewind: 0,
        lightning: 0,
        chaos: 0,
        kingForm: 0
      },
      rewindHistory: [],
      stationaryTime: 0,
      trail: [],
      isDead: false,
      statusEffects: {
        speedBoost: serverPlayer.statusEffects.speedBoost || 1,
        tempSpeedBoost: 1,
        tempSpeedTimer: 0,
        shielded: serverPlayer.statusEffects.shielded || false,
        burning: false,
        burnTimer: 0,
        slowed: false,
        slowTimer: 0,
        slowMultiplier: 1,
        poisoned: false,
        poisonTimer: 0,
        regen: 0,
        airborne: false,
        stealthed: false,
        stealthCharge: 0,
        invulnerable: serverPlayer.statusEffects.invulnerable || 0,
        rooted: 0,
        speedSurge: 0,
        kingForm: 0,
        damageBoost: serverPlayer.statusEffects.damageBoost || 1,
        defenseBoost: serverPlayer.statusEffects.defenseBoost || 1,
        // CJR specific effects
        commitShield: serverPlayer.statusEffects.commitShield || 0,
        pityBoost: serverPlayer.statusEffects.pityBoost || 0,
        colorBoostTimer: 0,
        colorBoostMultiplier: 1,
        overdriveTimer: 0,
        magnetTimer: 0,
        wrongPigmentReduction: 1,
        overdriveActive: false,
        coreShieldBonus: false,
        pigmentBombActive: false,
        pigmentBombChance: 0,
        perfectMatchThreshold: 0.85,
        perfectMatchBonus: 1.5,
        catalystSenseRange: 1,
        catalystSenseActive: false,
        neutralMassBonus: 1,
        solventPower: 1,
        solventSpeedBoost: 1,
        catalystEchoBonus: 1,
        catalystEchoDuration: 0,
        prismGuardThreshold: 0.8,
        prismGuardReduction: 0.8,
        grimHarvestDropCount: 0
      },
      killStreak: 0,
      streakTimer: 0
    };
    players.push(player);
  });

  // Convert server food to game engine food
  const food: Food[] = [];
  serverState.food.forEach((serverFood, foodId) => {
    const foodItem: Food = {
      id: foodId,
      position: { x: serverFood.x, y: serverFood.y },
      velocity: { x: 0, y: 0 },
      radius: FOOD_RADIUS || 5,
      kind: serverFood.kind as any, // Cast to PickupKind
      pigment: serverFood.pigment,
      value: 1, // Default value
      isDead: false,
      color: '#ffffff', // Default color
      trail: [] // Required trail property
    };
    food.push(foodItem);
  });

  // Create game state
  const fallbackPlayer = players[0] ?? createPlayer('Server');
  const gameState: GameState = {
    player: fallbackPlayer,
    players,
    bots: [], // No bots in multiplayer for now
    creeps: [],
    boss: null,
    food,
    particles: [],
    projectiles: [],
    floatingTexts: [],
    delayedActions: [],
    engine,
    runtime,
    worldSize: { x: serverState.worldWidth, y: serverState.worldHeight },
    zoneRadius: MAP_RADIUS || 500,
    gameTime: serverState.gameTime,
    currentRound: 1,
    camera: { x: 0, y: 0 },
    shakeIntensity: 0,
    kingId: null,
    level: 1,
    levelConfig,
    tattooChoices: null,
    unlockedTattoos: [],
    isPaused: false,
    result: null,
    inputs: { space: false, w: false }
  };

  return gameState;
};
