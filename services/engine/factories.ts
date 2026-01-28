
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
} from '../../types';
import { getCurrentEngine } from './context';
import { randomRange, randomPos, randomPosInCenter, randomPosInRing } from './math';
import { PigmentVec3, ShapeId, PickupKind, TattooId } from '../cjr/cjrTypes';
import { pigmentToHex } from '../cjr/colorMath';
import { pooledEntityFactory } from '../pooling/ObjectPool';
import { createDefaultStatusTimers, createDefaultStatusMultipliers, createDefaultStatusScalars } from '../../types/status';
import { StatusFlag } from './statusFlags';
import { entityManager } from './dod/EntityManager';
import { TransformStore, PhysicsStore, StateStore, EntityLookup } from './dod/ComponentStores';
import { EntityFlags } from './dod/EntityFlags';

// Helper: Random Pigment
export const randomPigment = (): PigmentVec3 => ({
  r: Math.random(),
  g: Math.random(),
  b: Math.random(),
});

import { SynergyComponent } from '../components/SynergyComponent';

export const createPlayer = (name: string, shape: ShapeId = 'circle', spawnTime: number = 0): Player => {
  const position = randomPosInRing(1);
  const pigment = randomPigment();
  const id = Math.random().toString(36).substr(2, 9);

  // EIDOLON-V: Players also need DOD indices if we want uniform handling
  // But players are usually created once or infrequent.
  // For now, focus on Food/Projectiles as per plan.
  // Although, if Grid expects ALL entities to have indices...
  // YES, Player needs an index too if it enters the grid.
  const entId = entityManager.createEntity();

  const player: Player = {
    id,
    position,
    velocity: { x: 0, y: 0 },
    radius: PLAYER_START_RADIUS,
    color: `rgb(${pigment.r * 255},${pigment.g * 255},${pigment.b * 255})`,
    isDead: false,
    trail: [],
    physicsIndex: entId, // Assign DOD Index

    name,
    score: 0,
    kills: 0,
    maxHealth: 100,
    currentHealth: 100,
    tier: SizeTier.Larva,
    targetPosition: position,
    spawnTime,

    pigment,
    targetPigment: randomPigment(),
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

    statusFlags: StatusFlag.INVULNERABLE, // Start with shield
    tattooFlags: 0,
    extendedFlags: 0,
    statusTimers: createDefaultStatusTimers(),
    statusMultipliers: createDefaultStatusMultipliers(),
    statusScalars: createDefaultStatusScalars(),

    killStreak: 0,
    streakTimer: 0,
    components: new Map(),
  };

  // Override Defaults
  player.statusMultipliers.speed = 1;
  player.statusMultipliers.damage = 1;
  player.statusMultipliers.defense = 1;
  player.statusTimers.invulnerable = 3;

  player.components!.set('SynergyComponent', new SynergyComponent(player.id));

  // Initialize DOD State
  if (entId !== -1) {
    TransformStore.set(entId, position.x, position.y, 0);
    PhysicsStore.set(entId, 0, 0, 10, PLAYER_START_RADIUS); // Mass 10
    StateStore.setFlag(entId, EntityFlags.ACTIVE | EntityFlags.PLAYER);
    EntityLookup[entId] = player;
  }

  return player;
};

export const createBot = (id: string, spawnTime: number = 0): Bot => {
  // TODO: Refactor Bot Creation to be less reliant on createPlayer
  // But for now, we wrap it.
  const player = createPlayer(`Bot ${id.substr(0, 4)}`, 'circle', spawnTime);

  const bot: Bot = {
    ...player,
    id,
    aiState: 'wander',
    targetEntityId: null,
    aiReactionTimer: 0,
    personality: 'farmer',
  };

  // Update DOD flags
  if (bot.physicsIndex !== undefined) {
    StateStore.clearFlag(bot.physicsIndex, EntityFlags.PLAYER);
    StateStore.setFlag(bot.physicsIndex, EntityFlags.BOT);
    EntityLookup[bot.physicsIndex] = bot; // Update lookup to point to Bot wrapper
  }

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

  if (boss.physicsIndex !== undefined) {
    // Update Physics Store radius/mass
    const pIdx = boss.physicsIndex * 8;
    PhysicsStore.data[pIdx + 3] = 500; // Mass
    PhysicsStore.data[pIdx + 4] = 80;  // Radius
  }

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

    if (creep.physicsIndex !== undefined) {
      const pIdx = creep.physicsIndex * 8;
      PhysicsStore.data[pIdx + 3] = 5; // Mass
      PhysicsStore.data[pIdx + 4] = 15; // Radius
    }

    creeps.push(creep);
  }
  return creeps;
};

export const createFood = (pos?: Vector2, isEjected: boolean = false): Food => {
  // EIDOLON-V FIX: Use pooled entity instead of heap allocation
  const foodPool = pooledEntityFactory.createPooledFood();
  const food = foodPool.acquire();

  // EIDOLON-V FIX: Allocate DOD Index
  const entId = entityManager.createEntity();
  food.physicsIndex = entId; // Note: Need to add physicsIndex to Food type if missing (it IS in Entity interface)

  const pigment = randomPigment();
  const startPos = pos || randomPosInRing(1);

  // Setup pooled food object
  food.id = Math.random().toString();
  food.position = startPos;
  food.velocity = { x: 0, y: 0 };
  food.radius = FOOD_RADIUS;
  food.color = pigmentToHex(pigment);
  food.isDead = false;
  food.value = 1;
  food.isEjected = isEjected;
  food.kind = 'pigment';
  food.pigment = pigment;
  food.trail.length = 0;

  // Initialize DOD State
  if (entId !== -1) {
    TransformStore.set(entId, startPos.x, startPos.y, 0);
    PhysicsStore.set(entId, 0, 0, 1, FOOD_RADIUS); // Mass 1
    StateStore.setFlag(entId, EntityFlags.ACTIVE | EntityFlags.FOOD);
    EntityLookup[entId] = food;
  }

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

  // EIDOLON-V FIX: Allocate DOD Index
  const entId = entityManager.createEntity();
  projectile.physicsIndex = entId;

  // Calculate velocity toward target
  const dx = target.x - position.x;
  const dy = target.y - position.y;
  const dist = Math.hypot(dx, dy);
  const speed = 300;
  const vx = dist > 0 ? (dx / dist) * speed : 0;
  const vy = dist > 0 ? (dy / dist) * speed : 0;

  // Setup pooled projectile object
  projectile.id = Math.random().toString();
  projectile.position = { ...position };
  projectile.velocity = { x: vx, y: vy };
  projectile.radius = 8;
  projectile.color = type === 'ice' ? '#88ccff' : type === 'web' ? '#888888' : '#ff4444';
  projectile.isDead = false;
  projectile.trail.length = 0;
  projectile.ownerId = ownerId;
  projectile.damage = damage;
  projectile.type = type;
  projectile.duration = duration;

  // Initialize DOD State
  if (entId !== -1) {
    TransformStore.set(entId, position.x, position.y, 0);
    PhysicsStore.set(entId, vx, vy, 0.5, 8); // Mass 0.5
    StateStore.setFlag(entId, EntityFlags.ACTIVE | EntityFlags.PROJECTILE);
    EntityLookup[entId] = projectile;
  }

  return projectile;
};


