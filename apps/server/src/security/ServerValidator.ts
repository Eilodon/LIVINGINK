/**
 * SERVER SECURITY VALIDATOR
 * Anti-cheat, position validation, input sanitization
 */

import { PlayerState, BotState, FoodState, ProjectileState } from '../schema/GameState';
import { WORLD_WIDTH, WORLD_HEIGHT, MAP_RADIUS } from '../constants';
import { GameConfig } from '@cjr/engine';

export interface ValidationResult {
  isValid: boolean;
  reason?: string;
  correctedValue?: unknown;
}

export interface PositionValidation {
  isValid: boolean;
  reason?: string;
  correctedPosition?: { x: number; y: number };
}

/**
 * Rate limiting for player actions
 * IMPERATOR PLAN Phase 1: O(1) Token Bucket - replaces O(N) array shift
 */
interface RateTracker {
  count: number;
  resetAt: number;
}

export class ServerValidator {
  private static readonly MAX_SPEED = 500; // pixels per second
  private static readonly TELEPORT_THRESHOLD = 200; // max distance per update
  private static readonly POSITION_HISTORY_SIZE = 10;

  private static positionHistory: Map<string, { x: number; y: number; timestamp: number }[]> = new Map();
  private static lastUpdateTime: Map<string, number> = new Map();

  // IMPERATOR Phase 1: O(1) rate limiting with counter window
  // EIDOLON-V OPTIMIZATION: Nested Map eliminates string concatenation garbage
  private static rateTrackers: Map<string, Map<string, RateTracker>> = new Map();

  /**
   * Validate player position to prevent teleportation hacks
   */
  static validatePosition(
    sessionId: string,
    newPosition: { x: number; y: number },
    oldPosition: { x: number; y: number },
    deltaTime: number
  ): PositionValidation {
    // Check world boundaries
    if (
      newPosition.x < -WORLD_WIDTH / 2 ||
      newPosition.x > WORLD_WIDTH / 2 ||
      newPosition.y < -WORLD_HEIGHT / 2 ||
      newPosition.y > WORLD_HEIGHT / 2
    ) {
      return {
        isValid: false,
        reason: 'Position outside world boundaries',
        correctedPosition: this.clampToWorldBounds(newPosition),
      };
    }

    // Check map radius (if applicable)
    const distanceFromCenter = Math.sqrt(
      newPosition.x * newPosition.x + newPosition.y * newPosition.y
    );
    if (distanceFromCenter > MAP_RADIUS) {
      return {
        isValid: false,
        reason: 'Position outside map radius',
        correctedPosition: this.clampToMapRadius(newPosition),
      };
    }

    // Check for teleportation (speed hack)
    const distance = Math.sqrt(
      Math.pow(newPosition.x - oldPosition.x, 2) + Math.pow(newPosition.y - oldPosition.y, 2)
    );

    const maxDistance = this.MAX_SPEED * deltaTime;
    if (distance > maxDistance) {
      return {
        isValid: false,
        reason: 'Teleportation detected - speed exceeded maximum',
        correctedPosition: this.interpolatePosition(
          oldPosition,
          newPosition,
          maxDistance / distance
        ),
      };
    }

    return { isValid: true };
  }

  /**
   * Validate player input to prevent impossible actions
   */
  static validateInput(
    sessionId: string,
    input: {
      targetX: number;
      targetY: number;
      space: boolean;
      w: boolean;
      seq: number;
    },
    lastInput: {
      targetX: number;
      targetY: number;
      space: boolean;
      w: boolean;
      seq: number;
    } | null,
    playerState: PlayerState
  ): ValidationResult {
    // Validate sequence number to prevent replay attacks
    if (lastInput) {
      if (input.seq <= lastInput.seq) {
        return {
          isValid: false,
          reason: 'Invalid sequence number - possible replay attack',
        };
      }

      // EIDOLON-V FIX: Anti-Speedhack / Lag Switch Check from GameConfig
      const jump = input.seq - lastInput.seq;
      if (jump > GameConfig.NETWORK.MAX_SEQUENCE_JUMP) {
        return {
          isValid: false,
          reason: `Sequence jump too large (${jump}) - possible speedhack`,
        };
      }
    }

    // Validate target position
    if (
      input.targetX < -WORLD_WIDTH / 2 ||
      input.targetX > WORLD_WIDTH / 2 ||
      input.targetY < -WORLD_HEIGHT / 2 ||
      input.targetY > WORLD_HEIGHT / 2
    ) {
      return {
        isValid: false,
        reason: 'Target position outside world boundaries',
      };
    }

    // Validate skill cooldown
    if (input.space && playerState.skillCooldown > 0) {
      return {
        isValid: false,
        reason: 'Skill still on cooldown',
      };
    }

    // Validate boost usage
    if (input.w && playerState.currentHealth <= 0) {
      return {
        isValid: false,
        reason: 'Cannot boost when dead',
      };
    }

    return { isValid: true };
  }

  /**
   * Validate player stats to prevent stat modification hacks
   */
  static validatePlayerStats(
    newStats: PlayerState,
    oldStats: PlayerState,
    deltaTime: number
  ): ValidationResult {
    // Check for impossible score changes
    const scoreDiff = newStats.score - oldStats.score;
    if (scoreDiff < 0) {
      return {
        isValid: false,
        reason: 'Score decreased unexpectedly',
      };
    }

    // Check for impossible health changes
    const healthDiff = newStats.currentHealth - oldStats.currentHealth;
    if (healthDiff > 0 && oldStats.currentHealth <= 0) {
      return {
        isValid: false,
        reason: 'Health restored from zero - possible resurrection hack',
      };
    }

    // Check for impossible size changes
    const sizeDiff = newStats.radius - oldStats.radius;
    const maxGrowthRate = 10; // max radius increase per second
    if (sizeDiff > maxGrowthRate * deltaTime) {
      return {
        isValid: false,
        reason: 'Size increased too rapidly - possible growth hack',
      };
    }

    // Validate color values
    if (
      newStats.pigment.r < 0 ||
      newStats.pigment.r > 1 ||
      newStats.pigment.g < 0 ||
      newStats.pigment.g > 1 ||
      newStats.pigment.b < 0 ||
      newStats.pigment.b > 1
    ) {
      return {
        isValid: false,
        reason: 'Invalid pigment values - must be between 0 and 1',
      };
    }

    return { isValid: true };
  }

  /**
   * Validate collision detection results
   */
  static validateCollision(
    attacker: PlayerState,
    target: PlayerState | FoodState,
    damage: number
  ): ValidationResult {
    let targetX: number, targetY: number;

    // Handle different position properties
    if ('position' in target) {
      targetX = target.position.x;
      targetY = target.position.y;
    } else {
      // FoodState uses x, y properties
      targetX = (target as any).x || 0;
      targetY = (target as any).y || 0;
    }

    // Check distance between attacker and target
    const distance = Math.sqrt(
      Math.pow(attacker.position.x - targetX, 2) + Math.pow(attacker.position.y - targetY, 2)
    );

    const maxCollisionDistance = attacker.radius + target.radius + 10; // 10px tolerance
    if (distance > maxCollisionDistance) {
      return {
        isValid: false,
        reason: 'Collision distance too great - possible fake collision',
      };
    }

    // Validate damage amount
    if (damage < 0 || damage > 100) {
      return {
        isValid: false,
        reason: 'Invalid damage amount',
      };
    }

    return { isValid: true };
  }

  /**
   * Sanitize incoming data to prevent injection attacks
   */
  /**
   * Sanitize incoming data to prevent injection attacks
   */
  static sanitizeInput(input: unknown): Record<string, unknown> {
    if (typeof input !== 'object' || input === null) {
      return {};
    }

    const typedInput = input as Record<string, unknown>;
    const sanitized: Record<string, unknown> = {};

    // Only allow known safe properties
    const allowedProperties = ['targetX', 'targetY', 'space', 'w', 'seq'];
    for (const prop of allowedProperties) {
      if (prop in typedInput) {
        const value = typedInput[prop];

        // Type validation
        if (prop === 'targetX' || prop === 'targetY' || prop === 'seq') {
          sanitized[prop] = Number(value) || 0;
        } else if (prop === 'space' || prop === 'w') {
          sanitized[prop] = Boolean(value);
        }
      }
    }

    return sanitized;
  }

  /**
   * Rate limiting for player actions - IMPERATOR Phase 1: O(1) Token Bucket
   * EIDOLON-V OPTIMIZATION: Composite key (Map<sessionId, Map<actionType>>) 
   * eliminates string concatenation `${sessionId}_${actionType}` in hot path
   */
  static validateActionRate(
    sessionId: string,
    actionType: string,
    maxActionsPerSecond: number = 10
  ): ValidationResult {
    const now = Date.now();

    // O(1): Get or create action map for this session (no string concat!)
    let actionMap = this.rateTrackers.get(sessionId);
    if (!actionMap) {
      actionMap = new Map<string, RateTracker>();
      this.rateTrackers.set(sessionId, actionMap);
    }

    let tracker = actionMap.get(actionType);

    // O(1): Reset counter if window expired
    if (!tracker || now > tracker.resetAt) {
      tracker = { count: 0, resetAt: now + 1000 };
      actionMap.set(actionType, tracker);
    }

    // O(1): Check and increment
    if (tracker.count >= maxActionsPerSecond) {
      return {
        isValid: false,
        reason: `Action rate limit exceeded - max ${maxActionsPerSecond} per second`,
      };
    }

    tracker.count++;
    return { isValid: true };
  }

  // Helper methods
  private static clampToWorldBounds(position: { x: number; y: number }): { x: number; y: number } {
    return {
      x: Math.max(-WORLD_WIDTH / 2, Math.min(WORLD_WIDTH / 2, position.x)),
      y: Math.max(-WORLD_HEIGHT / 2, Math.min(WORLD_HEIGHT / 2, position.y)),
    };
  }

  private static clampToMapRadius(position: { x: number; y: number }): { x: number; y: number } {
    const distance = Math.sqrt(position.x * position.x + position.y * position.y);
    if (distance <= MAP_RADIUS) return position;

    const ratio = MAP_RADIUS / distance;
    return {
      x: position.x * ratio,
      y: position.y * ratio,
    };
  }

  private static interpolatePosition(
    start: { x: number; y: number },
    end: { x: number; y: number },
    ratio: number
  ): { x: number; y: number } {
    return {
      x: start.x + (end.x - start.x) * ratio,
      y: start.y + (end.y - start.y) * ratio,
    };
  }

  /**
   * Clear old data to prevent memory leaks
   * IMPERATOR Phase 1: Clean O(1) rate trackers
   * EIDOLON-V: Cleanup nested Map structure
   */
  static cleanup(): void {
    const now = Date.now();
    const oneMinuteAgo = now - 60000;

    // Clean up expired rate trackers from nested Maps
    for (const [sessionId, actionMap] of this.rateTrackers) {
      for (const [actionType, tracker] of actionMap) {
        if (tracker.resetAt < oneMinuteAgo) {
          actionMap.delete(actionType);
        }
      }
      // Remove empty session maps to prevent memory leak
      if (actionMap.size === 0) {
        this.rateTrackers.delete(sessionId);
      }
    }

    // EIDOLON-V FIX: Also clean position history
    for (const [sessionId, history] of this.positionHistory) {
      // If history is old (user likely left), remove it
      const lastUpdate = this.lastUpdateTime.get(sessionId);
      if (!lastUpdate || lastUpdate < oneMinuteAgo) {
        this.positionHistory.delete(sessionId);
        this.lastUpdateTime.delete(sessionId);
      }
    }
  }
}

export const serverValidator = ServerValidator;
