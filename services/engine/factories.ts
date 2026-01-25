
import {
  FOOD_RADIUS,
  PLAYER_START_RADIUS,
  RELIC_RADIUS,
  RELIC_VALUE,
  WORLD_HEIGHT,
  WORLD_WIDTH,
  ACCELERATION_BASE,
  MAX_SPEED_BASE,
  FRICTION_BASE,
} from '../../constants';
import {
  Entity,
  Food,
  Particle,
  Player,
  Bot,
  Projectile,
  SizeTier,
  Vector2,
} from '../../types'; // Note: OrbitingObject missing in types? I'll check types.ts again, might need to remove
import { getCurrentEngine } from './context';
import { randomRange, randomPos, randomPosInCenter, randomPosInRing } from './math';
import { PigmentVec3, ShapeId, PickupKind, TattooId } from '../cjr/cjrTypes';
import { pigmentToHex } from '../cjr/colorMath';
import { assignRandomPersonality } from '../cjr/botPersonalities';

// Helper: Random Pigment
export const randomPigment = (): PigmentVec3 => ({
  r: Math.random(),
  g: Math.random(),
  b: Math.random(),
});

export const createPlayer = (name: string, shape: ShapeId = 'circle', spawnTime: number = 0): Player => {
  const position = randomPosInRing(1);
  const pigment = randomPigment();

  return {
    id: Math.random().toString(36).substr(2, 9),
    position,
    velocity: { x: 0, y: 0 },
    radius: PLAYER_START_RADIUS,
    color: `rgb(${pigment.r * 255},${pigment.g * 255},${pigment.b * 255})`,
    isDead: false,
    trail: [],

    name,
    score: 0,
    kills: 0,
    maxHealth: 100,
    currentHealth: 100,
    tier: SizeTier.Larva,
    targetPosition: position,
    spawnTime,

    pigment,
    targetPigment: randomPigment(), // TODO: Set by Level Manager?
    matchPercent: 0,
    ring: 1,
    emotion: 'happy',
    shape,
    tattoos: [],
    lastHitTime: 999,
    lastEatTime: 0,
    matchStuckTime: 0,
    ring3LowMatchTime: 0,
    emotionTimer: 0,

    acceleration: ACCELERATION_BASE,
    maxSpeed: MAX_SPEED_BASE,
    friction: FRICTION_BASE,

    isInvulnerable: true,
    skillCooldown: 0,
    maxSkillCooldown: 8,

    defense: 1,
    damageMultiplier: 1,

    critChance: 0,
    critMultiplier: 1.5,
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
      kingForm: 0,
    },
    rewindHistory: [],
    stationaryTime: 0,

    statusEffects: {
      speedBoost: 1,
      tempSpeedBoost: 1,
      tempSpeedTimer: 0,
      shielded: false,
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
      invulnerable: 3, // Start with shield
      rooted: 0,
      speedSurge: 0,
      kingForm: 0,
      damageBoost: 1,
      defenseBoost: 1,
      colorBoostTimer: 0,
      colorBoostMultiplier: 1,
      overdriveTimer: 0,
      magnetTimer: 0,
      catalystEchoBonus: 1,
      catalystEchoDuration: 0,
      prismGuardThreshold: 0.8,
      prismGuardReduction: 0.8,
      grimHarvestDropCount: 0,
    },
    killStreak: 0,
    streakTimer: 0,
  };
};

export const createBot = (id: string, spawnTime: number = 0): Bot => {
  const player = createPlayer(`Bot ${id.substr(0, 4)}`, 'circle', spawnTime);

  const bot: Bot = {
    ...player,
    id,
    aiState: 'wander',
    targetEntityId: null,
    aiReactionTimer: 0,
    personality: 'farmer',
  };

  assignRandomPersonality(bot);

  return bot;
};

export const createBoss = (spawnTime: number = 0): Bot => {
  const boss = createBot('BOSS_1', spawnTime);
  boss.name = 'Ring Guardian';
  boss.radius = 80;
  boss.maxHealth = 2000;
  boss.currentHealth = 2000;
  boss.isBoss = true;
  boss.personality = 'bully';
  return boss;
};

export const createBotCreeps = (count: number): Bot[] => {
  const creeps: Bot[] = [];
  for (let i = 0; i < count; i++) {
    const creep = createBot(`creep_${i}`);
    creep.name = 'Jelly Bit';
    creep.radius = 15;
    creep.isCreep = true;
    creep.pigment = { r: 0.5, g: 0.5, b: 0.5 }; // Neutral gray
    creeps.push(creep);
  }
  return creeps;
};

export const createFood = (pos?: Vector2, isEjected: boolean = false): Food => {
  const pigment = randomPigment();
  return {
    id: Math.random().toString(),
    position: pos || randomPosInRing(1),
    velocity: { x: 0, y: 0 },
    radius: FOOD_RADIUS,
    color: pigmentToHex(pigment),
    isDead: false,
    trail: [],
    value: 1,
    isEjected,
    kind: 'pigment', // Default
    pigment,
  };
};

// Particle helper for VFX
export const createParticle = (x: number, y: number, color: string, speed: number = 8): Particle => {
  const engine = getCurrentEngine();
  // Ensure we use the pool from engine if available
  return engine.particlePool.get(x, y, color, speed);
};

export const createProjectile = (
  ownerId: string,
  position: Vector2,
  target: Vector2,
  damage: number = 10,
  type: 'web' | 'ice' | 'sting' = 'ice',
  duration: number = 2.0
): Projectile => {
  // Calculate velocity toward target
  const dx = target.x - position.x;
  const dy = target.y - position.y;
  const dist = Math.hypot(dx, dy);
  const speed = 300;

  return {
    id: Math.random().toString(),
    position: { ...position },
    velocity: dist > 0 ? { x: (dx / dist) * speed, y: (dy / dist) * speed } : { x: 0, y: 0 },
    radius: 8,
    color: type === 'ice' ? '#88ccff' : type === 'web' ? '#888888' : '#ff4444',
    isDead: false,
    trail: [],
    ownerId,
    damage,
    type,
    duration,
  };
};


