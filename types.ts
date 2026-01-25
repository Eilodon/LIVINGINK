import { PigmentVec3, RingId, Emotion, ShapeId, TattooId, PickupKind } from './services/cjr/cjrTypes';
import type { LevelConfig } from './services/cjr/levels';

export type { PigmentVec3, RingId, PickupKind };
export type { Emotion, ShapeId };
export { TattooId } from './services/cjr/cjrTypes';
export { TattooId as MutationId } from './services/cjr/cjrTypes'; // Keep alias for now if needed, but we are refactoring.

export enum GamePhase {
  Menu = 'MENU',
  Playing = 'PLAYING',
  GameOver = 'GAME_OVER',
}

// Retaining SizeTier for compatibility with physics engine scaling, but simplifying logic later
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
  color: string;  // CSS string for rendering (derived from pigment)
  isDead: boolean;
  trail: Vector2[];
}

export interface Projectile extends Entity {
  ownerId: string;
  damage: number;
  type: 'web' | 'ice' | 'sting'; // Keep for now as skill effects
  duration: number;
}

// Renamed from DelayedAction to generic SkillAction if needed, or keep for compatibility
export interface DelayedAction {
  id: string;
  type: 'dash' | 'blast' | 'shield'; // Simplified
  timer: number;
  ownerId: string;
  data?: any;
}

export interface Player extends Entity {
  name: string;
  score: number;
  kills: number;
  // Dopamine Stats
  killStreak: number;
  streakTimer: number; // Decays to 0
  maxHealth: number;
  currentHealth: number;
  tier: SizeTier;
  targetPosition: Vector2; // Mouse/Input target
  spawnTime: number;

  // CJR Core Fields
  pigment: PigmentVec3;
  targetPigment: PigmentVec3;
  matchPercent: number; // 0..1
  ring: RingId;
  emotion: Emotion;
  shape: ShapeId;
  tattoos: TattooId[];
  lastHitTime: number;
  lastEatTime: number;
  matchStuckTime: number;
  ring3LowMatchTime: number;
  emotionTimer: number;
  emotionOverride?: Emotion;

  // Physics Props
  acceleration: number;
  maxSpeed: number;
  friction: number;

  // Mechanics
  isInvulnerable: boolean;
  skillCooldown: number;
  maxSkillCooldown: number;
  inputs?: {
    space: boolean;
    w: boolean;
  };
  inputSeq?: number;

  // RPG Stats (Simplified)
  defense: number;
  damageMultiplier: number;

  // Tattoo Stats (formerly mutations, now consolidated)
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

  // Status Effects
  statusEffects: {
    speedBoost: number;
    tempSpeedBoost: number;
    tempSpeedTimer: number;
    shielded: boolean;
    burning: boolean;
    burnTimer: number;
    slowed: boolean;
    slowTimer: number;
    slowMultiplier: number;
    poisoned: boolean;
    poisonTimer: number;
    regen: number;
    airborne: boolean;
    stealthed: boolean;
    stealthCharge: number;
    invulnerable: number;
    rooted: number;
    speedSurge: number;
    kingForm: number;
    damageBoost: number;
    defenseBoost: number;
    // New CJR buffs
    commitShield?: number;
    pityBoost?: number;
    colorBoostTimer?: number;
    colorBoostMultiplier?: number;
    overdriveTimer?: number;
    magnetTimer?: number;
    // Tattoo Effects
    wrongPigmentReduction?: number;
    overdriveActive?: boolean;
    coreShieldBonus?: boolean;
    pigmentBombActive?: boolean;
    pigmentBombChance?: number;
    perfectMatchThreshold?: number;
    perfectMatchBonus?: number;
    catalystSenseRange?: number;
    catalystSenseActive?: boolean;
    neutralMassBonus?: number;
    solventPower?: number;
    solventSpeedBoost?: number;
    catalystEchoBonus?: number;
    catalystEchoDuration?: number;
    prismGuardThreshold?: number;
    prismGuardReduction?: number;
    grimHarvestDropCount?: number;

    // Tattoo Synergy Effects - Phase 2 Gameplay Depth
    neutralPurification?: boolean;
    purificationRadius?: number;
    overdriveExplosive?: boolean;
    explosiveSpeed?: number;
    explosionRadius?: number;
    goldenAttraction?: boolean;
    catalystAttractionRadius?: number;
    goldenMagneticForce?: number;
    elementalBalance?: boolean;
    solventShieldPower?: number;
    shieldSolventSynergy?: boolean;
    colorImmunity?: boolean;
    chromaticImmunityDuration?: number;
    catalystMasteryRadius?: number;
    catalystGuarantee?: boolean;
    neutralGodMode?: boolean;
    kineticExplosion?: boolean;
    explosionDamage?: number;
    shieldPiercing?: boolean;
    absoluteMastery?: boolean;
    colorControl?: number;
    temporalDistortion?: boolean;
    timeManipulation?: number;
    speedAmplifier?: number;
    explosionTimeDilation?: number;
  };
}

export interface Bot extends Player {
  aiState: 'wander' | 'chase' | 'flee' | 'forage';
  targetEntityId: string | null;
  aiReactionTimer: number;
  isCreep?: boolean;
  creepType?: string;
  isElite?: boolean;
  isBoss?: boolean;
  bossAttackTimer?: number;
  bossAttackCharge?: number;
  respawnTimer?: number;
  // CJR Bot Personality
  personality?: 'farmer' | 'hunter' | 'bully' | 'greedy' | 'trickster' | 'rubber';
}

export interface Food extends Entity {
  value: number;
  isEjected?: boolean;
  kind: PickupKind;       // CJR specific
  pigment?: PigmentVec3; // For pigment/candy_vein
}

export interface TattooChoice {
  id: TattooId;
  name: string;
  tier: MutationTier;
  description: string;
}

export interface MatchSummary {
  score: number;
  kills: number;
}

export interface PlayerProfile {
  gamesPlayed: number;
  totalKills: number;
  highScore: number;
  unlockedSkins: string[];
  unlockedTattoos: TattooId[];
  cosmetics?: {
    ownedSkins: string[];
    ownedTrails: string[];
    ownedAuras: string[];
    ownedBadges: string[];
    active: {
      skin?: string;
      trail?: string;
      aura?: string;
      badge?: string;
    };
  };
  quests?: {
    daily: Record<string, number>;
    weekly: Record<string, number>;
    lastReset: number;
  };
  guildId?: string | null;
  lastUpdated: number;
}

export interface Particle extends Entity {
  life: number;
  maxLife: number;
  style?: 'dot' | 'ring' | 'line';
  lineLength?: number;
  lineWidth?: number;
  angle?: number;

  // Synergy pattern effects
  isSynergyFusion?: boolean;
  fusionColor?: string;
  isSynergyExplosion?: boolean;
  explosionColor?: string;
  isSynergySpiral?: boolean;
  spiralColor?: string;
  isSynergyGeometric?: boolean;
  geometricSides?: number;
  geometricRadius?: number;
  rotationSpeed?: number;
  geometricColor?: string;

  // Additional synergy effects
  isSynergyEffect?: boolean;
  synergyColor?: string;
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

export interface WaveRuntimeState {
  ring1: number;
  ring2: number;
  ring3: number;
}

export interface BossRuntimeState {
  bossDefeated: boolean;
  rushWindowTimer: number;
  rushWindowRing: 2 | null;
  currentBossActive: boolean;
  attackCharging: boolean;
  attackTarget: Vector2 | null;
  attackChargeTimer: number;
}

export interface ContributionRuntimeState {
  damageLog: Map<string, number>;
  lastHitBy: Map<string, string>;
}

export interface GameRuntimeState {
  wave: WaveRuntimeState;
  boss: BossRuntimeState;
  contribution: ContributionRuntimeState;
}

// Forward declaration for engine
export interface IGameEngine {
  spatialGrid: any;
  particlePool: any;
}

export interface GameState {
  player: Player;
  players: Player[];
  bots: Bot[];
  creeps: Bot[];
  boss: Bot | null;
  food: Food[];
  // Removed PowerUps, Hazards, Landmarks lists
  particles: Particle[];
  projectiles: Projectile[];
  floatingTexts: FloatingText[];
  delayedActions: DelayedAction[];

  engine: IGameEngine;
  runtime: GameRuntimeState;

  worldSize: Vector2;
  zoneRadius: number; // Keep for compatibility, map to Ring
  gameTime: number;
  currentRound: number;
  camera: Vector2;
  shakeIntensity: number;
  kingId: string | null;
  level: number;
  levelConfig: LevelConfig;

  tattooChoices: TattooChoice[] | null;
  unlockedTattoos: TattooId[];
  isPaused: boolean;
  result: 'win' | 'lose' | null;

  inputs: {
    space: boolean;
    w: boolean;
  };
}
