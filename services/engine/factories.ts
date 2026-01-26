
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
import { pooledEntityFactory } from '../pooling/ObjectPool'; // EIDOLON-V FIX: Import pooling


// Helper: Random Pigment
export const randomPigment = (): PigmentVec3 => ({
  r: Math.random(),
  g: Math.random(),
  b: Math.random(),
});

import { SynergyComponent } from '../ecs/components/SynergyComponent';

export const createPlayer = (name: string, shape: ShapeId = 'circle', spawnTime: number = 0): Player => {
  const position = randomPosInRing(1);
  const pigment = randomPigment();
  const id = Math.random().toString(36).substr(2, 9);

  const player: Player = {
    id,
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
    components: new Map(),
  };

  player.components!.set('SynergyComponent', new SynergyComponent(player.id));

  return player;
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
  // EIDOLON-V FIX: Use pooled entity instead of heap allocation
  const foodPool = pooledEntityFactory.createPooledFood();
  const food = foodPool.acquire();
  
  const pigment = randomPigment();
  
  // Setup pooled food object
  food.id = Math.random().toString();
  food.position = pos || randomPosInRing(1);
  food.velocity = { x: 0, y: 0 };
  food.radius = FOOD_RADIUS;
  food.color = pigmentToHex(pigment);
  food.isDead = false;
  food.value = 1;
  food.isEjected = isEjected;
  food.kind = 'pigment';
  food.pigment = pigment;
  food.trail.length = 0; // Clear trail array
  
  return food;
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
  // EIDOLON-V FIX: Use pooled entity instead of heap allocation
  const projectilePool = pooledEntityFactory.createPooledProjectile();
  const projectile = projectilePool.acquire();
  
  // Calculate velocity toward target
  const dx = target.x - position.x;
  const dy = target.y - position.y;
  const dist = Math.hypot(dx, dy);
  const speed = 300;

  // Setup pooled projectile object
  projectile.id = Math.random().toString();
  projectile.position = { ...position };
  projectile.velocity = dist > 0 ? { x: (dx / dist) * speed, y: (dy / dist) * speed } : { x: 0, y: 0 };
  projectile.radius = 8;
  projectile.color = type === 'ice' ? '#88ccff' : type === 'web' ? '#888888' : '#ff4444';
  projectile.isDead = false;
  projectile.trail.length = 0; // Clear trail array
  projectile.ownerId = ownerId;
  projectile.damage = damage;
  projectile.type = type;
  projectile.duration = duration;
  
  return projectile;
};


