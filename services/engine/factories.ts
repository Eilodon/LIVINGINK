
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
import { randomRange, randomPos, randomPosInCenter, randomPosInRing } from '../math/FastMath';
import { PigmentVec3, ShapeId, PickupKind, TattooId } from '../cjr/cjrTypes';
import { pigmentToHex } from '../cjr/colorMath';
import { pooledEntityFactory } from '../pooling/ObjectPool';
import { createDefaultStatusTimers, createDefaultStatusMultipliers, createDefaultStatusScalars } from '../../types/status';
import { StatusFlag } from './statusFlags';
import { entityManager } from './dod/EntityManager';
import { TransformStore, PhysicsStore, StateStore, StatsStore, SkillStore, TattooStore, EntityLookup, ProjectileStore } from './dod/ComponentStores';
import { EntityFlags } from './dod/EntityFlags';

// Helper: Random Pigment
export const randomPigment = (): PigmentVec3 => ({
  r: Math.random(),
  g: Math.random(),
  b: Math.random(),
});

import { ConfigStore } from './dod/ConfigStore';
import { InputStore } from './dod/ComponentStores';
import { pigmentToInt, intToHex, hexToInt } from '../cjr/colorMath'; // EIDOLON-V: Import color helper

export const createPlayer = (name: string, shape: ShapeId = 'circle', spawnTime: number = 0): Player | null => {
  const position = randomPosInRing(1);
  const pigment = randomPigment();

  // EIDOLON-V: Allocation Phase (EMS Genesis)
  // 1. Allocate DOD Index FIRST
  const entId = entityManager.createEntity();
  if (entId === -1) return null; // Safety Check: Pool Full

  const id = entId.toString(); // Integer Identity as String for backward compatibility

  // 2. Initialize DOD State (Single Source of Truth)
  // 2.1 Transform & Physics
  TransformStore.set(entId, position.x, position.y, 0);
  PhysicsStore.set(entId, 0, 0, 10, PLAYER_START_RADIUS); // Mass 10

  // 2.2 Stats
  StatsStore.set(entId, 100, 100, 0, 0, 1, 1); // Health=100, Def=1, Dmg=1

  // 2.3 State Flags
  StateStore.setFlag(entId, EntityFlags.ACTIVE | EntityFlags.PLAYER);

  // 2.4 Skill & Tattoo
  const ShapeMap: Record<string, number> = { 'circle': 1, 'square': 2, 'triangle': 3, 'hex': 4 };
  const shapeId = ShapeMap[shape] || 1;
  const sIdx = entId * SkillStore.STRIDE;
  SkillStore.data[sIdx] = 0; // cooldown
  SkillStore.data[sIdx + 1] = 8; // maxCooldown (Default)
  SkillStore.data[sIdx + 3] = shapeId;
  TattooStore.flags[entId] = 0;

  // 2.5 Config (Hot Logic Data)
  // [magneticRadius, damageMult, speedMult, pickupRange, visionRange]
  ConfigStore.set(entId,
    0,   // magneticRadius
    1,   // damageMultiplier
    1,   // speedMultiplier
    50,  // pickupRange (Default)
    1000 // visionRange (Default)
  );

  // 2.6 Input (DOD)
  // Initialize target to current position (so they don't sprint to 0,0)
  InputStore.setTarget(entId, position.x, position.y);

  // 3. Create View Proxy (JS Object)
  // This object is now a "View Shell" for React/Rendering compatibility.
  // Logic should refer to `entId` (physicsIndex), not this object where possible.
  const player: Player = {
    id,
    physicsIndex: entId, // THE LINK

    // View Cache (Synced from DOD before render)
    position: { ...position },
    velocity: { x: 0, y: 0 },
    radius: PLAYER_START_RADIUS,

    // Static / Cosmetic Data
    color: pigmentToInt(pigment), // EIDOLON-V: Optimized Integer Color
    isDead: false,

    name,
    shape,
    pigment,
    targetPigment: randomPigment(),
    tier: SizeTier.Larva,
    ring: 1,
    emotion: 'happy',
    tattoos: [],

    // Logic specific (Keep in Object for hybrid logic transition)
    score: 0,
    kills: 0,
    maxHealth: 100,
    currentHealth: 100,
    targetPosition: position, // AI Target / Mouse Target
    spawnTime,
    lastHitTime: 999,
    lastEatTime: 0,
    matchStuckTime: 0,
    ring3LowMatchTime: 0,
    emotionTimer: 0,
    matchPercent: 0,

    // Movement Params (Synced to ConfigStore eventually)
    acceleration: ACCELERATION_BASE,
    maxSpeed: MAX_SPEED_BASE,
    friction: FRICTION_BASE,

    // Combat Stats (Synced to ConfigStore eventually)
    isInvulnerable: true,
    skillCooldown: 0,
    maxSkillCooldown: 8,
    defense: 1,
    damageMultiplier: 1, // VIEW ONLY (Logic uses ConfigStore)
    reflectDamage: 0,

    // Complex Stats (Still in Object for now)
    critChance: 0,
    critMultiplier: 1.5,
    lifesteal: 0,
    armorPen: 0,
    visionMultiplier: 1,
    sizePenaltyMultiplier: 1,
    skillCooldownMultiplier: 1,
    skillPowerMultiplier: 1,
    skillDashMultiplier: 1,
    killGrowthMultiplier: 1,
    poisonOnHit: false,
    doubleCast: false,
    reviveAvailable: false,
    magneticFieldRadius: 0, // VIEW ONLY (Logic uses ConfigStore)

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

    statusFlags: StatusFlag.INVULNERABLE,
    tattooFlags: 0,
    extendedFlags: 0,
    statusTimers: createDefaultStatusTimers(),
    statusMultipliers: createDefaultStatusMultipliers(),
    statusScalars: createDefaultStatusScalars(),

    killStreak: 0,
    streakTimer: 0,
    // components removed
  };

  // Init Defaults
  player.statusTimers.invulnerable = 3;
  // player.components!.set('SynergyComponent', new SynergyComponent(player.id)); // LEGACY REMOVED

  // Register in Global Lookup
  EntityLookup[entId] = player;

  return player;
};

export const createBot = (id: string, spawnTime: number = 0): Bot | null => {
  // TODO: Refactor Bot Creation to be less reliant on createPlayer
  // But for now, we wrap it.
  const player = createPlayer(`Bot ${id.substr(0, 4)}`, 'circle', spawnTime);

  if (!player) return null; // Handle allocation failure

  const bot: Bot = {
    ...player,
    id, // Override with Bot ID
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

export const createBoss = (spawnTime: number = 0): Bot | null => {
  const boss = createBot('BOSS_1', spawnTime);
  if (!boss) return null;

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
    // Update Stats Store
    StatsStore.set(boss.physicsIndex, 2000, 2000, boss.score, boss.matchPercent, 2, 1.5); // Boss Def=2, Dmg=1.5
  }

  return boss;
};

export const createBotCreeps = (count: number): Bot[] => {
  const creeps: Bot[] = [];
  for (let i = 0; i < count; i++) {
    const creep = createBot(`creep_${i}`);
    if (!creep) continue; // Skip if failed to create

    creep.name = 'Jelly Bit';
    creep.radius = 15;
    creep.isCreep = true;
    creep.pigment = { r: 0.5, g: 0.5, b: 0.5 }; // Neutral gray

    if (creep.physicsIndex !== undefined) {
      const pIdx = creep.physicsIndex * 8;
      PhysicsStore.data[pIdx + 3] = 5; // Mass
      PhysicsStore.data[pIdx + 4] = 15; // Radius
      // Update Stats (HP/Score might be different? For now inherit from createBot defaults which is Player default)
      // Creeps usually weak?
      // Assuming defaults are okay for now unless we want weaker creeps.
    }

    creeps.push(creep);
  }
  return creeps;
};

export const createFood = (pos?: Vector2, isEjected: boolean = false): Food | null => {
  // EIDOLON-V FIX: Use pooled entity instead of heap allocation
  const foodPool = pooledEntityFactory.createPooledFood();
  const food = foodPool.acquire();

  // EIDOLON-V FIX: Allocate DOD Index
  const entId = entityManager.createEntity();
  if (entId === -1) {
    foodPool.release(food);
    return null;
  }

  food.physicsIndex = entId; // Note: Need to add physicsIndex to Food type if missing (it IS in Entity interface)

  const pigment = randomPigment();
  const startPos = pos || randomPosInRing(1);

  // Setup pooled food object
  food.id = entId.toString(); // Integer ID
  food.position = startPos;
  food.velocity = { x: 0, y: 0 };
  food.radius = FOOD_RADIUS;
  food.color = pigmentToInt(pigment); // INTEGER
  food.isDead = false;
  food.value = 1;
  food.isEjected = isEjected;
  food.kind = 'pigment';
  food.pigment = pigment;
  // food.trail.length = 0; // REMOVED

  // Initialize DOD State
  TransformStore.set(entId, startPos.x, startPos.y, 0);
  PhysicsStore.set(entId, 0, 0, 1, FOOD_RADIUS); // Mass 1
  // Determine Type Flag
  let typeFlag = EntityFlags.FOOD;
  if (food.kind === 'catalyst') typeFlag |= EntityFlags.FOOD_CATALYST;
  else if (food.kind === 'pigment') typeFlag |= EntityFlags.FOOD_PIGMENT;
  else if (food.kind === 'shield') typeFlag |= EntityFlags.FOOD_SHIELD;
  else if (food.kind === 'solvent') typeFlag |= EntityFlags.FOOD_SOLVENT;
  else if (food.kind === 'neutral') typeFlag |= EntityFlags.FOOD_NEUTRAL;

  StateStore.setFlag(entId, EntityFlags.ACTIVE | typeFlag);
  StatsStore.set(entId, 1, 1, 1, 0, 0, 0); // HP 1, MaxHP 1, Score 1...

  // EIDOLON-V: ConfigStore Init for Food
  // [magneticRadius, damageMult, speedMult, pickupRange, visionRange]
  ConfigStore.set(entId,
    0,   // magneticRadius
    0,   // damageMultiplier
    0,   // speedMultiplier
    0,   // pickupRange
    0    // visionRange
  );

  EntityLookup[entId] = food;

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
  duration: number = 2.0,
  ownerIndex?: number // EIDOLON-V: Optimization
): Projectile | null => {
  // EIDOLON-V FIX: Use pooled entity instead of heap allocation
  const projectilePool = pooledEntityFactory.createPooledProjectile();
  const projectile = projectilePool.acquire();

  // EIDOLON-V FIX: Allocate DOD Index
  const entId = entityManager.createEntity();
  if (entId === -1) {
    projectilePool.release(projectile);
    return null;
  }
  projectile.physicsIndex = entId;

  // Calculate velocity toward target
  const dx = target.x - position.x;
  const dy = target.y - position.y;
  const dist = Math.hypot(dx, dy);
  const speed = 300;
  const vx = dist > 0 ? (dx / dist) * speed : 0;
  const vy = dist > 0 ? (dy / dist) * speed : 0;

  projectile.id = entId.toString(); // or ownerId + timestamp?
  // ... setup object ...
  projectile.ownerId = ownerId;
  projectile.position = { ...position };
  projectile.velocity = { x: vx, y: vy };

  // DOD Stores
  TransformStore.set(entId, position.x, position.y, 0);
  PhysicsStore.set(entId, vx, vy, 0.5, 8, 0.5, 1.0);
  StateStore.setFlag(entId, EntityFlags.ACTIVE | EntityFlags.PROJECTILE);
  StatsStore.set(entId, 1, 1, 0, 0, 0, 1);

  // EIDOLON-V: ConfigStore Init for Projectile
  ConfigStore.set(entId,
    0,   // magneticRadius
    1,   // damageMultiplier
    1,   // speedMultiplier
    0,   // pickupRange
    0    // visionRange
  );

  EntityLookup[entId] = projectile;

  // EIDOLON-V: ProjectileStore
  const oIdx = ownerIndex !== undefined ? ownerIndex : -1;
  // If -1, we might fail self-collision checks if logic relies on int comparison only.
  // But usually projectiles are created by Valid Entities.

  ProjectileStore.set(entId, oIdx, damage, duration, 0);

  return projectile;
};





