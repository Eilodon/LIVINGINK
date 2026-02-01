import { Vector2 } from './shared';
import { IGameEngine } from './engine';
import { Player, Bot, TattooChoice } from './player';
import { Food, Particle, Projectile, FloatingText, DelayedAction } from './entity';
import { LevelConfig } from '../game/cjr/levels';
import { VFXEvent } from '../game/engine/VFXRingBuffer'; // Import struct chuẩn

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
  winCondition?: {
    timer: number;
  };
}

export interface GameState {
  // Entities (Containers for View)
  player: Player;
  players: Player[];
  bots: Bot[];
  creeps: Bot[];
  boss: Bot | null;
  food: Food[];

  // Transient Entities
  particles: Particle[];
  projectiles: Projectile[];
  delayedActions: DelayedAction[];
  floatingTexts: FloatingText[];

  // Systems
  engine: IGameEngine;
  runtime: GameRuntimeState;

  // World Stats
  worldSize: Vector2;
  zoneRadius: number;
  gameTime: number;
  currentRound: number;
  camera: Vector2;
  shakeIntensity: number;
  kingId: string | null;
  level: number;
  levelConfig: LevelConfig;

  // Meta State
  tattooChoices: TattooChoice[] | null;
  unlockedTattoos: string[];
  isPaused: boolean;
  result: 'win' | 'lose' | null;

  // EIDOLON-V: VFX Pipeline
  // UI Layer reads this array which is populated from VFXRingBuffer each frame
  // This decouples the ring buffer (Engine) from the React State (UI)
  vfxEvents: VFXEvent[];
  vfxHead: number; // Deprecated if using full array replacement strategy
  vfxTail: number; // Deprecated
}
