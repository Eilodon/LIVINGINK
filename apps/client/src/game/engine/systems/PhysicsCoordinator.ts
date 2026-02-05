/**
 * Physics Coordinator (Fix #5: Split GOD Object)
 * =============================================================================
 * Coordinates physics updates between DOD stores and game state.
 * Extracted from GameStateManager to reduce god object complexity.
 * =============================================================================
 */

import {
  TransformStore,
  PhysicsStore,
  StateStore,
  StatsStore,
  EntityFlags,
  MovementSystem,
  PhysicsSystem,
  SkillSystem,
} from '@cjr/engine';
import { GameState } from '../../../types';
import { getCurrentEngine } from '../context';
import { entityManager } from '../dod/EntityManager';
import { clientLogger } from '../../../core/logging/ClientLogger';

export class PhysicsCoordinator {
  private lastUpdateTime = 0;

  /**
   * Update all physics systems for singleplayer mode
   * Reads input from DOD InputStore, updates physics, writes to TransformStore
   */
  public updateSingleplayer(dt: number, state: GameState): void {
    const engine = getCurrentEngine();
    if (!engine) return;

    // Update physics world (integrates velocities, applies friction)
    PhysicsSystem.update(engine.world, dt);

    // Update movement (applies input targets to velocities)
    MovementSystem.update(engine.world, dt);

    // Update skills (cooldowns, effects)
    SkillSystem.update(engine.world, dt);

    // Sync player position from DOD store to state object
    // Note: This is only for UI/debugging - rendering uses DOD directly
    if (state.player.physicsIndex !== undefined) {
      const idx = state.player.physicsIndex;
      state.player.position.x = TransformStore.getX(idx);
      state.player.position.y = TransformStore.getY(idx);
      state.player.velocity.x = PhysicsStore.getVelocityX(idx);
      state.player.velocity.y = PhysicsStore.getVelocityY(idx);
    }
  }

  /**
   * Update physics for multiplayer mode (visual only, no simulation)
   * Server authoritative - client just interpolates
   */
  public updateMultiplayerVisuals(dt: number, state: GameState): void {
    // In multiplayer, physics is server-authoritative
    // Client only updates visual interpolation and VFX
    // Position comes from network, not local physics

    // Update local player visuals from DOD if needed
    if (state.player.physicsIndex !== undefined) {
      const idx = state.player.physicsIndex;
      // Note: Position is set by NetworkClient reconciliation, not here
      // But we can update derived values
      state.player.velocity.x = PhysicsStore.getVelocityX(idx);
      state.player.velocity.y = PhysicsStore.getVelocityY(idx);
    }
  }

  /**
   * Check and sync death states from DOD to game state
   */
  public syncDeathStates(state: GameState): void {
    const maxEntities = entityManager.getMaxEntities();

    for (let i = 0; i < maxEntities; i++) {
      const flags = StateStore.flags[i];
      if (!(flags & EntityFlags.ACTIVE)) continue;

      const health = StatsStore.getCurrentHealth(i);
      if (health <= 0) {
        // Mark as dead in DOD
        StateStore.flags[i] &= ~EntityFlags.ACTIVE;

        // Find and mark corresponding entity in state
        this.markEntityDead(state, i);
      }
    }
  }

  private markEntityDead(state: GameState, entityIdx: number): void {
    // Check player
    if (state.player.physicsIndex === entityIdx) {
      state.player.isDead = true;
      return;
    }

    // Check bots
    const bot = state.bots.find(b => b.physicsIndex === entityIdx);
    if (bot) {
      bot.isDead = true;
      return;
    }

    // Check food
    const food = state.food.find(f => f.physicsIndex === entityIdx);
    if (food) {
      food.isDead = true;
    }
  }

  /**
   * Get performance stats from physics systems
   */
  public getStats(): {
    activeEntities: number;
    lastUpdateTime: number;
  } {
    let activeEntities = 0;
    const maxEntities = entityManager.getMaxEntities();

    for (let i = 0; i < maxEntities; i++) {
      if (StateStore.flags[i] & EntityFlags.ACTIVE) {
        activeEntities++;
      }
    }

    return {
      activeEntities,
      lastUpdateTime: this.lastUpdateTime,
    };
  }
}

// Export singleton instance
export const physicsCoordinator = new PhysicsCoordinator();
