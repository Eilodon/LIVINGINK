// EIDOLON-V FIX: Unified Type System
// Single Source of Truth for all game types
// Eliminates circular dependencies and import hell

// ============================================
// CORE TYPES
// ============================================

export interface Vector2 {
  x: number;
  y: number;
}

export interface Vector3 {
  x: number;
  y: number;
  z: number;
}

export interface PigmentVec3 {
  r: number;
  g: number;
  b: number;
}

// ============================================
// GAME STATE TYPES
// ============================================

export interface GameState {
  player: Player;
  players: Player[];
  bots: Bot[];
  food: Food[];
  projectiles: Projectile[];
  particles: Particle[];
  floatingTexts: FloatingText[];
  delayedActions: DelayedAction[];
  gameTime: number;
  isPaused: boolean;
  result: 'win' | 'lose' | null;
  level: number;
  levelConfig: LevelConfig;
  camera: Vector2;
  vfxEvents: string[];
  engine: any;
  tattooChoices?: TattooId[];
  inputEvents?: InputEvent[];
}

export interface LevelConfig {
  timeLimit: number;
  winCondition: 'hold_center' | 'default';
  foodCount: number;
  botCount: number;
  mapRadius: number;
}

// ============================================
// ENTITY TYPES
// ============================================

export interface Entity {
  id: string;
  position: Vector2;
  velocity: Vector2;
  radius: number;
  isDead: boolean;
}

export interface Player extends Entity {
  name: string;
  shape: string;
  score: number;
  maxSpeed: number;
  targetPosition: Vector2;
  pigment: PigmentVec3;
  targetPigment: PigmentVec3;
  matchPercent: number;
  ring: number;
  emotion: string;
  tattoos: TattooId[];
  statusEffects: StatusEffects;
  inputs?: {
    space: boolean;
    w: boolean;
  };
  inputEvents?: InputEvent[];
}

export interface Bot extends Player {
  aiState: {
    targetEntityId: string | null;
    aiReactionTimer: number;
  };
  tier: number;
  isInvulnerable: boolean;
}

export interface Food extends Entity {
  pigment: PigmentVec3;
  value: number;
  type: 'normal' | 'catalyst' | 'solvent';
}

export interface Projectile extends Entity {
  ownerId: string;
  damage: number;
  velocity: Vector2;
  pigment: PigmentVec3;
}

export interface Particle extends Entity {
  life: number;
  velocity: Vector2;
  pigment: PigmentVec3;
  size: number;
}

export interface FloatingText extends Entity {
  text: string;
  life: number;
  velocity: Vector2;
}

export interface DelayedAction {
  timer: number;
  action: () => void;
}

// ============================================
// STATUS EFFECTS TYPES
// ============================================

export interface StatusEffects {
  speedBoost?: number;
  invulnerable?: boolean;
  neutralPurification?: boolean;
  neutralMassBonus?: number;
  purificationRadius?: number;
  overdriveExplosive?: boolean;
  explosiveSpeed?: number;
  explosionRadius?: number;
  goldenAttraction?: boolean;
  catalystAttractionRadius?: number;
  goldenMagneticForce?: number;
  elementalBalance?: boolean;
  solventShieldPower?: number;
  catalystEchoBonus?: number;
}

// ============================================
// GAME SYSTEM TYPES
// ============================================

export interface InputEvent {
  type: 'move' | 'skill' | 'eject';
  data: any;
}

export interface TattooId {
  // Define tattoo IDs here
  FilterInk: string;
  NeutralMastery: string;
  Overdrive: string;
  PigmentBomb: string;
  // ... other tattoos
}

export interface GamePhase {
  name: string;
  duration: number;
  description: string;
}

export interface SizeTier {
  name: string;
  minSize: number;
  maxSize: number;
}

export interface MutationTier {
  name: string;
  requiredScore: number;
  mutations: string[];
}

// ============================================
// UI TYPES
// ============================================

export interface UiState {
  screen: 'menu' | 'game' | 'gameOver' | 'levelSelect' | 'matchmaking' | 'tournamentLobby';
  overlay: 'pause' | 'settings' | 'tutorial' | null;
  isPaused: boolean;
  showFPS: boolean;
  showDebug: boolean;
}

export interface Settings {
  masterVolume: number;
  sfxVolume: number;
  bgmVolume: number;
  quality: 'low' | 'medium' | 'high' | 'ultra';
  useMultiplayer: boolean;
  showFPS: boolean;
  showDebug: boolean;
}

export interface Progression {
  unlockedLevel: number;
  highScore: number;
  totalKills: number;
  gamesPlayed: number;
  cosmetics: {
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
}

// ============================================
// NETWORK TYPES
// ============================================

export interface NetworkStatus {
  connected: boolean;
  roomId: string | null;
  latency: number;
  players: number;
}

export interface ServerMessage {
  type: 'state' | 'event' | 'error';
  data: any;
}

export interface ClientMessage {
  type: 'input' | 'action' | 'chat';
  data: any;
}

// ============================================
// AUDIO TYPES
// ============================================

export interface AudioConfig {
  masterVolume: number;
  sfxVolume: number;
  bgmVolume: number;
  spatialAudio: boolean;
  dynamicMusic: boolean;
  quality: 'low' | 'medium' | 'high' | 'ultra';
}

export interface SoundDefinition {
  id: string;
  type: 'sfx' | 'bgm' | 'ambient';
  generator: (ctx: AudioContext) => AudioBufferSourceNode | OscillatorNode;
  volume: number;
  poolSize: number;
  spatial: boolean;
  priority: number;
}

// ============================================
// PERFORMANCE TYPES
// ============================================

export interface PerformanceMetrics {
  fps: number;
  memory: number;
  drawCalls: number;
  particleCount: number;
  entityCount: number;
  networkLatency: number;
}

export interface QualityLevel {
  name: 'low' | 'medium' | 'high' | 'ultra';
  resolution: number;
  particleLimit: number;
  shadowQuality: number;
  textureQuality: number;
}

// ============================================
// EXPORT ALL TYPES
// ============================================

// Re-export commonly used types for convenience
export type {
  Vector2 as Vec2,
  Vector3 as Vec3,
  PigmentVec3 as Color,
  GameState as State,
  Player as PlayerEntity,
  Bot as BotEntity,
  Food as FoodEntity,
  Projectile as ProjectileEntity,
  Particle as ParticleEntity,
  FloatingText as TextEntity,
  DelayedAction as Action,
  StatusEffects as Effects,
  InputEvent as Input,
  TattooId as Tattoo,
  GamePhase as Phase,
  SizeTier as Size,
  MutationTier as Mutation,
  UiState as UI,
  Settings as Config,
  Progression as Progress,
  NetworkStatus as Network,
  ServerMessage as ServerMsg,
  ClientMessage as ClientMsg,
  AudioConfig as Audio,
  SoundDefinition as Sound,
  PerformanceMetrics as Metrics,
  QualityLevel as Quality
};
