import {
  BOSS_ATTACK_INTERVAL,
  BOSS_MAX_HEALTH,
  BOSS_RADIUS,
  CREEPS_PER_ZONE,
  FIRE_ORB_DURATION,
  FOOD_RADIUS,
  ICE_HEART_DURATION,
  MAX_SPEED_BASE,
  PLAYER_START_RADIUS,
  RELIC_RADIUS,
  RELIC_VALUE,
  WORLD_HEIGHT,
  WORLD_WIDTH,
} from '../../constants';
import { FACTION_CONFIG } from '../../constants';
import {
  Bot,
  Faction,
  Food,
  Hazard,
  Landmark,
  Particle,
  Player,
  PowerUp,
  Projectile,
  SizeTier,
  Vector2,
} from '../../types';
import { getCurrentEngine } from './context';
import { getZoneCenter, normalize, randomPos, randomPosInCenter, randomPosInZone, randomRelicPos } from './math';

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));

const hslToHex = (h: number, s: number, l: number) => {
  const hue = ((h % 360) + 360) % 360;
  const saturation = clamp01(s / 100);
  const lightness = clamp01(l / 100);

  const chroma = (1 - Math.abs(2 * lightness - 1)) * saturation;
  const segment = hue / 60;
  const second = chroma * (1 - Math.abs((segment % 2) - 1));

  let r1 = 0;
  let g1 = 0;
  let b1 = 0;

  if (segment >= 0 && segment < 1) {
    r1 = chroma;
    g1 = second;
  } else if (segment >= 1 && segment < 2) {
    r1 = second;
    g1 = chroma;
  } else if (segment >= 2 && segment < 3) {
    g1 = chroma;
    b1 = second;
  } else if (segment >= 3 && segment < 4) {
    g1 = second;
    b1 = chroma;
  } else if (segment >= 4 && segment < 5) {
    r1 = second;
    b1 = chroma;
  } else {
    r1 = chroma;
    b1 = second;
  }

  const match = lightness - chroma / 2;
  const r = Math.round((r1 + match) * 255);
  const g = Math.round((g1 + match) * 255);
  const b = Math.round((b1 + match) * 255);

  const toHex = (value: number) => value.toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
};

// --- Factory Methods ---
export const createPlayer = (name: string, faction: Faction, spawnTime: number = 0): Player => {
  const stats = FACTION_CONFIG[faction].stats;
  return {
    id: 'player',
    name,
    faction,
    position: randomPos(),
    velocity: { x: 0, y: 0 },
    radius: PLAYER_START_RADIUS,
    color: FACTION_CONFIG[faction].color,
    isDead: false,
    score: 0,
    kills: 0,
    maxHealth: 100 * stats.health,
    currentHealth: 100 * stats.health,
    tier: SizeTier.Larva,
    targetPosition: { x: WORLD_WIDTH / 2, y: WORLD_HEIGHT / 2 },
    spawnTime,
    trail: [],
    isInvulnerable: true,
    skillCooldown: 0,
    maxSkillCooldown: 6,
    acceleration: 0,
    maxSpeed: MAX_SPEED_BASE * stats.speed,
    friction: 0.1,

    defense: stats.defense,
    damageMultiplier: stats.damage,
    mutations: [],
    critChance: 0,
    critMultiplier: 2,
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
    teleportCooldown: 0,
    landmarkCharge: 0,
    landmarkId: null,
    landmarkCooldown: 0,

    statusEffects: {
      speedBoost: 1,
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
      invulnerable: 0,
      rooted: 0,
      speedSurge: 0,
      kingForm: 0,
      damageBoost: 1,
      defenseBoost: 1,
      damageBoostTimer: 0,
      defenseBoostTimer: 0,
      shieldTimer: 0,
      speedBoostTimer: 0,
      critCharges: 0,
      visionBoost: 1,
      visionBoostTimer: 0,
      damageFlash: 0,
    },
  };
};

export const createBot = (id: string, spawnTime: number = 0): Bot => {
  const factions = Object.values(Faction);
  const faction = factions[Math.floor(Math.random() * factions.length)];
  const base = createPlayer(`Bot ${id}`, faction, spawnTime);
  return {
    ...base,
    id: `bot-${id}`,
    position: randomPos(),
    aiState: 'wander',
    targetEntityId: null,
    isInvulnerable: true,
    aiReactionTimer: 0,
    respawnTimer: 0,
  };
};

export const createCreep = (id: string, faction: Faction, type: string, isElite: boolean = false, spawnTime: number = 0): Bot => {
  const base = createBot(id, spawnTime);
  const radius = isElite ? 34 : 26;
  const baseHealth = isElite ? 40 : 20;
  const damageMultiplier = isElite ? 1.2 : 0.7;
  const defense = isElite ? 1.2 : 1.0;

  let name = 'Creep';
  if (type === 'salamander') name = 'Salamander';
  if (type === 'frog') name = 'Poison Frog';
  if (type === 'slime') name = 'Ice Slime';
  if (type === 'hornet') name = 'Hornet';
  if (type === 'crab') name = 'Rock Crab';

  return {
    ...base,
    id: `creep-${type}-${id}`,
    name,
    faction,
    position: randomPosInZone(faction),
    radius,
    maxHealth: baseHealth,
    currentHealth: baseHealth,
    maxSpeed: isElite ? 4.5 : 3.5,
    defense,
    damageMultiplier,
    isInvulnerable: false,
    isCreep: true,
    creepType: type,
    isElite,
  };
};

export const createBoss = (spawnTime: number = 0): Bot => {
  const base = createBot('boss', spawnTime);
  return {
    ...base,
    id: 'boss-queen',
    name: 'Cổ Trùng Mẫu',
    faction: Faction.Earth,
    position: randomPosInCenter(),
    radius: BOSS_RADIUS,
    maxHealth: BOSS_MAX_HEALTH,
    currentHealth: BOSS_MAX_HEALTH,
    maxSpeed: 2.5,
    defense: 1.4,
    damageMultiplier: 1.8,
    isInvulnerable: false,
    isBoss: true,
    bossAttackTimer: BOSS_ATTACK_INTERVAL,
    bossAttackCharge: 0,
  };
};

export const createCreeps = (): Bot[] => {
  const creeps: Bot[] = [];
  const creepTypes: Array<{ faction: Faction; type: string }> = [
    { faction: Faction.Fire, type: 'salamander' },
    { faction: Faction.Wood, type: 'frog' },
    { faction: Faction.Water, type: 'slime' },
    { faction: Faction.Metal, type: 'hornet' },
    { faction: Faction.Earth, type: 'crab' },
  ];

  creepTypes.forEach((entry) => {
    for (let i = 0; i < CREEPS_PER_ZONE; i++) {
      creeps.push(createCreep(`${entry.type}-${i}-${Math.random().toString(36).slice(2, 6)}`, entry.faction, entry.type));
    }
  });

  return creeps;
};

export const createFood = (pos?: Vector2, isEjected: boolean = false): Food => ({
  id: Math.random().toString(36).substr(2, 9),
  position: pos ? { ...pos } : randomPos(),
  velocity: { x: 0, y: 0 },
  radius: isEjected ? FOOD_RADIUS * 1.5 : FOOD_RADIUS + Math.random() * 4,
  // Renderer expects PIXI tints; keep food colors in hex to avoid NaN tint crashes.
  color: isEjected ? '#ffffff' : hslToHex(Math.random() * 360, 70, 60),
  isDead: false,
  value: isEjected ? 5 : 1,
  trail: [],
  isEjected,
  kind: isEjected ? 'ejected' : 'normal',
});

export const createRelic = (): Food => ({
  id: `relic-${Math.random().toString(36).slice(2, 10)}`,
  position: randomRelicPos(),
  velocity: { x: 0, y: 0 },
  radius: RELIC_RADIUS,
  color: '#facc15',
  isDead: false,
  value: RELIC_VALUE,
  trail: [],
  kind: 'relic',
});

export const createPowerUp = (type: PowerUp['type'], position: Vector2): PowerUp => {
  const base: PowerUp = {
    id: `power-${type}-${Math.random().toString(36).slice(2, 8)}`,
    position: { ...position },
    velocity: { x: 0, y: 0 },
    radius: 16,
    color: '#ffffff',
    isDead: false,
    trail: [],
    type,
    duration: 0,
  };

  if (type === 'fire_orb') {
    base.color = '#fb923c';
    base.radius = 18;
    base.duration = FIRE_ORB_DURATION;
  }
  if (type === 'healing') {
    base.color = '#86efac';
    base.radius = 18;
  }
  if (type === 'ice_heart') {
    base.color = '#7dd3fc';
    base.radius = 18;
    base.duration = ICE_HEART_DURATION;
  }
  if (type === 'sword_aura') {
    base.color = '#fcd34d';
    base.radius = 18;
  }
  if (type === 'diamond_shield') {
    base.color = '#fde047';
    base.radius = 20;
  }
  if (type === 'healing_fruit') {
    base.color = '#4ade80';
    base.radius = 14;
  }
  if (type === 'legendary_orb') {
    base.color = '#f59e0b';
    base.radius = 22;
  }
  return base;
};

export const createLandmarks = (): Landmark[] => [
  { id: 'landmark-fire', type: 'fire_furnace', position: getZoneCenter(Faction.Fire), radius: 90, timer: 0 },
  { id: 'landmark-wood', type: 'wood_tree', position: getZoneCenter(Faction.Wood), radius: 90, timer: 0 },
  { id: 'landmark-water', type: 'water_statue', position: getZoneCenter(Faction.Water), radius: 90, timer: 0 },
  { id: 'landmark-metal', type: 'metal_altar', position: getZoneCenter(Faction.Metal), radius: 90, timer: 0 },
  { id: 'landmark-earth', type: 'earth_pyramid', position: getZoneCenter(Faction.Earth), radius: 90, timer: 0 },
];

export const createZoneHazards = (): Hazard[] => {
  const hazards: Hazard[] = [];

  for (let i = 0; i < 3; i++) {
    hazards.push(createHazard('vines', randomPosInZone(Faction.Wood), 60, 0, 9999));
    hazards.push(createHazard('thin_ice', randomPosInZone(Faction.Water), 60, 0, 9999));
    hazards.push(createHazard('spear', randomPosInZone(Faction.Metal), 50, 0, 9999));
  }

  for (let i = 0; i < 2; i++) {
    const axisIsX = Math.random() > 0.5;
    const sign = Math.random() > 0.5 ? 1 : -1;
    const direction = axisIsX ? { x: sign, y: 0 } : { x: 0, y: sign };
    hazards.push(createHazard('wind', randomPosInZone(Faction.Metal), 80, 0, 9999, direction));
  }

  hazards.push(createHazard('mushroom', randomPosInZone(Faction.Wood), 50, 0, 9999));

  return hazards;
};

export const createParticle = (x: number, y: number, color: string, speed: number = 8): Particle => {
  return getCurrentEngine().particlePool.get(x, y, color, speed);
};

export const createProjectile = (owner: Player | Bot, type: 'web' | 'ice' | 'sting'): Projectile => {
  const dir = normalize(owner.velocity.x === 0 && owner.velocity.y === 0 ? { x: 1, y: 0 } : owner.velocity);
  const speed = 20;
  const baseDamage = 15;
  const finalDamage = baseDamage * owner.damageMultiplier * owner.skillPowerMultiplier;

  return {
    id: Math.random().toString(),
    position: { ...owner.position },
    velocity: { x: dir.x * speed + owner.velocity.x, y: dir.y * speed + owner.velocity.y },
    radius: 12,
    color: type === 'ice' ? '#bae6fd' : '#4CAF50',
    isDead: false,
    trail: [],
    ownerId: owner.id,
    damage: finalDamage,
    type,
    duration: 2.0,
  };
};

export const createHazard = (
  type: Hazard['type'],
  position: Vector2,
  radius: number,
  timer: number,
  duration: number,
  direction?: Vector2
): Hazard => ({
  id: `hazard-${type}-${Math.random().toString(36).slice(2, 8)}`,
  type,
  position: { ...position },
  radius,
  timer,
  duration,
  direction,
  active: true,
});
