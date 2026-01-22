export enum Faction {
  Metal = 'Kim',
  Wood = 'Moc',
  Water = 'Thuy',
  Fire = 'Hoa',
  Earth = 'Tho',
}

export enum GamePhase {
  Menu = 'MENU',
  Playing = 'PLAYING',
  GameOver = 'GAME_OVER',
}

export enum SizeTier {
  Larva = 'Ấu Trùng',      // 0-20%
  Juvenile = 'Thiếu Niên', // 20-40%
  Adult = 'Thanh Niên',    // 40-60%
  Elder = 'Trung Niên',    // 60-80%
  AncientKing = 'Cổ Vương' // 80-100%
}

export enum MutationTier {
  Common = 'Common',
  Rare = 'Rare',
  Epic = 'Epic',
  Legendary = 'Legendary',
}

export interface Vector2 {
  x: number;
  y: number;
}

export interface Entity {
  id: string;
  position: Vector2;
  velocity: Vector2;
  radius: number; // Represents Mass/Size
  color: string;
  isDead: boolean;
  trail: Vector2[]; // History of positions for rendering trails
}

export interface Projectile extends Entity {
  ownerId: string;
  damage: number;
  type: 'web' | 'ice' | 'sting'; // Skill types
  duration: number;
}

export interface LavaZone {
  id: string;
  position: Vector2;
  radius: number;
  damage: number;
  ownerId: string;
  life: number;
}

export interface DelayedAction {
  id: string;
  type: 'metal_dash' | 'water_shot' | 'fire_land' | 'double_cast';
  timer: number;
  ownerId: string;
  data?: any;
}

export interface Player extends Entity {
  faction: Faction;
  name: string;
  score: number;
  kills: number;
  maxHealth: number;
  currentHealth: number;
  tier: SizeTier;
  targetPosition: Vector2; // Mouse/Input target
  
  // Physics Props
  acceleration: number;
  maxSpeed: number;
  friction: number;

  // New Mechanics
  isInvulnerable: boolean;
  skillCooldown: number;
  maxSkillCooldown: number;

  // RPG Stats (Phase 1 Update)
  defense: number;
  damageMultiplier: number;

  // Mutation Stats
  mutations: string[];
  critChance: number;
  critMultiplier: number;
  lifesteal: number;
  armorPen: number;
  reflectDamage: number;
  visionMultiplier: number;
  sizePenaltyMultiplier: number;
  skillCooldownMultiplier: number;
  skillPowerMultiplier: number;
  skillDashMultiplier: number;
  killGrowthMultiplier: number;
  poisonOnHit: boolean;
  doubleCast: boolean;
  reviveAvailable: boolean;
  magneticFieldRadius: number;
  mutationCooldowns: {
    speedSurge: number;
    invulnerable: number;
    rewind: number;
    lightning: number;
    chaos: number;
    kingForm: number;
  };
  rewindHistory: { position: Vector2; health: number; time: number }[];
  stationaryTime: number;
  teleportCooldown: number;
  landmarkCharge: number;
  landmarkId: string | null;
  landmarkCooldown: number;
  
  // Status Effects
  statusEffects: {
    speedBoost: number; // Multiplier, 1 is normal
    shielded: boolean;
    burning: boolean;
    burnTimer: number;
    slowed: boolean;
    slowTimer: number;
    slowMultiplier: number;
    poisoned: boolean; // New: Earth Tier 5 / Wood Drain
    poisonTimer: number;
    regen: number; // New: HP per second
    airborne: boolean; // New: For Fire Jump
    stealthed: boolean;
    stealthCharge: number;
    invulnerable: number;
    rooted: number;
    speedSurge: number;
    kingForm: number;
    damageBoost: number;
    defenseBoost: number;
    damageBoostTimer: number;
    defenseBoostTimer: number;
    shieldTimer: number;
    speedBoostTimer: number;
    critCharges: number;
    visionBoost: number;
    visionBoostTimer: number;
  };
}

export interface Bot extends Player {
  aiState: 'wander' | 'chase' | 'flee';
  targetEntityId: string | null;
  aiReactionTimer: number; // Delay reaction slightly for realism
  isCreep?: boolean;
  creepType?: string;
  isElite?: boolean;
  isBoss?: boolean;
  bossAttackTimer?: number;
  bossAttackCharge?: number;
}

export interface Food extends Entity {
  value: number;
  isEjected?: boolean; // Created by player W key
  kind?: 'normal' | 'ejected' | 'relic';
}

export type PowerUpType =
  | 'fire_orb'
  | 'healing'
  | 'ice_heart'
  | 'sword_aura'
  | 'diamond_shield'
  | 'healing_fruit'
  | 'legendary_orb';

export interface PowerUp extends Entity {
  type: PowerUpType;
  duration: number;
}

export type HazardType =
  | 'lightning'
  | 'geyser'
  | 'icicle'
  | 'spear'
  | 'vines'
  | 'thin_ice'
  | 'wind'
  | 'mushroom';

export interface Hazard {
  id: string;
  type: HazardType;
  position: Vector2;
  radius: number;
  timer: number;
  duration: number;
  direction?: Vector2;
  active: boolean;
}

export type LandmarkType =
  | 'fire_furnace'
  | 'wood_tree'
  | 'water_statue'
  | 'metal_altar'
  | 'earth_pyramid';

export interface Landmark {
  id: string;
  type: LandmarkType;
  position: Vector2;
  radius: number;
  timer: number;
}

export interface MutationChoice {
  id: string;
  name: string;
  tier: MutationTier;
  description: string;
}

export interface Particle extends Entity {
  life: number;
  maxLife: number;
}

export interface FloatingText {
  id: string;
  position: Vector2;
  text: string;
  color: string;
  size: number;
  life: number;
  velocity: Vector2;
}

export interface GameState {
  player: Player;
  bots: Bot[];
  creeps: Bot[];
  boss: Bot | null;
  food: Food[];
  powerUps: PowerUp[];
  hazards: Hazard[];
  landmarks: Landmark[];
  particles: Particle[];
  projectiles: Projectile[];
  floatingTexts: FloatingText[];
  lavaZones: LavaZone[]; // New: Fire Skill
  delayedActions: DelayedAction[]; // New: Skill Queue
  
  worldSize: Vector2;
  zoneRadius: number; 
  gameTime: number;
  currentRound: number; // New: 1, 2, 3, 4 (Sudden Death)
  camera: Vector2;
  shakeIntensity: number; 
  kingId: string | null; 
  relicId: string | null;
  relicTimer: number;
  mutationChoices: MutationChoice[] | null;
  isPaused: boolean;
  hazardTimers: {
    lightning: number;
    geyser: number;
    icicle: number;
    powerUpFire: number;
    powerUpWood: number;
    powerUpWater: number;
    powerUpMetal: number;
    powerUpEarth: number;
    bossRespawn: number;
    creepRespawn: number;
    dustStorm: number;
    dustStormActive: boolean;
  };
  
  // Input State
  inputs: {
    space: boolean;
    w: boolean;
  };
}
