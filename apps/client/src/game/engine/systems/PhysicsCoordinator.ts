/**
 * Physics Coordinator (Fix #5: Split GOD Object)
 * =============================================================================
 * Coordinates physics updates between DOD stores and game state.
 * Extracted from GameStateManager to reduce god object complexity.
 * =============================================================================
 */

import {
  TransformAccess,
  PhysicsAccess,
  StatsAccess,
  MAX_ENTITIES,
  EntityFlags,
} from '@cjr/engine';
import { GameState } from '@/types';
import { getWorld } from '../context';

import { cjrClientRunner } from '../runner/CJRClientRunner';

export class PhysicsCoordinator {
  private lastUpdateTime = 0;

  /**
   * Update all physics systems for singleplayer mode
   * Reads input from DOD InputStore, updates physics, writes to TransformStore
   */
  public updateSingleplayer(dt: number, state: GameState): void {
    // EIDOLON-V FIX: Actually drive the simulation
    cjrClientRunner.setGameState(state);
    cjrClientRunner.update(dt);

    // Sync player position from DOD store to state object
    // Note: This is only for UI/debugging - rendering uses DOD directly
    if (state.player.physicsIndex !== undefined) {
      const w = getWorld();
      const idx = state.player.physicsIndex;
      state.player.position.x = TransformAccess.getX(w, idx);
      state.player.position.y = TransformAccess.getY(w, idx);
      state.player.velocity.x = PhysicsAccess.getVx(w, idx);
      state.player.velocity.y = PhysicsAccess.getVy(w, idx);
    }
  }

  /**
   * Update physics for multiplayer mode (visual only, no simulation)
   * Server authoritative - client just interpolates
   */
  public updateMultiplayerVisuals(dt: number, state: GameState): void {
    // EIDOLON-V FIX: Update visual systems (particles, etc)
    cjrClientRunner.setGameState(state);
    cjrClientRunner.updateVisualsOnly(dt);

    // Update local player visuals from DOD if needed
    if (state.player.physicsIndex !== undefined) {
      const w = getWorld();
      const idx = state.player.physicsIndex;
      // Note: Position is set by NetworkClient reconciliation, not here
      // But we can update derived values
      state.player.velocity.x = PhysicsAccess.getVx(w, idx);
      state.player.velocity.y = PhysicsAccess.getVy(w, idx);
    }
  }

  /**
   * Check and sync death states from DOD to game state
   * EIDOLON-V P2 FIX: Use Sparse Set for O(activeCount) instead of O(maxEntities)
   */
  public syncDeathStates(state: GameState): void {
    const w = getWorld();
    const activeCount = w.activeCount;
    const activeEntities = w.activeEntities;

    for (let i = 0; i < activeCount; i++) {
      const id = activeEntities[i];
      const health = StatsAccess.getHp(w, id);

      if (health <= 0) {
        // Mark as dead in DOD
        w.stateFlags[id] &= ~EntityFlags.ACTIVE;
        // Find and mark corresponding entity in state
        this.markEntityDead(state, id);
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
   * EIDOLON-V P2 FIX: Use Sparse Set activeCount directly
   */
  public getStats(): {
    activeEntities: number;
    lastUpdateTime: number;
  } {
    const w = getWorld();
    return {
      activeEntities: w.activeCount,
      lastUpdateTime: this.lastUpdateTime,
    };
  }
}

// Export singleton instance
export const physicsCoordinator = new PhysicsCoordinator();
