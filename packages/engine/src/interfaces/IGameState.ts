/**
 * IMPERATOR PLAN Phase 2: Engine State Interfaces
 * 
 * These interfaces define the contract between the Engine and Colyseus State.
 * The Engine can now write directly to authoritative state, eliminating
 * the "Twin State Paradox" and the need for syncDODToSchema.
 */

import type { PigmentVec3 } from '../modules/cjr/types';

/**
 * Engine-facing player interface - mutation methods for direct state writes
 */
export interface IEnginePlayer {
  id: string;
  sessionId: string;
  name: string;
  
  // Position (direct mutation)
  x: number;
  y: number;
  setPosition(x: number, y: number): void;
  
  // Velocity (direct mutation)
  vx: number;
  vy: number;
  setVelocity(vx: number, vy: number): void;
  
  // Physics properties
  radius: number;
  setRadius(radius: number): void;
  
  // State flags
  isDead: boolean;
  setDead(dead: boolean): void;
  
  // Stats
  currentHealth: number;
  maxHealth: number;
  score: number;
  matchPercent: number;
  
  setHealth(health: number): void;
  setScore(score: number): void;
  setMatchPercent(percent: number): void;
  
  // Pigment (color)
  pigment: PigmentVec3;
  targetPigment: PigmentVec3;
  setPigment(r: number, g: number, b: number): void;
  
  // Ring progression
  ring: 1 | 2 | 3;
  setRing(ring: 1 | 2 | 3): void;
  
  // Input tracking
  lastProcessedInput: number;
  setLastProcessedInput(seq: number): void;
}

/**
 * Engine-facing bot interface
 */
export interface IEngineBot {
  id: string;
  name: string;
  personality: string;
  
  x: number;
  y: number;
  setPosition(x: number, y: number): void;
  
  vx: number;
  vy: number;
  setVelocity(vx: number, vy: number): void;
  
  radius: number;
  setRadius(radius: number): void;
  
  isDead: boolean;
  setDead(dead: boolean): void;
  
  pigment: PigmentVec3;
  setPigment(r: number, g: number, b: number): void;
}

/**
 * Engine-facing food/entity interface
 */
export interface IEngineFood {
  id: string;
  x: number;
  y: number;
  radius: number;
  color: number;
  kind: string;
  isDead: boolean;
  setDead(dead: boolean): void;
}

/**
 * Engine-facing projectile interface
 */
export interface IEngineProjectile {
  id: string;
  ownerId: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  color: number;
  isDead: boolean;
  setDead(dead: boolean): void;
}

/**
 * Main Engine State Interface
 * 
 * Implementing this interface on Colyseus GameRoomState allows
 * the Engine to write authoritative changes directly,
 * bypassing manual sync steps.
 */
export interface IEngineGameState {
  // Entity collections
  players: Map<string, IEnginePlayer>;
  bots: Map<string, IEngineBot>;
  food: Map<string, IEngineFood>;
  projectiles: Map<string, IEngineProjectile>;
  
  // Game state
  gameTime: number;
  isPaused: boolean;
  result: 'win' | 'lose' | null;
  
  // Mutation methods for engine
  incrementGameTime(dt: number): void;
  setPaused(paused: boolean): void;
  setResult(result: 'win' | 'lose' | null): void;
  
  // Entity lifecycle
  addPlayer(id: string, player: IEnginePlayer): void;
  removePlayer(id: string): void;
  
  addBot(id: string, bot: IEngineBot): void;
  removeBot(id: string): void;
  
  addFood(id: string, food: IEngineFood): void;
  removeFood(id: string): void;
  
  addProjectile(id: string, projectile: IEngineProjectile): void;
  removeProjectile(id: string): void;
}
