/**
 * @eidolon/engine - Network Types
 *
 * EIDOLON-V PLATFORMIZATION:
 * Generic network types shared between client and server.
 * Game-specific extensions should be in modules.
 */

/**
 * Generic Network Input
 *
 * Uses action flags instead of game-specific keys.
 * Games define their own action mappings via IInputMapping.
 */
export interface NetworkInput {
  seq: number;
  targetX: number;
  targetY: number;
  /** Bitmask of active actions (game-specific, mapped via IInputMapping) */
  actions: number;
}

/**
 * Standard action bits for common inputs
 * Games can use these or define their own starting from bit 8+
 */
export enum ActionBits {
  PRIMARY = 1 << 0,   // Primary action (skill, attack, etc.)
  SECONDARY = 1 << 1, // Secondary action (eject, block, etc.)
  TERTIARY = 1 << 2,  // Third action
  BOOST = 1 << 3,     // Speed boost / sprint
  // Bits 4-7 reserved for engine
  // Bits 8+ available for game-specific actions
}

/**
 * Backward compatibility: CJR-style input
 * @deprecated Use NetworkInput.actions with ActionBits instead
 */
export interface NetworkInputLegacy {
  seq: number;
  targetX: number;
  targetY: number;
  space: boolean;
  w: boolean;
}

/**
 * Convert legacy input to new format
 */
export function legacyToNetworkInput(legacy: NetworkInputLegacy): NetworkInput {
  let actions = 0;
  if (legacy.space) actions |= ActionBits.PRIMARY;
  if (legacy.w) actions |= ActionBits.SECONDARY;
  return {
    seq: legacy.seq,
    targetX: legacy.targetX,
    targetY: legacy.targetY,
    actions,
  };
}

/**
 * Convert new format to legacy (for backward compatibility)
 */
export function networkInputToLegacy(input: NetworkInput): NetworkInputLegacy {
  return {
    seq: input.seq,
    targetX: input.targetX,
    targetY: input.targetY,
    space: (input.actions & ActionBits.PRIMARY) !== 0,
    w: (input.actions & ActionBits.SECONDARY) !== 0,
  };
}

/**
 * Core Server Event Types (game-agnostic)
 *
 * Games can define additional event types starting from 100+.
 * Use IEventDefinition in game modules for custom events.
 */
export enum ServerEventType {
  // Core events (0-99 reserved for engine)
  ENTITY_DEATH = 1,
  ENTITY_SPAWN = 2,
  GAME_START = 3,
  GAME_OVER = 4,
  GAME_PAUSE = 5,
  GAME_RESUME = 6,

  // Game-specific events start from 100
  // Modules should define: MY_EVENT = 100, etc.
}

/**
 * CJR-specific event types
 * @deprecated Use CJR module's event definitions instead
 */
export enum CJRServerEventType {
  RING_COMMIT = 100,
  TATTOO_UNLOCK = 101,
  RUSH_START = 102,
  RUSH_END = 103,
  BOSS_SPAWN = 104,
  BOSS_DEATH = 105,
}
