import { 
  GameState, Player, Bot, Food, Vector2, Faction, SizeTier, Particle, Entity, Projectile, FloatingText, LavaZone, DelayedAction,
  PowerUp, Hazard, Landmark, MutationChoice, MutationTier
} from '../types';
import { 
  WORLD_WIDTH, WORLD_HEIGHT, MAP_RADIUS, PLAYER_START_RADIUS, FOOD_COUNT, 
  FOOD_RADIUS, EAT_THRESHOLD_RATIO, DANGER_THRESHOLD_RATIO, 
  FACTION_CONFIG, INITIAL_ZONE_RADIUS, TRAIL_LENGTH,
  EJECT_MASS_COST, EJECT_SPEED, SPAWN_PROTECTION_TIME, ELEMENTAL_ADVANTAGE,
  TURN_SPEED_BASE, ACCELERATION_BASE, FRICTION_BASE, MAX_SPEED_BASE, CENTER_RADIUS, GRID_CELL_SIZE,
  RELIC_RESPAWN_TIME, RELIC_VALUE, RELIC_RADIUS, RELIC_GROWTH, RELIC_HEAL, RELIC_REGEN,
  KING_DAMAGE_TAKEN_MULTIPLIER, KING_DAMAGE_DEALT_MULTIPLIER, KING_BOUNTY_SCORE, KING_BOUNTY_RADIUS,
  MUTATION_CHOICES,
  LIGHTNING_WARNING_TIME, LIGHTNING_RADIUS, LIGHTNING_INTERVAL_ROUND_2, LIGHTNING_INTERVAL_ROUND_3, LIGHTNING_INTERVAL_ROUND_4,
  LIGHTNING_DAMAGE_OUTSIDE, LIGHTNING_DAMAGE_INSIDE, LIGHTNING_DAMAGE_FINAL,
  GEYSER_INTERVAL, GEYSER_WARNING_TIME, GEYSER_DAMAGE,
  ICICLE_INTERVAL, ICICLE_WARNING_TIME, ICICLE_DAMAGE,
  SPEAR_DAMAGE, SPEAR_COOLDOWN,
  VINES_SLOW_MULTIPLIER, VINES_DURATION,
  THIN_ICE_SLOW_MULTIPLIER, THIN_ICE_DURATION,
  WIND_SPEED_MULTIPLIER, MUSHROOM_COOLDOWN,
  DUST_STORM_INTERVAL, DUST_STORM_DURATION,
  FIRE_ORB_DURATION, HEALING_POTION_VALUE, ICE_HEART_DURATION, SWORD_AURA_HITS, DIAMOND_SHIELD_VALUE, HEALING_FRUIT_VALUE,
  CREEPS_PER_ZONE, ELITE_RESPAWN_TIME, BOSS_RESPAWN_TIME, BOSS_MAX_HEALTH, BOSS_DAMAGE, BOSS_RADIUS, BOSS_ATTACK_INTERVAL
} from '../constants';
import { audioManager } from './audioManager';
import { applyMutation, getMutationById, getMutationChoices, getMutationChoicesByTier } from './mutations';

// --- Optimization: Persistent Spatial Grid ---
// WE DO NOT DESTROY THE GRID EVERY FRAME. WE REUSE THE ARRAYS.
class SpatialGrid {
  private cellSize: number;
  private grid: Map<string, Entity[]> = new Map();

  constructor(cellSize: number) {
    this.cellSize = cellSize;
  }
  
  clear() { 
    // Optimization: Don't delete keys, just empty the arrays. 
    // This reduces GC pressure significantly.
    for (const bucket of this.grid.values()) {
        bucket.length = 0;
    }
  }
  
  insert(entity: Entity) {
    const cellX = Math.floor(entity.position.x / this.cellSize);
    const cellY = Math.floor(entity.position.y / this.cellSize);
    const key = `${cellX},${cellY}`;
    
    let bucket = this.grid.get(key);
    if (!bucket) {
        bucket = [];
        this.grid.set(key, bucket);
    }
    bucket.push(entity);
  }
  
  getNearby(entity: Entity): Entity[] {
    const cellX = Math.floor(entity.position.x / this.cellSize);
    const cellY = Math.floor(entity.position.y / this.cellSize);
    
    const nearby: Entity[] = [];
    for(let dx = -1; dx <= 1; dx++) {
      for(let dy = -1; dy <= 1; dy++) {
        const key = `${cellX+dx},${cellY+dy}`;
        const bucket = this.grid.get(key);
        if (bucket && bucket.length > 0) {
          // Fast array copy
          for (let i = 0; i < bucket.length; i++) {
              nearby.push(bucket[i]);
          }
        }
      }
    }
    return nearby;
  }
}

const spatialGrid = new SpatialGrid(GRID_CELL_SIZE);

// --- Optimization: Particle Pooling ---
class ParticlePool {
  private pool: Particle[] = [];
  
  get(x: number, y: number, color: string, speed: number): Particle {
    const p = this.pool.pop() || this.createNew();
    p.position.x = x;
    p.position.y = y;
    p.velocity.x = randomRange(-speed, speed);
    p.velocity.y = randomRange(-speed, speed);
    p.color = color;
    p.life = 1.0;
    p.isDead = false;
    p.radius = randomRange(3, 8);
    return p;
  }
  
  release(particle: Particle) {
    this.pool.push(particle);
  }
  
  private createNew(): Particle {
    return {
      id: Math.random().toString(),
      position: {x:0, y:0},
      velocity: {x:0, y:0},
      radius: 0,
      color: '',
      life: 0,
      maxLife: 1.0,
      isDead: true,
      trail: []
    };
  }
}

const particlePool = new ParticlePool();

// --- Math Helpers ---
const distSq = (v1: Vector2, v2: Vector2) => Math.pow(v2.x - v1.x, 2) + Math.pow(v2.y - v1.y, 2);
const dist = (v1: Vector2, v2: Vector2) => Math.sqrt(distSq(v1, v2));

const randomRange = (min: number, max: number) => Math.random() * (max - min) + min;

const randomPos = (): Vector2 => {
    const angle = Math.random() * Math.PI * 2;
    const r = Math.sqrt(Math.random()) * (MAP_RADIUS - 200) + 200; 
    return {
        x: WORLD_WIDTH / 2 + Math.cos(angle) * r,
        y: WORLD_HEIGHT / 2 + Math.sin(angle) * r
    };
};

const randomPosInZone = (faction: Faction): Vector2 => {
    let pos = randomPos();
    let attempts = 0;
    while (getZoneFromPosition(pos) !== faction && attempts < 50) {
        pos = randomPos();
        attempts += 1;
    }
    return pos;
};

const randomPosInCenter = (): Vector2 => {
    const angle = Math.random() * Math.PI * 2;
    const r = Math.sqrt(Math.random()) * (CENTER_RADIUS * 0.9);
    return {
        x: WORLD_WIDTH / 2 + Math.cos(angle) * r,
        y: WORLD_HEIGHT / 2 + Math.sin(angle) * r
    };
};

const randomRelicPos = (): Vector2 => {
    const angle = Math.random() * Math.PI * 2;
    const minR = CENTER_RADIUS * 1.2;
    const maxR = MAP_RADIUS * 0.6;
    const r = Math.sqrt(Math.random()) * (maxR - minR) + minR;
    return {
        x: WORLD_WIDTH / 2 + Math.cos(angle) * r,
        y: WORLD_HEIGHT / 2 + Math.sin(angle) * r
    };
};

const normalize = (v: Vector2): Vector2 => {
  const len = Math.sqrt(v.x*v.x + v.y*v.y);
  return len === 0 ? {x:0, y:0} : {x: v.x/len, y: v.y/len};
}

const getZoneCenter = (faction: Faction): Vector2 => {
    const cx = WORLD_WIDTH / 2;
    const cy = WORLD_HEIGHT / 2;
    const zoneOrder = [Faction.Wood, Faction.Water, Faction.Earth, Faction.Metal, Faction.Fire];
    const index = zoneOrder.indexOf(faction);
    const sector = (Math.PI * 2) / 5;
    const startAngle = -Math.PI / 2 - (sector / 2); 
    const midAngle = startAngle + (index + 0.5) * sector;
    const r = MAP_RADIUS * 0.6;
    return {
        x: cx + Math.cos(midAngle) * r,
        y: cy + Math.sin(midAngle) * r
    };
};

const getZoneFromPosition = (pos: Vector2): Faction | 'Center' => {
    const cx = WORLD_WIDTH / 2;
    const cy = WORLD_HEIGHT / 2;
    const dx = pos.x - cx;
    const dy = pos.y - cy;
    const dSq = dx*dx + dy*dy;

    if (dSq < CENTER_RADIUS * CENTER_RADIUS) return 'Center';

    let angle = Math.atan2(dy, dx); 
    if (angle < 0) angle += 2 * Math.PI;

    const sector = (Math.PI * 2) / 5;
    const adjustedAngle = (angle + (Math.PI / 2) + (sector / 2)) % (Math.PI * 2);
    const index = Math.floor(adjustedAngle / sector);
    const zones = [Faction.Wood, Faction.Water, Faction.Earth, Faction.Metal, Faction.Fire];
    return zones[index] || Faction.Fire;
};

// --- Factory Methods ---
export const createPlayer = (name: string, faction: Faction): Player => {
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
      kingForm: 0
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
      visionBoostTimer: 0
    }
  };
};

export const createBot = (id: string): Bot => {
  const factions = Object.values(Faction);
  const faction = factions[Math.floor(Math.random() * factions.length)];
  const base = createPlayer(`Bot ${id}`, faction);
  return {
    ...base,
    id: `bot-${id}`,
    position: randomPos(), 
    aiState: 'wander',
    targetEntityId: null,
    isInvulnerable: true,
    aiReactionTimer: 0,
  };
};

export const createCreep = (id: string, faction: Faction, type: string, isElite: boolean = false): Bot => {
  const base = createBot(id);
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

export const createBoss = (): Bot => {
  const base = createBot('boss');
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
  radius: isEjected ? FOOD_RADIUS * 1.5 : (FOOD_RADIUS + Math.random() * 4),
  color: isEjected ? '#FFFFFF' : `hsl(${Math.random() * 360}, 70%, 60%)`,
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

export const createLandmarks = (): Landmark[] => ([
  { id: 'landmark-fire', type: 'fire_furnace', position: getZoneCenter(Faction.Fire), radius: 90, timer: 0 },
  { id: 'landmark-wood', type: 'wood_tree', position: getZoneCenter(Faction.Wood), radius: 90, timer: 0 },
  { id: 'landmark-water', type: 'water_statue', position: getZoneCenter(Faction.Water), radius: 90, timer: 0 },
  { id: 'landmark-metal', type: 'metal_altar', position: getZoneCenter(Faction.Metal), radius: 90, timer: 0 },
  { id: 'landmark-earth', type: 'earth_pyramid', position: getZoneCenter(Faction.Earth), radius: 90, timer: 0 },
]);

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
  return particlePool.get(x, y, color, speed);
};

export const createProjectile = (owner: Player | Bot, type: 'web' | 'ice' | 'sting'): Projectile => {
    const dir = normalize(owner.velocity.x === 0 && owner.velocity.y === 0 ? {x:1, y:0} : owner.velocity);
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
        duration: 2.0 
    };
};

const createFloatingText = (pos: Vector2, text: string, color: string, size: number = 20): FloatingText => ({
    id: Math.random().toString(),
    position: { x: pos.x, y: pos.y - 20 },
    text,
    color,
    size,
    life: 1.0,
    velocity: { x: randomRange(-1, 1), y: -3 } // Float up
});

const createHazard = (type: Hazard['type'], position: Vector2, radius: number, timer: number, duration: number, direction?: Vector2): Hazard => ({
    id: `hazard-${type}-${Math.random().toString(36).slice(2, 8)}`,
    type,
    position: { ...position },
    radius,
    timer,
    duration,
    direction,
    active: true
});

const tryRevive = (entity: Player | Bot, state: GameState) => {
    if (!entity.reviveAvailable || entity.currentHealth > 0) return false;
    entity.reviveAvailable = false;
    entity.currentHealth = 1;
    entity.isDead = false;
    state.floatingTexts.push(createFloatingText(entity.position, "SURVIVE!", '#fef08a', 18));
    return true;
};

const applyPowerUpEffect = (entity: Player | Bot, powerUp: PowerUp, state: GameState) => {
    if (powerUp.type === 'fire_orb') {
        entity.statusEffects.damageBoost = Math.max(entity.statusEffects.damageBoost, 1.3);
        entity.statusEffects.damageBoostTimer = Math.max(entity.statusEffects.damageBoostTimer, FIRE_ORB_DURATION);
        state.floatingTexts.push(createFloatingText(entity.position, "FIRE ORB", '#fb923c', 16));
    }
    if (powerUp.type === 'healing') {
        entity.currentHealth = Math.min(entity.maxHealth, entity.currentHealth + entity.maxHealth * HEALING_POTION_VALUE);
        state.floatingTexts.push(createFloatingText(entity.position, "+HP", '#4ade80', 16));
    }
    if (powerUp.type === 'ice_heart') {
        entity.statusEffects.speedBoost = Math.max(entity.statusEffects.speedBoost, 1.4);
        entity.statusEffects.speedBoostTimer = Math.max(entity.statusEffects.speedBoostTimer, ICE_HEART_DURATION);
        state.floatingTexts.push(createFloatingText(entity.position, "ICE HEART", '#7dd3fc', 16));
    }
    if (powerUp.type === 'sword_aura') {
        entity.statusEffects.critCharges = Math.max(entity.statusEffects.critCharges, SWORD_AURA_HITS);
        entity.critChance = Math.max(entity.critChance, 0.2);
        state.floatingTexts.push(createFloatingText(entity.position, "CRIT!", '#facc15', 16));
    }
    if (powerUp.type === 'diamond_shield') {
        entity.statusEffects.shieldTimer = Math.max(entity.statusEffects.shieldTimer, DIAMOND_SHIELD_VALUE / 10);
        entity.statusEffects.defenseBoost = Math.max(entity.statusEffects.defenseBoost, 1.25);
        entity.statusEffects.defenseBoostTimer = Math.max(entity.statusEffects.defenseBoostTimer, 6);
        state.floatingTexts.push(createFloatingText(entity.position, "SHIELD", '#fde047', 16));
    }
    if (powerUp.type === 'healing_fruit') {
        entity.currentHealth = Math.min(entity.maxHealth, entity.currentHealth + HEALING_FRUIT_VALUE);
        state.floatingTexts.push(createFloatingText(entity.position, "+FRUIT", '#4ade80', 14));
    }
    if (powerUp.type === 'legendary_orb' && entity.id === 'player') {
        const choices = getMutationChoicesByTier(new Set(entity.mutations), MutationTier.Legendary, MUTATION_CHOICES);
        if (choices.length) {
            state.mutationChoices = choices;
            state.isPaused = true;
        }
        state.floatingTexts.push(createFloatingText(entity.position, "LEGENDARY!", '#f59e0b', 18));
    }
};

// --- Physics Logic (FLUID DYNAMICS) ---

const applyPhysics = (entity: Player | Bot, target: Vector2, dt: number, currentZone: Faction | 'Center') => {
    if (entity.statusEffects.airborne || entity.statusEffects.rooted > 0) return; 

    // PHYSICS 4.0: VECTOR FORCE CONTROL
    // Controls: Direct Force Application (Tighter, Snappier)
    // No more "tank turning". We apply force in the direction of the target.

    const dx = target.x - entity.position.x;
    const dy = target.y - entity.position.y;
    const distToTarget = Math.sqrt(dx*dx + dy*dy);

    // 1. Calculate Stats Modifiers
    // Size Penalty: Less penalty than before for better high-level play
    let sizePenalty = Math.max(0.6, PLAYER_START_RADIUS / Math.max(PLAYER_START_RADIUS, entity.radius * 0.7)); 
    sizePenalty = Math.min(1, sizePenalty * entity.sizePenaltyMultiplier);
    
    const surgeBoost = entity.statusEffects.speedSurge > 0 ? 2.0 : 1.0;
    let currentMaxSpeed = entity.maxSpeed * sizePenalty * entity.statusEffects.speedBoost * surgeBoost;
    if (entity.statusEffects.slowed) currentMaxSpeed *= entity.statusEffects.slowMultiplier;
    
    // Zone Friction
    let friction = FRICTION_BASE;
    if (currentZone === Faction.Water) {
        friction = entity.faction === Faction.Water ? FRICTION_BASE : 0.96;
        if (entity.faction === Faction.Water) currentMaxSpeed *= 1.3;
    } else if (currentZone === Faction.Metal) {
        currentMaxSpeed *= 1.2;
    } else if (currentZone === Faction.Wood) {
        if (entity.faction !== Faction.Wood) currentMaxSpeed *= 0.85; 
    }

    // 2. Calculate Force
    const dirX = distToTarget > 0 ? dx / distToTarget : 0;
    const dirY = distToTarget > 0 ? dy / distToTarget : 0;

    let thrust = ACCELERATION_BASE;
    
    // 3. Counter-Thrust (The "Snappy" Factor)
    // If the entity is trying to move opposite to its current velocity, apply EXTRA force.
    const speed = Math.sqrt(entity.velocity.x*entity.velocity.x + entity.velocity.y*entity.velocity.y);
    if (speed > 1) {
        const vX = entity.velocity.x / speed;
        const vY = entity.velocity.y / speed;
        const dot = vX * dirX + vY * dirY; // 1.0 = Same Dir, -1.0 = Opposite Dir
        
        // If turning sharp or reversing (dot < 0.5), apply massive breaking/turning force
        if (dot < 0.5) {
            thrust *= 2.5; 
            friction *= 0.9; // Apply extra friction to kill old momentum
        }
    }

    // 4. Apply Force
    entity.velocity.x += dirX * thrust;
    entity.velocity.y += dirY * thrust;

    // 5. Cap Speed
    const newSpeed = Math.sqrt(entity.velocity.x**2 + entity.velocity.y**2);
    if (newSpeed > currentMaxSpeed) {
        const scale = currentMaxSpeed / newSpeed;
        entity.velocity.x *= scale;
        entity.velocity.y *= scale;
    }

    // 6. Apply Friction
    entity.velocity.x *= friction;
    entity.velocity.y *= friction;
    
    // 7. Arrival Damping (Anti-jitter when close to cursor)
    if (distToTarget < 20) {
        entity.velocity.x *= 0.8;
        entity.velocity.y *= 0.8;
    }

    // 8. Integration
    entity.position.x += entity.velocity.x;
    entity.position.y += entity.velocity.y;

    // Map Constraints
    const mapCenterX = WORLD_WIDTH / 2;
    const mapCenterY = WORLD_HEIGHT / 2;
    const dxCenter = entity.position.x - mapCenterX;
    const dyCenter = entity.position.y - mapCenterY;
    const distFromCenterSq = dxCenter*dxCenter + dyCenter*dyCenter;
    const mapRadiusSq = MAP_RADIUS * MAP_RADIUS;

    if (distFromCenterSq > mapRadiusSq) {
        const angleToCenter = Math.atan2(dyCenter, dxCenter);
        entity.position.x = mapCenterX + Math.cos(angleToCenter) * (MAP_RADIUS - 5);
        entity.position.y = mapCenterY + Math.sin(angleToCenter) * (MAP_RADIUS - 5);
        entity.velocity.x *= -0.5;
        entity.velocity.y *= -0.5;
    }

    if (!entity.trail) entity.trail = [];
    if (newSpeed > 3 && Math.random() > 0.7) {
        entity.trail.unshift({ x: entity.position.x, y: entity.position.y });
        if (entity.trail.length > TRAIL_LENGTH) entity.trail.pop();
    }
};

const updateTier = (player: Player) => {
  const previousTier = player.tier;
  const progress = (player.radius - PLAYER_START_RADIUS) / 200; 
  if (progress < 0.2) player.tier = SizeTier.Larva;
  else if (progress < 0.4) player.tier = SizeTier.Juvenile;
  else if (progress < 0.6) player.tier = SizeTier.Adult;
  else if (progress < 0.8) player.tier = SizeTier.Elder;
  else player.tier = SizeTier.AncientKing;
  return previousTier !== player.tier;
};

// --- Zone Logic (Phase 4) ---
const updateZoneRadius = (gameTime: number): number => {
    if (gameTime < 150) { 
        return INITIAL_ZONE_RADIUS;
    } else if (gameTime < 300) { 
        const progress = (gameTime - 150) / 150;
        return INITIAL_ZONE_RADIUS * (1 - progress * 0.3); 
    } else if (gameTime < 450) { 
        const progress = (gameTime - 300) / 150;
        return INITIAL_ZONE_RADIUS * 0.7 * (1 - progress * 0.43); 
    } else { 
        const progress = Math.min(1, (gameTime - 450) / 30); 
        return Math.max(CENTER_RADIUS, INITIAL_ZONE_RADIUS * 0.4 * (1 - progress));
    }
};

const spawnEliteCreeps = (state: GameState) => {
  const eliteTypes: Array<{ faction: Faction; type: string }> = [
    { faction: Faction.Fire, type: 'salamander' },
    { faction: Faction.Wood, type: 'frog' },
    { faction: Faction.Water, type: 'slime' },
    { faction: Faction.Metal, type: 'hornet' },
    { faction: Faction.Earth, type: 'crab' },
  ];

  eliteTypes.forEach((entry) => {
    state.creeps.push(createCreep(`elite-${entry.type}-${Math.random().toString(36).slice(2, 6)}`, entry.faction, entry.type, true));
  });
};

// --- Main Game Loop ---

export const updateGameState = (state: GameState, dt: number): GameState => {
  const newState = state; // MUTATING STATE DIRECTLY FOR PERFORMANCE (React is decoupled now)
  
  if (newState.isPaused) return newState;

  newState.gameTime += dt;
  
  if (newState.gameTime > SPAWN_PROTECTION_TIME) {
    newState.player.isInvulnerable = false;
    newState.bots.forEach(b => b.isInvulnerable = false);
  }

  // Decay Screen Shake
  if (newState.shakeIntensity > 0) newState.shakeIntensity *= 0.9;
  if (newState.shakeIntensity < 0.5) newState.shakeIntensity = 0;

  // --- Round Logic ---
  const previousRound = newState.currentRound;
  let newRound = 1;
  if (newState.gameTime >= 450) newRound = 4; 
  else if (newState.gameTime >= 300) newRound = 3; 
  else if (newState.gameTime >= 150) newRound = 2; 
  
  newState.currentRound = newRound;

  if (newRound > previousRound) {
      audioManager.playWarning();
      newState.shakeIntensity = 1.0;
      let roundText = '';
      if (newRound === 2) roundText = "BO ROUND 1: TOXIC SPREADING!";
      if (newRound === 3) roundText = "BO ROUND 2: MAP SHRINKING!";
      if (newRound === 4) roundText = "SUDDEN DEATH: SURVIVE!";

      newState.floatingTexts.push({
          id: Math.random().toString(),
          position: { ...newState.player.position, y: newState.player.position.y - 100 },
          text: roundText,
          color: '#ef4444',
          size: 32,
          life: 4.0,
          velocity: { x: 0, y: -2 }
      });

      if (newRound >= 2) {
          spawnEliteCreeps(newState);
      }
  }

  newState.zoneRadius = updateZoneRadius(newState.gameTime);

  const hazardTimers = newState.hazardTimers;
  if (hazardTimers) {
      const lightningInterval = newState.currentRound >= 4
        ? LIGHTNING_INTERVAL_ROUND_4
        : newState.currentRound >= 3
          ? LIGHTNING_INTERVAL_ROUND_3
          : LIGHTNING_INTERVAL_ROUND_2;

      hazardTimers.lightning -= dt;
      if (hazardTimers.lightning <= 0) {
          const targetEntities = [newState.player, ...newState.bots].filter(e => !e.isDead);
          if (targetEntities.length) {
              const totalWeight = targetEntities.reduce((sum, e) => sum + e.radius, 0);
              let roll = Math.random() * totalWeight;
              let target = targetEntities[0];
              for (const entity of targetEntities) {
                  roll -= entity.radius;
                  if (roll <= 0) {
                      target = entity;
                      break;
                  }
              }
              const strikePos = { ...target.position };
              newState.hazards.push(createHazard('lightning', strikePos, LIGHTNING_RADIUS, LIGHTNING_WARNING_TIME, 0.4));
          }
          hazardTimers.lightning = lightningInterval;
      }

      hazardTimers.geyser -= dt;
      if (hazardTimers.geyser <= 0) {
          newState.hazards.push(createHazard('geyser', randomPosInZone(Faction.Fire), 60, GEYSER_WARNING_TIME, 0.4));
          hazardTimers.geyser = GEYSER_INTERVAL;
      }

      hazardTimers.icicle -= dt;
      if (hazardTimers.icicle <= 0) {
          newState.hazards.push(createHazard('icicle', randomPosInZone(Faction.Water), 60, ICICLE_WARNING_TIME, 0.4));
          hazardTimers.icicle = ICICLE_INTERVAL;
      }

      if (hazardTimers.dustStormActive) {
          hazardTimers.dustStorm -= dt;
          if (hazardTimers.dustStorm <= 0) {
              hazardTimers.dustStormActive = false;
              hazardTimers.dustStorm = DUST_STORM_INTERVAL;
          }
      } else {
          hazardTimers.dustStorm -= dt;
          if (hazardTimers.dustStorm <= 0) {
              hazardTimers.dustStormActive = true;
              hazardTimers.dustStorm = DUST_STORM_DURATION;
          }
      }

      hazardTimers.powerUpFire -= dt;
      if (hazardTimers.powerUpFire <= 0) {
          newState.powerUps.push(createPowerUp('fire_orb', randomPosInZone(Faction.Fire)));
          hazardTimers.powerUpFire = 30;
      }
      hazardTimers.powerUpWood -= dt;
      if (hazardTimers.powerUpWood <= 0) {
          newState.powerUps.push(createPowerUp('healing', randomPosInZone(Faction.Wood)));
          hazardTimers.powerUpWood = 28;
      }
      hazardTimers.powerUpWater -= dt;
      if (hazardTimers.powerUpWater <= 0) {
          newState.powerUps.push(createPowerUp('ice_heart', randomPosInZone(Faction.Water)));
          hazardTimers.powerUpWater = 32;
      }
      hazardTimers.powerUpMetal -= dt;
      if (hazardTimers.powerUpMetal <= 0) {
          newState.powerUps.push(createPowerUp('sword_aura', randomPosInZone(Faction.Metal)));
          hazardTimers.powerUpMetal = 30;
      }
      hazardTimers.powerUpEarth -= dt;
      if (hazardTimers.powerUpEarth <= 0) {
          newState.powerUps.push(createPowerUp('diamond_shield', randomPosInZone(Faction.Earth)));
          hazardTimers.powerUpEarth = 34;
      }

      if (!newState.boss || newState.boss.isDead) {
          hazardTimers.bossRespawn -= dt;
          if (hazardTimers.bossRespawn <= 0) {
              newState.boss = createBoss();
              hazardTimers.bossRespawn = BOSS_RESPAWN_TIME;
          }
      }

      hazardTimers.creepRespawn -= dt;
      if (hazardTimers.creepRespawn <= 0) {
          const creepTypes: Array<{ faction: Faction; type: string }> = [
            { faction: Faction.Fire, type: 'salamander' },
            { faction: Faction.Wood, type: 'frog' },
            { faction: Faction.Water, type: 'slime' },
            { faction: Faction.Metal, type: 'hornet' },
            { faction: Faction.Earth, type: 'crab' },
          ];
          if (newState.creeps.length < CREEPS_PER_ZONE * 6) {
              const pick = creepTypes[Math.floor(Math.random() * creepTypes.length)];
              newState.creeps.push(createCreep(`${pick.type}-${Math.random().toString(36).slice(2, 6)}`, pick.faction, pick.type));
          }
          hazardTimers.creepRespawn = ELITE_RESPAWN_TIME;
      }
  }

  newState.landmarks.forEach(landmark => {
      if (landmark.type === 'wood_tree') {
          landmark.timer -= dt;
          if (landmark.timer <= 0) {
              newState.powerUps.push(createPowerUp('healing_fruit', { x: landmark.position.x + randomRange(-40, 40), y: landmark.position.y + randomRange(-40, 40) }));
              landmark.timer = 15;
          }
      }
  });

  // --- Relic Objective ---
  if (newState.relicId) {
    const relicExists = newState.food.some(f => f.id === newState.relicId && !f.isDead);
    if (!relicExists) newState.relicId = null;
  }
  if (!newState.relicId) {
    newState.relicTimer -= dt;
    if (newState.relicTimer <= 0) {
      const relic = createRelic();
      newState.food.push(relic);
      newState.relicId = relic.id;
      newState.relicTimer = RELIC_RESPAWN_TIME;
      newState.floatingTexts.push(createFloatingText(relic.position, "ANCIENT RELIC!", '#facc15', 24));
    }
  }

  // --- Process Delayed Actions (Skills) ---
  for (let i = newState.delayedActions.length - 1; i >= 0; i--) {
    const action = newState.delayedActions[i];
    action.timer -= dt;
    if (action.timer <= 0) {
        executeDelayedAction(action, newState);
        newState.delayedActions.splice(i, 1);
    }
  }

  // --- King Logic ---
  const allEntities = [newState.player, ...newState.bots].filter(e => !e.isDead);
  let maxR = 0;
  let newKingId = null;
  allEntities.forEach(e => {
      if (e.radius > maxR) {
          maxR = e.radius;
          newKingId = e.id;
      }
  });
  newState.kingId = newKingId;

  // --- 1. Player Abilities ---
  if (state.inputs.w && newState.player.radius > PLAYER_START_RADIUS + EJECT_MASS_COST) {
     newState.player.radius -= EJECT_MASS_COST * 0.5; 
     const dir = normalize(newState.player.velocity);
     if (dir.x === 0 && dir.y === 0) dir.x = 1;
     
     const food = createFood({
        x: newState.player.position.x + dir.x * (newState.player.radius + 15),
        y: newState.player.position.y + dir.y * (newState.player.radius + 15)
     }, true);
     
     // Recoil
     newState.player.velocity.x -= dir.x * 2; 
     newState.player.velocity.y -= dir.y * 2;

     food.velocity = { x: dir.x * EJECT_SPEED, y: dir.y * EJECT_SPEED };
     newState.food.push(food);
     audioManager.playEject();
     state.inputs.w = false;
  }

  if (state.inputs.space && newState.player.skillCooldown <= 0) {
      castSkill(newState.player, newState, dt);
      state.inputs.space = false;
  }

  // --- 2. Update Entities ---
  const entities = [newState.player, ...newState.bots, ...newState.creeps];
  if (newState.boss) entities.push(newState.boss);
  
  // Optimization: REUSE Spatial Grid logic
  spatialGrid.clear();
  newState.food.forEach(f => spatialGrid.insert(f));
  newState.powerUps.forEach(p => spatialGrid.insert(p));
  entities.forEach(e => !e.isDead && spatialGrid.insert(e));

  // --- Hazards Update (Telegraphed Impacts) ---
  newState.hazards.forEach(hazard => {
      if (hazard.type === 'lightning' || hazard.type === 'geyser' || hazard.type === 'icicle') {
          if (hazard.timer > 0) {
              hazard.timer -= dt;
          } else if (hazard.active) {
              entities.forEach(target => {
                  if (target.isDead || target.statusEffects.airborne) return;
                  const dSq = distSq(target.position, hazard.position);
                  if (dSq <= hazard.radius * hazard.radius) {
                      let damage = 0;
                      if (hazard.type === 'lightning') {
                          const outOfZone = distSq(target.position, { x: WORLD_WIDTH / 2, y: WORLD_HEIGHT / 2 }) > newState.zoneRadius * newState.zoneRadius;
                          const dmgRatio = newState.currentRound >= 4 ? LIGHTNING_DAMAGE_FINAL : outOfZone ? LIGHTNING_DAMAGE_OUTSIDE : LIGHTNING_DAMAGE_INSIDE;
                          damage = target.maxHealth * dmgRatio;
                      }
                      if (hazard.type === 'geyser') {
                          damage = GEYSER_DAMAGE;
                          if (target.faction === Faction.Metal) damage *= 1.6;
                      }
                      if (hazard.type === 'icicle') damage = ICICLE_DAMAGE;

                      if (!target.isInvulnerable && target.statusEffects.invulnerable <= 0) {
                          target.currentHealth -= damage;
                          target.statusEffects.invulnerable = 1.0;
                          if (hazard.type === 'icicle') {
                              target.statusEffects.slowTimer = Math.max(target.statusEffects.slowTimer, THIN_ICE_DURATION);
                              target.statusEffects.slowMultiplier = Math.min(target.statusEffects.slowMultiplier, THIN_ICE_SLOW_MULTIPLIER);
                          }
                      }
                  }
              });
              hazard.active = false;
              hazard.duration = 0.4;
          } else if (hazard.duration > 0) {
              hazard.duration -= dt;
          }
      }

      if (hazard.type === 'spear' && hazard.timer > 0) {
          hazard.timer -= dt;
      }
  });

  newState.hazards = newState.hazards.filter(hazard => {
      if (hazard.type === 'lightning' || hazard.type === 'geyser' || hazard.type === 'icicle') {
          return hazard.active || hazard.timer > 0 || hazard.duration > 0;
      }
      return true;
  });

  entities.forEach(entity => {
      if (entity.isDead) return;

      const currentZone = getZoneFromPosition(entity.position);

      // Status Effects Update
      if (entity.statusEffects.invulnerable > 0) entity.statusEffects.invulnerable -= dt;
      if (entity.statusEffects.invulnerable < 0) entity.statusEffects.invulnerable = 0;

      if (entity.statusEffects.rooted > 0) entity.statusEffects.rooted -= dt;
      if (entity.statusEffects.rooted < 0) entity.statusEffects.rooted = 0;

      if (entity.statusEffects.speedSurge > 0) {
          entity.statusEffects.speedSurge -= dt;
          if (entity.statusEffects.speedSurge < 0) entity.statusEffects.speedSurge = 0;
      }

      if (entity.statusEffects.kingForm > 0) {
          entity.statusEffects.kingForm -= dt;
          if (entity.statusEffects.kingForm < 0) entity.statusEffects.kingForm = 0;
      }

      if (entity.statusEffects.damageBoostTimer > 0) {
          entity.statusEffects.damageBoostTimer -= dt;
          if (entity.statusEffects.damageBoostTimer <= 0) {
              entity.statusEffects.damageBoost = 1;
              entity.statusEffects.damageBoostTimer = 0;
          }
      }

      if (entity.statusEffects.defenseBoostTimer > 0) {
          entity.statusEffects.defenseBoostTimer -= dt;
          if (entity.statusEffects.defenseBoostTimer <= 0) {
              entity.statusEffects.defenseBoost = 1;
              entity.statusEffects.defenseBoostTimer = 0;
          }
      }

      if (entity.statusEffects.visionBoostTimer > 0) {
          entity.statusEffects.visionBoostTimer -= dt;
          if (entity.statusEffects.visionBoostTimer <= 0) {
              entity.statusEffects.visionBoost = 1;
              entity.statusEffects.visionBoostTimer = 0;
          }
      }

      if (entity.statusEffects.shieldTimer > 0) {
          entity.statusEffects.shielded = true;
          entity.statusEffects.shieldTimer -= dt;
          if (entity.statusEffects.shieldTimer <= 0) {
              entity.statusEffects.shielded = false;
              entity.statusEffects.shieldTimer = 0;
          }
      }

      if (entity.statusEffects.speedBoostTimer > 0) {
          entity.statusEffects.speedBoostTimer -= dt;
          if (entity.statusEffects.speedBoostTimer <= 0) {
              entity.statusEffects.speedBoost = 1;
              entity.statusEffects.speedBoostTimer = 0;
          }
      } else if (entity.statusEffects.speedBoost > 1) {
          entity.statusEffects.speedBoost -= dt * 2.0; 
          if (entity.statusEffects.speedBoost < 1) entity.statusEffects.speedBoost = 1;
          if (entity.faction === Faction.Metal) {
             newState.particles.push(createParticle(entity.position.x, entity.position.y, '#94a3b8', 5));
          }
      } else if (entity.statusEffects.speedBoost < 1) {
          entity.statusEffects.speedBoost = 1;
      }

      if (entity.statusEffects.slowTimer > 0) {
          entity.statusEffects.slowed = true;
          entity.statusEffects.slowTimer -= dt;
          if (entity.statusEffects.slowTimer <= 0) {
              entity.statusEffects.slowed = false;
              entity.statusEffects.slowTimer = 0;
              entity.statusEffects.slowMultiplier = 1;
          }
      }

      if (entity.statusEffects.poisonTimer > 0) {
          entity.statusEffects.poisoned = true;
          entity.currentHealth -= 3 * dt;
          entity.statusEffects.poisonTimer -= dt;
          if (Math.random() < 0.1) newState.floatingTexts.push(createFloatingText(entity.position, "☠", '#84cc16', 12));
          if (entity.statusEffects.poisonTimer <= 0) {
              entity.statusEffects.poisoned = false;
              entity.statusEffects.poisonTimer = 0;
          }
      }

      if (entity.statusEffects.burnTimer > 0) {
          entity.statusEffects.burning = true;
          entity.currentHealth -= 5 * dt;
          entity.statusEffects.burnTimer -= dt;
          if (Math.random() < 0.1) newState.floatingTexts.push(createFloatingText(entity.position, "🔥", '#f97316', 12));
          if (entity.statusEffects.burnTimer <= 0) {
              entity.statusEffects.burning = false;
              entity.statusEffects.burnTimer = 0;
          }
      }

      if (entity.statusEffects.regen > 0) {
          entity.currentHealth = Math.min(entity.maxHealth, entity.currentHealth + entity.statusEffects.regen * dt);
          entity.statusEffects.regen -= dt * 2; 
          if (entity.statusEffects.regen < 0) entity.statusEffects.regen = 0;
      }

      const speedNow = Math.sqrt(entity.velocity.x * entity.velocity.x + entity.velocity.y * entity.velocity.y);
      if (speedNow < 0.2) entity.stationaryTime += dt;
      else entity.stationaryTime = 0;

      if (entity.skillCooldown > 0) {
          entity.skillCooldown -= dt;
          if (entity.skillCooldown < 0) entity.skillCooldown = 0;
      }
      if (entity.mutations.includes('stealth')) {
          if (speedNow < 0.2) {
              entity.statusEffects.stealthCharge += dt;
              if (entity.statusEffects.stealthCharge >= 3) entity.statusEffects.stealthed = true;
          } else {
              entity.statusEffects.stealthed = false;
              entity.statusEffects.stealthCharge = 0;
          }
      } else {
          entity.statusEffects.stealthed = false;
          entity.statusEffects.stealthCharge = 0;
      }

      if (entity.mutationCooldowns.speedSurge > 0) entity.mutationCooldowns.speedSurge -= dt;
      if (entity.mutationCooldowns.invulnerable > 0) entity.mutationCooldowns.invulnerable -= dt;
      if (entity.mutationCooldowns.rewind > 0) entity.mutationCooldowns.rewind -= dt;
      if (entity.mutationCooldowns.lightning > 0) entity.mutationCooldowns.lightning -= dt;
      if (entity.mutationCooldowns.chaos > 0) entity.mutationCooldowns.chaos -= dt;
      if (entity.mutationCooldowns.kingForm > 0) entity.mutationCooldowns.kingForm -= dt;

      if (entity.mutations.includes('rewind')) {
          entity.rewindHistory.push({ position: { ...entity.position }, health: entity.currentHealth, time: newState.gameTime });
          entity.rewindHistory = entity.rewindHistory.filter(entry => newState.gameTime - entry.time <= 5);
          if (entity.currentHealth <= entity.maxHealth * 0.3 && entity.mutationCooldowns.rewind <= 0 && entity.rewindHistory.length) {
              const snapshot = entity.rewindHistory[0];
              entity.position = { ...snapshot.position };
              entity.currentHealth = Math.max(entity.currentHealth, snapshot.health);
              entity.statusEffects.invulnerable = 1.2;
              entity.mutationCooldowns.rewind = 30;
              newState.floatingTexts.push(createFloatingText(entity.position, "REWIND!", '#a855f7', 18));
          }
      } else {
          entity.rewindHistory = [];
      }

      if (entity.id === 'player') {
          applyPhysics(entity, entity.targetPosition, dt, currentZone);
      } else if ((entity as Bot).isBoss) {
          updateBossAI(entity as Bot, newState, dt, currentZone);
      } else if ((entity as Bot).isCreep) {
          updateCreepAI(entity as Bot, newState, dt, currentZone);
      } else {
          updateBotAI(entity as Bot, newState, dt, currentZone);
      }

      const tierUp = updateTier(entity);
      if (tierUp && entity.id === 'player') {
          if (!newState.mutationChoices) {
              const owned = new Set(entity.mutations);
              newState.mutationChoices = getMutationChoices(owned, entity.tier, MUTATION_CHOICES);
              newState.isPaused = true;
          }
      } else if (tierUp && !(entity as Bot).isCreep && !(entity as Bot).isBoss) {
          const owned = new Set(entity.mutations);
          const choices = getMutationChoices(owned, entity.tier, 1);
          if (choices[0]) applyMutation(entity, choices[0].id);
      }

      // --- ZONE HAZARDS & BUFFS ---
      if (currentZone === Faction.Fire) {
          if (entity.faction !== Faction.Fire) {
              if (!entity.isInvulnerable && !entity.statusEffects.airborne) {
                  const fireDamage = entity.faction === Faction.Water ? 16 : 8;
                  entity.currentHealth -= (fireDamage / entity.defense) * dt; 
                  if (Math.random() < 0.1) newState.particles.push(createParticle(entity.position.x, entity.position.y, '#f97316', 3));
              }
          } else {
              if (entity.currentHealth < entity.maxHealth) entity.currentHealth += 5 * dt;
          }
      }
      if (currentZone === Faction.Wood) {
           if (entity.faction === Faction.Wood && entity.currentHealth < entity.maxHealth) entity.currentHealth += 6 * dt;
           if (entity.faction === Faction.Wood && entity.stationaryTime > 1.5) entity.statusEffects.regen = Math.max(entity.statusEffects.regen, 4);
      }
      if (currentZone === Faction.Water && entity.faction === Faction.Water) {
          if (entity.currentHealth < entity.maxHealth) entity.currentHealth += 2 * dt;
      }

      if (currentZone === Faction.Earth && entity.faction !== Faction.Earth) {
          const crumbleThreshold = entity.faction === Faction.Wood ? 1.2 : 2;
          if (entity.stationaryTime > crumbleThreshold) {
              entity.currentHealth -= 10;
              entity.stationaryTime = 0;
              newState.floatingTexts.push(createFloatingText(entity.position, "-10", '#f97316', 14));
          }
      }

      if (entity.teleportCooldown > 0) entity.teleportCooldown -= dt;
      if (entity.landmarkCooldown > 0) entity.landmarkCooldown -= dt;

      newState.hazards.forEach(hazard => {
          const dSq = distSq(entity.position, hazard.position);
          if (dSq > hazard.radius * hazard.radius) return;

          if (hazard.type === 'vines' && entity.faction !== Faction.Wood) {
              entity.statusEffects.slowTimer = Math.max(entity.statusEffects.slowTimer, VINES_DURATION);
              entity.statusEffects.slowMultiplier = Math.min(entity.statusEffects.slowMultiplier, VINES_SLOW_MULTIPLIER);
          }
          if (hazard.type === 'thin_ice' && entity.faction !== Faction.Water) {
              entity.statusEffects.slowTimer = Math.max(entity.statusEffects.slowTimer, THIN_ICE_DURATION);
              entity.statusEffects.slowMultiplier = Math.min(entity.statusEffects.slowMultiplier, THIN_ICE_SLOW_MULTIPLIER);
          }
          if (hazard.type === 'wind') {
              const windBoost = entity.faction === Faction.Metal ? Math.max(WIND_SPEED_MULTIPLIER, 2) : WIND_SPEED_MULTIPLIER;
              entity.statusEffects.speedBoost = Math.max(entity.statusEffects.speedBoost, windBoost);
              entity.statusEffects.speedBoostTimer = Math.max(entity.statusEffects.speedBoostTimer, 0.3);
              if (hazard.direction) {
                  const push = 20 * dt;
                  entity.velocity.x += hazard.direction.x * push;
                  entity.velocity.y += hazard.direction.y * push;
              }
          }
          if (hazard.type === 'mushroom' && entity.teleportCooldown <= 0) {
              entity.position = randomPosInZone(Faction.Wood);
              entity.teleportCooldown = MUSHROOM_COOLDOWN;
              newState.floatingTexts.push(createFloatingText(entity.position, "WARP!", '#a855f7', 16));
          }
          if (hazard.type === 'spear' && hazard.timer <= 0 && entity.faction !== Faction.Metal) {
              entity.currentHealth -= SPEAR_DAMAGE;
              hazard.timer = SPEAR_COOLDOWN;
              newState.floatingTexts.push(createFloatingText(entity.position, `-${SPEAR_DAMAGE}`, '#f97316', 14));
          }
      });

      newState.landmarks.forEach(landmark => {
          const inLandmark = distSq(entity.position, landmark.position) <= landmark.radius * landmark.radius;
          if (!inLandmark) {
              if (entity.landmarkId === landmark.id) {
                  entity.landmarkId = null;
                  entity.landmarkCharge = 0;
              }
              return;
          }

          if (landmark.type === 'fire_furnace') {
              entity.statusEffects.damageBoost = Math.max(entity.statusEffects.damageBoost, 1.1);
              entity.statusEffects.damageBoostTimer = Math.max(entity.statusEffects.damageBoostTimer, 0.6);
          }

          if (landmark.type === 'wood_tree') {
              entity.currentHealth = Math.min(entity.maxHealth, entity.currentHealth + 3 * dt);
          }

          if (landmark.type === 'water_statue') {
              if (entity.landmarkId !== landmark.id) {
                  entity.landmarkId = landmark.id;
                  entity.landmarkCharge = 0;
              }
              entity.landmarkCharge += dt;
              if (entity.landmarkCharge >= 3) {
                  entity.statusEffects.shieldTimer = Math.max(entity.statusEffects.shieldTimer, 3);
                  entity.landmarkCharge = 0;
              }
          }

          if (landmark.type === 'metal_altar' && entity.landmarkCooldown <= 0 && entity.stationaryTime > 2) {
              entity.statusEffects.damageBoost = Math.max(entity.statusEffects.damageBoost, 1.2);
              entity.statusEffects.damageBoostTimer = Math.max(entity.statusEffects.damageBoostTimer, 15);
              entity.statusEffects.rooted = Math.max(entity.statusEffects.rooted, 2);
              entity.landmarkCooldown = 10;
          }

          if (landmark.type === 'earth_pyramid' && entity.landmarkCooldown <= 0 && entity.stationaryTime > 2) {
              entity.statusEffects.visionBoost = Math.max(entity.statusEffects.visionBoost, 2);
              entity.statusEffects.visionBoostTimer = Math.max(entity.statusEffects.visionBoostTimer, 10);
              entity.statusEffects.speedBoost = Math.min(entity.statusEffects.speedBoost, 0.7);
              entity.statusEffects.speedBoostTimer = Math.max(entity.statusEffects.speedBoostTimer, 3);
              entity.landmarkCooldown = 12;
          }
      });

      if (entity.magneticFieldRadius > 0) {
          const neighbors = spatialGrid.getNearby(entity);
          neighbors.forEach(neighbor => {
              if (!('faction' in neighbor) || neighbor.id === entity.id) return;
              const other = neighbor as Player | Bot;
              if (other.isDead) return;
              const dSq = distSq(entity.position, other.position);
              if (dSq < entity.magneticFieldRadius * entity.magneticFieldRadius && other.radius < entity.radius * 0.9) {
                  const angle = Math.atan2(other.position.y - entity.position.y, other.position.x - entity.position.x);
                  other.velocity.x += Math.cos(angle) * 8;
                  other.velocity.y += Math.sin(angle) * 8;
              }
          });
      }

      const distCenterSq = Math.pow(entity.position.x - WORLD_WIDTH/2, 2) + Math.pow(entity.position.y - WORLD_HEIGHT/2, 2);
      if (distCenterSq > newState.zoneRadius * newState.zoneRadius) {
        const zoneDamage = newState.currentRound >= 4 ? 20 : newState.currentRound >= 3 ? 12 : newState.currentRound >= 2 ? 8 : 5;
        entity.currentHealth -= zoneDamage * dt; 
        if (entity.currentHealth <= 0) entity.isDead = true;
      } else {
          if (entity.currentHealth < entity.maxHealth) {
              entity.currentHealth += 1 * dt;
          }
      }
  });

  // --- 2.5 Lava Zones ---
  if (!newState.lavaZones) newState.lavaZones = [];
  for (let i = newState.lavaZones.length - 1; i >= 0; i--) {
      const zone = newState.lavaZones[i];
      zone.life -= dt;
      
      // Lava Damage
      entities.forEach(e => {
          if (!e.isDead && !e.statusEffects.airborne && e.id !== zone.ownerId && distSq(e.position, zone.position) < zone.radius * zone.radius) {
              e.currentHealth -= zone.damage * dt;
              if (!e.statusEffects.burning) e.statusEffects.burning = true;
          }
      });

      if (zone.life <= 0) newState.lavaZones.splice(i, 1);
  }


  // --- 3. Projectiles ---
  newState.projectiles.forEach(proj => {
      proj.position.x += proj.velocity.x * dt * 10; 
      proj.position.y += proj.velocity.y * dt * 10;
      proj.duration -= dt;
      if (proj.duration <= 0) proj.isDead = true;
      
      newState.particles.push(createParticle(proj.position.x, proj.position.y, proj.color, 2));

      entities.forEach(target => {
          if (target.id === proj.ownerId || target.isDead || target.isInvulnerable || target.statusEffects.airborne || target.statusEffects.invulnerable > 0) return;
          const dSq = distSq(proj.position, target.position);
          if (dSq < target.radius * target.radius) {
              proj.isDead = true;
              applyProjectileEffect(proj, target, newState);
          }
      });
  });
  newState.projectiles = newState.projectiles.filter(p => !p.isDead);

  // --- 4. Collision & Consumption (OPTIMIZED) ---
  entities.forEach(entity => {
    if (entity.isDead || entity.statusEffects.airborne) return;
    const rSq = entity.radius * entity.radius;

    const neighbors = spatialGrid.getNearby(entity);
    
    for(const neighbor of neighbors) {
        if (neighbor.id === entity.id) continue;
        if (neighbor.isDead) continue;
        
        if ('value' in neighbor) { 
             const f = neighbor as Food;
             if (f.isDead) continue; 
             
             if (f.isEjected) {
                 f.position.x += f.velocity.x * dt * 10;
                 f.position.y += f.velocity.y * dt * 10;
                 f.velocity.x *= 0.90;
                 f.velocity.y *= 0.90;
             }

             const dSq = distSq(entity.position, f.position);
             if (dSq < rSq) {
                 f.isDead = true; 
                 if (f.kind === 'relic') {
                     entity.radius += RELIC_GROWTH;
                     entity.score += RELIC_VALUE * 2;
                     entity.currentHealth = Math.min(entity.maxHealth, entity.currentHealth + RELIC_HEAL);
                     entity.statusEffects.regen += RELIC_REGEN;
                     newState.floatingTexts.push(createFloatingText(entity.position, "RELIC!", '#facc15', 24));
                     newState.relicId = null;
                 } else {
                     const growth = f.value * 0.15;
                     entity.radius += growth;
                     entity.score += f.value;
                     if (entity.id === 'player') audioManager.playEat();
                     if (f.value > 2) newState.floatingTexts.push(createFloatingText(entity.position, `+${f.value}`, '#4ade80', 16));
                 }
             }
        } 
        else if ('type' in neighbor && !('faction' in neighbor)) {
             const powerUp = neighbor as PowerUp;
             if (powerUp.isDead) continue;
             const dSq = distSq(entity.position, powerUp.position);
             if (dSq < rSq) {
                 powerUp.isDead = true;
                 applyPowerUpEffect(entity, powerUp, newState);
             }
        }
        else if ('faction' in neighbor) {
             const other = neighbor as Player | Bot;
             if (other.isDead || other.isInvulnerable || other.statusEffects.airborne || other.statusEffects.invulnerable > 0) continue;
             if (entity.isInvulnerable || entity.statusEffects.invulnerable > 0) continue;

             const dSq = distSq(entity.position, other.position);
             const minDist = entity.radius + other.radius;
             
             if (dSq < minDist * minDist * 0.9) {
                const ratio = entity.radius / other.radius;
                const charging = entity.faction === Faction.Metal && entity.statusEffects.speedBoost > 1.5;
                const otherCharging = other.faction === Faction.Metal && other.statusEffects.speedBoost > 1.5;
                
                if (ratio >= DANGER_THRESHOLD_RATIO && !other.statusEffects.shielded && !otherCharging) {
                    consume(entity, other, newState);
                } else if (ratio <= EAT_THRESHOLD_RATIO && !entity.statusEffects.shielded && !charging) {
                   // handled by other loop
                } 
                else {
                    resolveCombat(entity, other, dt, newState, charging, otherCharging);
                }
             }
        }
    }
  });

  entities.forEach(entity => {
      if (!entity.isDead && entity.currentHealth <= 0) {
          if (!tryRevive(entity, newState)) entity.isDead = true;
      }
  });

  // Cleanup dead food efficiently
  let writeIdx = 0;
  for (let i = 0; i < newState.food.length; i++) {
      if (!newState.food[i].isDead) {
          newState.food[writeIdx++] = newState.food[i];
      }
  }
  newState.food.length = writeIdx;
  
  while (newState.food.length < FOOD_COUNT) {
    newState.food.push(createFood());
  }

  newState.powerUps = newState.powerUps.filter(p => !p.isDead);
  newState.creeps = newState.creeps.filter(c => !c.isDead);
  if (newState.boss && newState.boss.isDead) newState.boss = null;

  // --- 5. Polish (Particles & Text) ---
  for (let i = newState.particles.length - 1; i >= 0; i--) {
      const p = newState.particles[i];
      p.position.x += p.velocity.x;
      p.position.y += p.velocity.y;
      p.life -= 0.05;
      if (p.life <= 0) {
          p.isDead = true;
          particlePool.release(p);
          newState.particles.splice(i, 1);
      }
  }

  newState.floatingTexts.forEach(t => {
      t.position.x += t.velocity.x;
      t.position.y += t.velocity.y;
      t.life -= 0.02;
  });
  newState.floatingTexts = newState.floatingTexts.filter(t => t.life > 0);

  // Camera Logic (Smoother & Faster Tracking)
  if (!newState.player.isDead) {
    const camSpeed = 0.15; // Increased from 0.1 for tighter tracking
    const lookAheadX = newState.player.velocity.x * 25; // Look ahead more
    const lookAheadY = newState.player.velocity.y * 25;
    
    const shakeX = (Math.random() - 0.5) * newState.shakeIntensity * 20;
    const shakeY = (Math.random() - 0.5) * newState.shakeIntensity * 20;

    const targetCamX = newState.player.position.x + lookAheadX;
    const targetCamY = newState.player.position.y + lookAheadY;

    newState.camera.x = newState.camera.x * (1-camSpeed) + targetCamX * camSpeed + shakeX;
    newState.camera.y = newState.camera.y * (1-camSpeed) + targetCamY * camSpeed + shakeY;
  }

  return newState;
};

// --- Sub-Systems (Keep existing implementation but ensure optimized access) ---

const performDash = (caster: Player | Bot, state: GameState) => {
    const angle = Math.atan2(caster.velocity.y, caster.velocity.x);
    const dashPower = 30 * caster.skillDashMultiplier;
    caster.velocity.x += Math.cos(angle) * dashPower; 
    caster.velocity.y += Math.sin(angle) * dashPower;
    caster.statusEffects.speedBoost = 2.5; 
    
    for(let j=0; j<10; j++) {
      state.particles.push(createParticle(caster.position.x, caster.position.y, '#e2e8f0', 8));
    }

    const neighbors = spatialGrid.getNearby(caster);
    neighbors.forEach(e => {
        if ('faction' in e && e.id !== caster.id && !e.isDead && distSq(caster.position, e.position) < (caster.radius*2)**2) {
            const victim = e as Player | Bot;
            const damage = 10 * caster.skillPowerMultiplier;
            victim.currentHealth -= damage;
            state.floatingTexts.push(createFloatingText(victim.position, `-${Math.floor(damage)}`, '#3b82f6', 16));
        }
    });
};

const executeDelayedAction = (action: DelayedAction, state: GameState) => {
    const caster = action.ownerId === 'player' ? state.player : state.bots.find(b => b.id === action.ownerId);
    if (!caster || caster.isDead) return;

    if (action.type === 'metal_dash') {
        performDash(caster, state);
        audioManager.playSkill();
    }
    else if (action.type === 'water_shot') {
        const { angleOffset } = action.data;
        const currentAngle = Math.atan2(caster.velocity.y, caster.velocity.x);
        const finalAngle = currentAngle + angleOffset;
        
        const iceProj = createProjectile(caster, 'ice');
        const speed = 20;
        iceProj.velocity = { x: Math.cos(finalAngle) * speed, y: Math.sin(finalAngle) * speed };
        state.projectiles.push(iceProj);
    }
    else if (action.type === 'fire_land') {
        caster.statusEffects.airborne = false;
        state.particles.push(createParticle(caster.position.x, caster.position.y, '#f97316', 15));
        
        const impactRadius = caster.radius * 3 * caster.skillDashMultiplier;
        
        const neighbors = spatialGrid.getNearby(caster);
        neighbors.forEach(e => {
            if ('faction' in e && e.id !== caster.id && !e.isDead && distSq(caster.position, e.position) < impactRadius**2) {
                const victim = e as Player | Bot;
                const damage = 25 * caster.damageMultiplier * caster.skillPowerMultiplier / victim.defense;
                victim.currentHealth -= damage;
                victim.statusEffects.burnTimer = Math.max(victim.statusEffects.burnTimer, 3);
                
                const pushAngle = Math.atan2(victim.position.y - caster.position.y, victim.position.x - caster.position.x);
                victim.velocity.x += Math.cos(pushAngle) * 30;
                victim.velocity.y += Math.sin(pushAngle) * 30;
                
                state.floatingTexts.push(createFloatingText(victim.position, `-${Math.floor(damage)}`, '#ef4444', 20));
            }
        });

        if (!state.lavaZones) state.lavaZones = [];
        state.lavaZones.push({
            id: Math.random().toString(),
            position: { ...caster.position },
            radius: caster.radius * 2 * caster.skillDashMultiplier,
            damage: 20 * caster.damageMultiplier * caster.skillPowerMultiplier,
            ownerId: caster.id,
            life: 5.0
        });
        
        if (caster.id === 'player') state.shakeIntensity = 1.0;
    }
    else if (action.type === 'double_cast') {
        castSkill(caster, state, 0, true);
    }
}

const castSkill = (caster: Player | Bot, state: GameState, dt: number, triggeredByDouble: boolean = false) => {
    if (!triggeredByDouble) {
        caster.skillCooldown = Math.max(0.5, caster.maxSkillCooldown * caster.skillCooldownMultiplier);
        audioManager.playSkill();
        state.floatingTexts.push(createFloatingText(caster.position, "SKILL!", '#fbbf24', 24));
    }

    if (!state.delayedActions) state.delayedActions = [];

    if (!triggeredByDouble && caster.doubleCast) {
        state.delayedActions.push({ id: Math.random().toString(), type: 'double_cast', timer: 0.25, ownerId: caster.id });
    }

    if (!triggeredByDouble && caster.mutations.includes('speed_surge') && caster.mutationCooldowns.speedSurge <= 0) {
        caster.statusEffects.speedSurge = 5;
        caster.mutationCooldowns.speedSurge = 30;
    }

    if (!triggeredByDouble && caster.mutations.includes('invulnerable') && caster.mutationCooldowns.invulnerable <= 0) {
        caster.statusEffects.invulnerable = 3;
        caster.mutationCooldowns.invulnerable = 30;
    }

    if (!triggeredByDouble && caster.mutations.includes('king_form') && caster.mutationCooldowns.kingForm <= 0) {
        caster.statusEffects.kingForm = 15;
        caster.statusEffects.damageBoost = Math.max(caster.statusEffects.damageBoost, 1.3);
        caster.statusEffects.defenseBoost = Math.max(caster.statusEffects.defenseBoost, 1.2);
        caster.statusEffects.damageBoostTimer = Math.max(caster.statusEffects.damageBoostTimer, 15);
        caster.statusEffects.defenseBoostTimer = Math.max(caster.statusEffects.defenseBoostTimer, 15);
        caster.mutationCooldowns.kingForm = 40;
    }

    if (!triggeredByDouble && caster.mutations.includes('chaos_swap') && caster.mutationCooldowns.chaos <= 0) {
        const targets = [state.player, ...state.bots].filter(t => t.id !== caster.id && !t.isDead);
        if (targets.length) {
            const target = targets[Math.floor(Math.random() * targets.length)];
            const tmp = caster.radius;
            caster.radius = target.radius;
            target.radius = tmp;
            state.floatingTexts.push(createFloatingText(caster.position, "SWAP!", '#f59e0b', 18));
        }
        caster.mutationCooldowns.chaos = 25;
    }

    if (!triggeredByDouble && caster.mutations.includes('thunder_call') && caster.mutationCooldowns.lightning <= 0) {
        const targets = [state.player, ...state.bots].filter(t => t.id !== caster.id && !t.isDead);
        const nearest = targets.sort((a, b) => distSq(a.position, caster.position) - distSq(b.position, caster.position)).slice(0, 3);
        nearest.forEach(target => {
            state.hazards.push(createHazard('lightning', { ...target.position }, LIGHTNING_RADIUS, LIGHTNING_WARNING_TIME, 0.4));
        });
        caster.mutationCooldowns.lightning = 25;
    }

    switch(caster.faction) {
        case Faction.Metal: 
            performDash(caster, state);
            if (caster.tier === SizeTier.AncientKing) {
                state.delayedActions.push({ id: Math.random().toString(), type: 'metal_dash', timer: 0.2, ownerId: caster.id });
                state.delayedActions.push({ id: Math.random().toString(), type: 'metal_dash', timer: 0.4, ownerId: caster.id });
            }
            break;

        case Faction.Wood: 
            const web = createProjectile(caster, 'web');
            state.projectiles.push(web);
            break;

        case Faction.Water: 
            state.projectiles.push(createProjectile(caster, 'ice'));
            state.delayedActions.push({ id: Math.random().toString(), type: 'water_shot', timer: 0.1, ownerId: caster.id, data: { angleOffset: -0.3 } });
            state.delayedActions.push({ id: Math.random().toString(), type: 'water_shot', timer: 0.2, ownerId: caster.id, data: { angleOffset: 0.3 } });
            break;

        case Faction.Earth: 
            caster.statusEffects.shieldTimer = Math.max(caster.statusEffects.shieldTimer, 3);
            for(let i=0;i<15;i++) state.particles.push(createParticle(caster.position.x, caster.position.y, '#fde047', 10));
            break;
            
        case Faction.Fire: 
            caster.statusEffects.airborne = true;
            state.floatingTexts.push(createFloatingText(caster.position, "JUMP!", '#ea580c', 20));
            state.delayedActions.push({ id: Math.random().toString(), type: 'fire_land', timer: 0.6, ownerId: caster.id });
            break;
    }
};

const applyProjectileEffect = (proj: Projectile, target: Player | Bot, state: GameState) => {
    if (target.statusEffects.shielded) {
        state.floatingTexts.push(createFloatingText(target.position, "BLOCK", '#fde047', 18));
        for(let k=0;k<5;k++) state.particles.push(createParticle(proj.position.x, proj.position.y, '#fff', 5));
        
        const owner = state.player.id === proj.ownerId ? state.player : state.bots.find(b => b.id === proj.ownerId);
        if (target.faction === Faction.Earth && target.tier === SizeTier.AncientKing && owner) {
             owner.statusEffects.poisonTimer = Math.max(owner.statusEffects.poisonTimer, 3);
             state.floatingTexts.push(createFloatingText(owner.position, "REFLECT POISON!", '#84cc16', 16));
        }
        return; 
    }

    const owner = state.player.id === proj.ownerId ? state.player : state.bots.find(b => b.id === proj.ownerId);
    const isTargetKing = target.id === state.kingId;
    const isOwnerKing = owner?.id === state.kingId;
    const armorPen = owner ? owner.armorPen : 0;
    const effectiveDefense = Math.max(0.1, target.defense * target.statusEffects.defenseBoost * (1 - armorPen));
    let damageDealt = proj.damage / effectiveDefense;
    if (owner) damageDealt *= owner.statusEffects.damageBoost;

    if (owner) {
        const critRoll = owner.statusEffects.critCharges > 0 || Math.random() < owner.critChance;
        if (critRoll) {
            damageDealt *= owner.critMultiplier;
            if (owner.statusEffects.critCharges > 0) owner.statusEffects.critCharges -= 1;
            state.floatingTexts.push(createFloatingText(target.position, "CRIT!", '#facc15', 14));
        }
    }
    if (isTargetKing) damageDealt *= KING_DAMAGE_TAKEN_MULTIPLIER;
    if (isOwnerKing) damageDealt *= KING_DAMAGE_DEALT_MULTIPLIER;
    target.currentHealth -= damageDealt;
    target.statusEffects.stealthed = false;
    target.statusEffects.stealthCharge = 0;
    
    state.floatingTexts.push(createFloatingText(target.position, `-${Math.floor(damageDealt)}`, '#93c5fd', 18));
    for(let k=0;k<5;k++) state.particles.push(createParticle(target.position.x, target.position.y, proj.color));

    if (owner && owner.lifesteal > 0) {
        owner.currentHealth = Math.min(owner.maxHealth, owner.currentHealth + damageDealt * owner.lifesteal);
    }
    if (owner && target.reflectDamage > 0) {
        owner.currentHealth -= damageDealt * target.reflectDamage;
    }

    if (owner && owner.poisonOnHit) {
        target.statusEffects.poisonTimer = Math.max(target.statusEffects.poisonTimer, 3);
    }

    if (proj.type === 'ice') {
        target.statusEffects.slowTimer = Math.max(target.statusEffects.slowTimer, 3);
        target.statusEffects.slowMultiplier = Math.min(target.statusEffects.slowMultiplier, 0.5);
        state.floatingTexts.push(createFloatingText(target.position, "SLOW", '#bae6fd', 16));
    } 
    else if (proj.type === 'web') {
        target.velocity.x *= 0.1;
        target.velocity.y *= 0.1;
        state.floatingTexts.push(createFloatingText(target.position, "ROOT", '#4ade80', 16));
        
        if (owner) {
            const pullAngle = Math.atan2(owner.position.y - target.position.y, owner.position.x - target.position.x);
            target.velocity.x += Math.cos(pullAngle) * 35; 
            target.velocity.y += Math.sin(pullAngle) * 35;
            
            owner.statusEffects.regen += 20; 
            owner.currentHealth = Math.min(owner.maxHealth, owner.currentHealth + 10);
            state.floatingTexts.push(createFloatingText(owner.position, "+HP", '#4ade80', 14));
            
            target.statusEffects.poisonTimer = Math.max(target.statusEffects.poisonTimer, 3);
        }
    }
};

const consume = (predator: Player | Bot, prey: Player | Bot, state: GameState) => {
    if (prey.reviveAvailable) {
        prey.reviveAvailable = false;
        prey.currentHealth = 1;
        prey.isDead = false;
        state.floatingTexts.push(createFloatingText(prey.position, "SURVIVE!", '#fef08a', 18));
        return;
    }
    prey.isDead = true;
    const gain = prey.radius * 0.3 * predator.killGrowthMultiplier; 
    predator.radius += gain;
    predator.kills++;
    predator.score += prey.radius * 10;
    predator.currentHealth = Math.min(predator.maxHealth, predator.currentHealth + 40);

    if (prey.id === state.kingId) {
        predator.score += KING_BOUNTY_SCORE;
        predator.radius += KING_BOUNTY_RADIUS;
        state.floatingTexts.push(createFloatingText(predator.position, "KING SLAYER!", '#f59e0b', 26));
    }

    if ((prey as Bot).isElite && !(predator as Bot).isCreep) {
        const choices = getMutationChoices(new Set(predator.mutations), predator.tier, 1);
        if (choices[0]) {
            applyMutation(predator, choices[0].id);
            state.floatingTexts.push(createFloatingText(predator.position, choices[0].name, '#60a5fa', 16));
        }
    }

    if ((prey as Bot).isBoss) {
        state.powerUps.push(createPowerUp('legendary_orb', { ...prey.position }));
    }
    
    state.floatingTexts.push(createFloatingText(predator.position, "DEVOUR!", '#ef4444', 30));
    if (predator.id === 'player') state.shakeIntensity = 0.8;

    for(let k=0; k<25; k++) {
        state.particles.push(createParticle(prey.position.x, prey.position.y, prey.color, 12));
    }
    if (predator.id === 'player') audioManager.playKill();
};

const resolveCombat = (e1: Player | Bot, e2: Player | Bot, dt: number, state: GameState, c1: boolean, c2: boolean) => {
    const angle = Math.atan2(e2.position.y - e1.position.y, e2.position.x - e1.position.x);
    const pushForce = 12; 
    e1.velocity.x -= Math.cos(angle) * pushForce;
    e1.velocity.y -= Math.sin(angle) * pushForce;
    e2.velocity.x += Math.cos(angle) * pushForce;
    e2.velocity.y += Math.sin(angle) * pushForce;

    const e1CountersE2 = ELEMENTAL_ADVANTAGE[e1.faction] === e2.faction;
    const e2CountersE1 = ELEMENTAL_ADVANTAGE[e2.faction] === e1.faction;
    const e1Shield = e1.statusEffects.shielded;
    const e2Shield = e2.statusEffects.shielded;

    const baseDmg = 5.0 * dt;
    const e1Defense = Math.max(0.1, e1.defense * e1.statusEffects.defenseBoost * (1 - e2.armorPen));
    const e2Defense = Math.max(0.1, e2.defense * e2.statusEffects.defenseBoost * (1 - e1.armorPen));
    const e1Attack = e1.damageMultiplier * e1.statusEffects.damageBoost;
    const e2Attack = e2.damageMultiplier * e2.statusEffects.damageBoost;

    let e1Dmg = baseDmg * (e2Attack / e1Defense); 
    let e2Dmg = baseDmg * (e1Attack / e2Defense); 

    if (e1.statusEffects.critCharges > 0 || Math.random() < e1.critChance) {
        e2Dmg *= e1.critMultiplier;
        if (e1.statusEffects.critCharges > 0) e1.statusEffects.critCharges -= 1;
        state.floatingTexts.push(createFloatingText(e2.position, "CRIT!", '#facc15', 12));
    }
    if (e2.statusEffects.critCharges > 0 || Math.random() < e2.critChance) {
        e1Dmg *= e2.critMultiplier;
        if (e2.statusEffects.critCharges > 0) e2.statusEffects.critCharges -= 1;
        state.floatingTexts.push(createFloatingText(e1.position, "CRIT!", '#facc15', 12));
    }

    if (e1CountersE2) e2Dmg *= 3;
    else if (e2CountersE1) e1Dmg *= 3;

    if (c1) e2Dmg += 20 * (1 / e2.defense); 
    if (c2) e1Dmg += 20 * (1 / e1.defense);

    const e1IsKing = e1.id === state.kingId;
    const e2IsKing = e2.id === state.kingId;
    if (e1IsKing) {
        e1Dmg *= KING_DAMAGE_TAKEN_MULTIPLIER;
        e2Dmg *= KING_DAMAGE_DEALT_MULTIPLIER;
    }
    if (e2IsKing) {
        e2Dmg *= KING_DAMAGE_TAKEN_MULTIPLIER;
        e1Dmg *= KING_DAMAGE_DEALT_MULTIPLIER;
    }

    if (e1.statusEffects.invulnerable > 0) e1Dmg = 0;
    if (e2.statusEffects.invulnerable > 0) e2Dmg = 0;

    if (e1Shield) { 
        e1Dmg = 0; 
        if (e1.faction === Faction.Earth) {
            e2Dmg += 2 * e1.damageMultiplier;
            if (e1.tier === SizeTier.AncientKing && e2.statusEffects.poisonTimer <= 0) {
                e2.statusEffects.poisonTimer = 3;
                state.floatingTexts.push(createFloatingText(e2.position, "POISONED!", '#84cc16', 16));
            }
        }
        if (Math.random() < 0.1) state.floatingTexts.push(createFloatingText(e1.position, "BLOCK", '#fde047', 14));
    } 
    if (e2Shield) { 
        e2Dmg = 0; 
        if (e2.faction === Faction.Earth) {
            e1Dmg += 2 * e2.damageMultiplier;
             if (e2.tier === SizeTier.AncientKing && e1.statusEffects.poisonTimer <= 0) {
                e1.statusEffects.poisonTimer = 3;
                state.floatingTexts.push(createFloatingText(e1.position, "POISONED!", '#84cc16', 16));
            }
        }
        if (Math.random() < 0.1) state.floatingTexts.push(createFloatingText(e2.position, "BLOCK", '#fde047', 14));
    }

    e1.currentHealth -= e1Dmg;
    e2.currentHealth -= e2Dmg;

    if (e1.faction === Faction.Fire) {
        e2.statusEffects.burnTimer = Math.max(e2.statusEffects.burnTimer, 3);
        e1.statusEffects.regen = Math.max(e1.statusEffects.regen, 2);
    }
    if (e2.faction === Faction.Fire) {
        e1.statusEffects.burnTimer = Math.max(e1.statusEffects.burnTimer, 3);
        e2.statusEffects.regen = Math.max(e2.statusEffects.regen, 2);
    }

    e1.statusEffects.stealthed = false;
    e2.statusEffects.stealthed = false;
    e1.statusEffects.stealthCharge = 0;
    e2.statusEffects.stealthCharge = 0;

    if (e1.lifesteal > 0) e1.currentHealth = Math.min(e1.maxHealth, e1.currentHealth + e2Dmg * e1.lifesteal);
    if (e2.lifesteal > 0) e2.currentHealth = Math.min(e2.maxHealth, e2.currentHealth + e1Dmg * e2.lifesteal);

    if (e2.reflectDamage > 0) e1.currentHealth -= e2Dmg * e2.reflectDamage;
    if (e1.reflectDamage > 0) e2.currentHealth -= e1Dmg * e1.reflectDamage;

    if (e1.poisonOnHit) e2.statusEffects.poisonTimer = Math.max(e2.statusEffects.poisonTimer, 3);
    if (e2.poisonOnHit) e1.statusEffects.poisonTimer = Math.max(e1.statusEffects.poisonTimer, 3);

    if (Math.random() < 0.1 && e1Dmg > 1) state.floatingTexts.push(createFloatingText(e1.position, Math.floor(e1Dmg).toString(), '#fff', 12));
    if (Math.random() < 0.1 && e2Dmg > 1) state.floatingTexts.push(createFloatingText(e2.position, Math.floor(e2Dmg).toString(), '#fff', 12));

    if (Math.random() > 0.3) state.particles.push(createParticle((e1.position.x+e2.position.x)/2, (e1.position.y+e2.position.y)/2, '#fff', 5));

    if (e1.currentHealth <= 0) consume(e2, e1, state);
    else if (e2.currentHealth <= 0) consume(e1, e2, state);
};

const updateBotAI = (bot: Bot, state: GameState, dt: number, currentZone: Faction | 'Center') => {
    bot.aiReactionTimer += dt;
    if (bot.aiReactionTimer < 0.1) { 
        applyPhysics(bot, bot.targetPosition, dt, currentZone);
        return; 
    }
    bot.aiReactionTimer = 0;

    let target = bot.targetPosition;
    let closestThreat: Entity | null = null;
    let closestFood: Entity | null = null;
    let closestPrey: Entity | null = null;
    let minDistSq = Infinity;

    const scanRadiusSq = 500 * 500;
    const neighbors = spatialGrid.getNearby(bot);
    
    neighbors.forEach(e => {
        if (e.id === bot.id || e.isDead) return;

        const isInvulnerable = 'isInvulnerable' in e ? (e as Player).isInvulnerable : false;
        if (isInvulnerable) return;
        
        if ('value' in e) {
             const dSq = distSq(bot.position, e.position);
             if (dSq < minDistSq) {
                 minDistSq = dSq;
                 closestFood = e as Food;
             }
             return;
        }

        if (!('faction' in e)) return;
        const entity = e as Player | Bot;
        
        const dSq = distSq(bot.position, entity.position);
        if (dSq > scanRadiusSq) return;

        const ratio = entity.radius / bot.radius;
        const ICounterThem = ELEMENTAL_ADVANTAGE[bot.faction] === entity.faction;
        const TheyCounterMe = ELEMENTAL_ADVANTAGE[entity.faction] === bot.faction;

        if (ratio >= DANGER_THRESHOLD_RATIO || (ratio > 0.9 && TheyCounterMe)) {
            if (!closestThreat || dSq < distSq(bot.position, closestThreat.position)) closestThreat = entity;
        } 
        else if (ratio <= EAT_THRESHOLD_RATIO || (ratio < 1.1 && ICounterThem)) {
            if (!closestPrey || dSq < distSq(bot.position, closestPrey.position)) closestPrey = entity;
        }
    });

    if (closestThreat) {
        bot.aiState = 'flee';
        const dx = bot.position.x - closestThreat.position.x;
        const dy = bot.position.y - closestThreat.position.y;
        target = { x: bot.position.x + dx, y: bot.position.y + dy };
        if (bot.skillCooldown <= 0 && distSq(bot.position, closestThreat.position) < 300*300) castSkill(bot, state, dt);
    } 
    else if (closestPrey) {
        bot.aiState = 'chase';
        target = { 
            x: closestPrey.position.x + closestPrey.velocity.x * 10, 
            y: closestPrey.position.y + closestPrey.velocity.y * 10 
        };
        if (bot.skillCooldown <= 0 && distSq(bot.position, closestPrey.position) < 400*400) castSkill(bot, state, dt);
    } 
    else if (closestFood) {
        bot.aiState = 'chase';
        target = closestFood.position;
    } 
    else {
        if (Math.random() < 0.2) {
             const homeCenter = getZoneCenter(bot.faction);
             const biasStrength = 0.3; 
             const randomX = bot.position.x + randomRange(-400, 400);
             const randomY = bot.position.y + randomRange(-400, 400);
             
             target = {
                 x: randomX * (1-biasStrength) + homeCenter.x * biasStrength,
                 y: randomY * (1-biasStrength) + homeCenter.y * biasStrength
             };
        }
    }
    
    const mapCenterX = WORLD_WIDTH / 2;
    const mapCenterY = WORLD_HEIGHT / 2;
    const distFromMapCenterSq = distSq(target, { x: mapCenterX, y: mapCenterY });
    
    if (distFromMapCenterSq > (state.zoneRadius * 0.9)**2) {
        target = { x: mapCenterX, y: mapCenterY };
    } else if (distFromMapCenterSq > (MAP_RADIUS * 0.9)**2) {
        target = { x: mapCenterX, y: mapCenterY };
    }

    bot.targetPosition = target;
    applyPhysics(bot, target, dt, currentZone);
}

const updateCreepAI = (creep: Bot, state: GameState, dt: number, currentZone: Faction | 'Center') => {
    creep.aiReactionTimer += dt;
    if (creep.aiReactionTimer < 0.2) { 
        applyPhysics(creep, creep.targetPosition, dt, currentZone);
        return; 
    }
    creep.aiReactionTimer = 0;

    let target = creep.targetPosition;
    let closestThreat: Entity | null = null;
    const neighbors = spatialGrid.getNearby(creep);

    neighbors.forEach(e => {
        if (!('faction' in e) || e.id === creep.id || e.isDead) return;
        const entity = e as Player | Bot;
        if (entity.isInvulnerable) return;
        const ratio = entity.radius / creep.radius;
        if (ratio >= 1.1 && distSq(creep.position, entity.position) < 250 * 250) {
            closestThreat = entity;
        }
    });

    if (closestThreat) {
        const dx = creep.position.x - closestThreat.position.x;
        const dy = creep.position.y - closestThreat.position.y;
        target = { x: creep.position.x + dx, y: creep.position.y + dy };
    } else if (Math.random() < 0.3) {
        const home = getZoneCenter(creep.faction);
        const randomX = creep.position.x + randomRange(-200, 200);
        const randomY = creep.position.y + randomRange(-200, 200);
        target = {
            x: randomX * 0.6 + home.x * 0.4,
            y: randomY * 0.6 + home.y * 0.4
        };
    }

    creep.targetPosition = target;
    applyPhysics(creep, target, dt, currentZone);
}

const updateBossAI = (boss: Bot, state: GameState, dt: number, currentZone: Faction | 'Center') => {
    if (!boss.bossAttackTimer) boss.bossAttackTimer = BOSS_ATTACK_INTERVAL;
    if (!boss.bossAttackCharge) boss.bossAttackCharge = 0;

    boss.bossAttackTimer -= dt;

    const targets = [state.player, ...state.bots].filter(t => !t.isDead);
    const nearest = targets.sort((a, b) => distSq(a.position, boss.position) - distSq(b.position, boss.position))[0];

    if (boss.bossAttackTimer <= 0) {
        boss.bossAttackCharge += dt;
        boss.statusEffects.rooted = Math.max(boss.statusEffects.rooted, 0.6);
        if (boss.bossAttackCharge >= 1) {
            const impactRadius = boss.radius * 2.2;
            targets.forEach(target => {
                if (distSq(target.position, boss.position) < impactRadius * impactRadius) {
                    if (target.statusEffects.invulnerable <= 0 && !target.isInvulnerable) {
                        target.currentHealth -= BOSS_DAMAGE * boss.damageMultiplier;
                        target.statusEffects.invulnerable = 0.8;
                        const pushAngle = Math.atan2(target.position.y - boss.position.y, target.position.x - boss.position.x);
                        target.velocity.x += Math.cos(pushAngle) * 18;
                        target.velocity.y += Math.sin(pushAngle) * 18;
                    }
                }
            });
            state.floatingTexts.push(createFloatingText(boss.position, "BOSS SLAM!", '#ef4444', 24));
            boss.bossAttackCharge = 0;
            boss.bossAttackTimer = BOSS_ATTACK_INTERVAL;
        }
        return;
    }

    if (nearest) {
        boss.targetPosition = {
            x: nearest.position.x,
            y: nearest.position.y
        };
        applyPhysics(boss, boss.targetPosition, dt, currentZone);
    }
}
