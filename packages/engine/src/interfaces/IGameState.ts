/**
 * @eidolon/engine - Engine State Interfaces
 *
 * EIDOLON-V PLATFORMIZATION:
 * These interfaces define the contract between the Engine and Colyseus State.
 * The Engine can write directly to authoritative state, eliminating
 * the "Twin State Paradox" and the need for syncDODToSchema.
 *
 * NOTE: This is now game-agnostic. Game-specific interfaces should extend
 * these base interfaces in their respective modules.
 */

/**
 * Generic RGB color type (game-agnostic)
 * Games can use this for any color representation
 */
export interface IColorVec3 {
  r: number;
  g: number;
  b: number;
}

/**
 * Engine-facing player interface - mutation methods for direct state writes
 *
 * This is the base interface. Game modules should extend this with
 * game-specific properties (e.g., ICJRPlayer extends IEnginePlayer).
 */
export interface IEnginePlayer {
  // Identity
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

  // Core Stats (common to most games)
  currentHealth: number;
  maxHealth: number;
  score: number;

  setHealth(health: number): void;
  setScore(score: number): void;

  // Input tracking
  lastProcessedInput: number;
  setLastProcessedInput(seq: number): void;

  // Extension point for game-specific data
  // Modules can add custom fields via declaration merging or wrapper interfaces
}

/**
 * Engine-facing bot interface
 *
 * Base interface for AI-controlled entities.
 * Game modules should extend with game-specific properties.
 */
export interface IEngineBot {
  id: string;
  name: string;

  // Position
  x: number;
  y: number;
  setPosition(x: number, y: number): void;

  // Velocity
  vx: number;
  vy: number;
  setVelocity(vx: number, vy: number): void;

  // Physics
  radius: number;
  setRadius(radius: number): void;

  // State
  isDead: boolean;
  setDead(dead: boolean): void;
}

/**
 * Engine-facing food/entity interface
 */
export interface IEngineFood {
  id: string;
  x: number;
  y: number;
  radius: number;
  // color and kind can be generic, but might be moved to generic properties map if needed
  color: number; // Hex or int
  // kind is usually game specific string
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
  // Result might be game-specific, but win/lose is common enough
  result: 'win' | 'lose' | string | null;

  // Mutation methods for engine
  incrementGameTime(dt: number): void;
  setPaused(paused: boolean): void;
  setResult(result: 'win' | 'lose' | string | null): void;

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
