/**
 * ENTITY STATE BRIDGE - FULL DOD VERSION
 *
 * EIDOLON-V P2: Eliminated dual-write anti-pattern.
 * DOD Stores are now the SINGLE SOURCE OF TRUTH.
 * 
 * EIDOLON-V FIX: Now accepts WorldState as parameter instead of using defaultWorld.
 */

import { Player, Bot } from '../../../types';
import {
  WorldState,
  TransformAccess,
  PhysicsAccess,
  StatsAccess,
  ConfigAccess,
} from '@cjr/engine';

/**
 * Factory to create an EntityStateBridge bound to a specific WorldState.
 * This eliminates the defaultWorld singleton dependency.
 */
export function createEntityStateBridge(world: WorldState) {
  return {
    // =============================================
    // SETTERS: Write ONLY to DOD Stores
    // =============================================

    setSpeedMultiplier: (entity: Player | Bot, value: number) => {
      if (entity.physicsIndex === undefined) return;
      ConfigAccess.setSpeedMult(world, entity.physicsIndex, value);
    },

    setMagnetRadius: (entity: Player | Bot, value: number) => {
      if (entity.physicsIndex === undefined) return;
      ConfigAccess.setMagneticRadius(world, entity.physicsIndex, value);
    },

    setDamageMultiplier: (entity: Player | Bot, value: number) => {
      if (entity.physicsIndex === undefined) return;
      StatsAccess.setDamageMultiplier(world, entity.physicsIndex, value);
    },

    setDefense: (entity: Player | Bot, value: number) => {
      if (entity.physicsIndex === undefined) return;
      StatsAccess.setDefense(world, entity.physicsIndex, value);
    },

    setCurrentHealth: (entity: Player | Bot, value: number) => {
      if (entity.physicsIndex === undefined) return;
      StatsAccess.setHp(world, entity.physicsIndex, value);
    },

    setMaxHealth: (entity: Player | Bot, value: number) => {
      if (entity.physicsIndex === undefined) return;
      StatsAccess.setMaxHp(world, entity.physicsIndex, value);
    },

    // =============================================
    // GETTERS: Read from DOD Stores
    // =============================================

    getSpeedMultiplier: (entity: Player | Bot): number => {
      if (entity.physicsIndex === undefined) return 1;
      return ConfigAccess.getSpeedMult(world, entity.physicsIndex);
    },

    getMagnetRadius: (entity: Player | Bot): number => {
      if (entity.physicsIndex === undefined) return 0;
      return ConfigAccess.getMagneticRadius(world, entity.physicsIndex);
    },

    getDamageMultiplier: (entity: Player | Bot): number => {
      if (entity.physicsIndex === undefined) return 1;
      return StatsAccess.getDamageMultiplier(world, entity.physicsIndex);
    },

    getDefense: (entity: Player | Bot): number => {
      if (entity.physicsIndex === undefined) return 0;
      return StatsAccess.getDefense(world, entity.physicsIndex);
    },

    getCurrentHealth: (entity: Player | Bot): number => {
      if (entity.physicsIndex === undefined) return 100;
      return StatsAccess.getHp(world, entity.physicsIndex);
    },

    getMaxHealth: (entity: Player | Bot): number => {
      if (entity.physicsIndex === undefined) return 100;
      return StatsAccess.getMaxHp(world, entity.physicsIndex);
    },

    // =============================================
    // POSITION/VELOCITY GETTERS
    // =============================================

    getPosition: (entity: Player | Bot, out: { x: number; y: number }): void => {
      if (entity.physicsIndex === undefined) {
        out.x = 0;
        out.y = 0;
        return;
      }
      out.x = TransformAccess.getX(world, entity.physicsIndex);
      out.y = TransformAccess.getY(world, entity.physicsIndex);
    },

    getVelocity: (entity: Player | Bot, out: { x: number; y: number }): void => {
      if (entity.physicsIndex === undefined) {
        out.x = 0;
        out.y = 0;
        return;
      }
      out.x = PhysicsAccess.getVx(world, entity.physicsIndex);
      out.y = PhysicsAccess.getVy(world, entity.physicsIndex);
    },

    getRadius: (entity: Player | Bot): number => {
      if (entity.physicsIndex === undefined) return 15;
      return PhysicsAccess.getRadius(world, entity.physicsIndex);
    },

    // =============================================
    // BATCH SYNC: For UI/Legacy that still needs object properties
    // =============================================

    syncToObject: (entity: Player | Bot): void => {
      if (entity.physicsIndex === undefined) return;
      const idx = entity.physicsIndex;

      // Position
      entity.position.x = TransformAccess.getX(world, idx);
      entity.position.y = TransformAccess.getY(world, idx);

      // Velocity
      entity.velocity.x = PhysicsAccess.getVx(world, idx);
      entity.velocity.y = PhysicsAccess.getVy(world, idx);

      // Radius
      entity.radius = PhysicsAccess.getRadius(world, idx);

      // Stats
      entity.currentHealth = StatsAccess.getHp(world, idx);

      // Speed multiplier for UI display
      if (entity.statusMultipliers) {
        entity.statusMultipliers.speed = ConfigAccess.getSpeedMult(world, idx);
        entity.statusMultipliers.damage = StatsAccess.getDamageMultiplier(world, idx);
      }
    },
  };
}

// Type for the bridge object
export type EntityStateBridgeType = ReturnType<typeof createEntityStateBridge>;
