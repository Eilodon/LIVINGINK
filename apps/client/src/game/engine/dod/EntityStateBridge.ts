/**
 * ENTITY STATE BRIDGE - FULL DOD VERSION
 *
 * EIDOLON-V P2: Eliminated dual-write anti-pattern.
 * DOD Stores are now the SINGLE SOURCE OF TRUTH.
 * Object properties are DEPRECATED - use getters that read from stores.
 */

import { Player, Bot } from '../../../types';
// EIDOLON-V FIX: Import from engine SSOT instead of local duplicates
import { ConfigStore, StatsStore, TransformStore, PhysicsStore, ConfigAccess, StatsAccess, defaultWorld } from '@cjr/engine';

export const EntityStateBridge = {
  // =============================================
  // SETTERS: Write ONLY to DOD Stores
  // =============================================

  setSpeedMultiplier: (entity: Player | Bot, value: number) => {
    if (entity.physicsIndex === undefined) return;
    ConfigStore.setSpeedMultiplier(entity.physicsIndex, value);
  },

  setMagnetRadius: (entity: Player | Bot, value: number) => {
    if (entity.physicsIndex === undefined) return;
    ConfigStore.setMagnetRadius(entity.physicsIndex, value);
  },

  setDamageMultiplier: (entity: Player | Bot, value: number) => {
    if (entity.physicsIndex === undefined) return;
    // Direct Access fallback
    if ((ConfigAccess as any).setDamageMult) {
      (ConfigAccess as any).setDamageMult(defaultWorld, entity.physicsIndex, value);
    }
    // Also sync to StatsStore if needed (legacy duality)
    if ((StatsAccess as any).setDamageMultiplier) {
      (StatsAccess as any).setDamageMultiplier(defaultWorld, entity.physicsIndex, value);
    }
  },

  setDefense: (entity: Player | Bot, value: number) => {
    if (entity.physicsIndex === undefined) return;
    if ((StatsAccess as any).setDefense) {
      (StatsAccess as any).setDefense(defaultWorld, entity.physicsIndex, value);
    }
  },

  setCurrentHealth: (entity: Player | Bot, value: number) => {
    if (entity.physicsIndex === undefined) return;
    StatsStore.setCurrentHealth(entity.physicsIndex, value);
  },

  setMaxHealth: (entity: Player | Bot, value: number) => {
    if (entity.physicsIndex === undefined) return;
    StatsStore.setMaxHealth(entity.physicsIndex, value);
  },

  // =============================================
  // GETTERS: Read from DOD Stores (NEW)
  // =============================================

  getSpeedMultiplier: (entity: Player | Bot): number => {
    if (entity.physicsIndex === undefined) return 1;
    // @ts-ignore - ConfigStore.getSpeedMult is missing in types but present in compat
    return (ConfigStore as any).getSpeedMult ? (ConfigStore as any).getSpeedMult(entity.physicsIndex) : 1;
  },

  getMagnetRadius: (entity: Player | Bot): number => {
    if (entity.physicsIndex === undefined) return 0;
    // @ts-ignore - ConfigStore.getMagneticRadius might be missing
    return (ConfigStore as any).getMagneticRadius ? (ConfigStore as any).getMagneticRadius(entity.physicsIndex) : 0;
  },

  getDamageMultiplier: (entity: Player | Bot): number => {
    if (entity.physicsIndex === undefined) return 1;
    // @ts-ignore
    return (ConfigStore as any).getDamageMult ? (ConfigStore as any).getDamageMult(entity.physicsIndex) : 1;
  },

  getDefense: (entity: Player | Bot): number => {
    if (entity.physicsIndex === undefined) return 0;
    // @ts-ignore
    return (StatsAccess as any).getDefense ? (StatsAccess as any).getDefense(defaultWorld, entity.physicsIndex) : 0;
  },

  getCurrentHealth: (entity: Player | Bot): number => {
    if (entity.physicsIndex === undefined) return 100;
    return StatsStore.getCurrentHealth(entity.physicsIndex);
  },

  getMaxHealth: (entity: Player | Bot): number => {
    if (entity.physicsIndex === undefined) return 100;
    return StatsStore.getMaxHealth(entity.physicsIndex);
  },

  // =============================================
  // POSITION/VELOCITY GETTERS (From TransformStore/PhysicsStore)
  // =============================================

  getPosition: (entity: Player | Bot, out: { x: number; y: number }): void => {
    if (entity.physicsIndex === undefined) {
      out.x = 0;
      out.y = 0;
      return;
    }
    const idx = entity.physicsIndex * 8;
    out.x = TransformStore.data[idx];
    out.y = TransformStore.data[idx + 1];
  },

  getVelocity: (entity: Player | Bot, out: { x: number; y: number }): void => {
    if (entity.physicsIndex === undefined) {
      out.x = 0;
      out.y = 0;
      return;
    }
    const idx = entity.physicsIndex * 8;
    out.x = PhysicsStore.data[idx];
    out.y = PhysicsStore.data[idx + 1];
  },

  getRadius: (entity: Player | Bot): number => {
    if (entity.physicsIndex === undefined) return 15;
    const idx = entity.physicsIndex * 8;
    return PhysicsStore.data[idx + 3]; // radius at offset 3
  },

  // =============================================
  // BATCH SYNC: For UI/Legacy that still needs object properties
  // Call this once per frame AFTER physics update
  // =============================================

  syncToObject: (entity: Player | Bot): void => {
    if (entity.physicsIndex === undefined) return;
    const idx = entity.physicsIndex * 8;

    // Position
    entity.position.x = TransformStore.data[idx];
    entity.position.y = TransformStore.data[idx + 1];

    // Velocity
    entity.velocity.x = PhysicsStore.data[idx];
    entity.velocity.y = PhysicsStore.data[idx + 1];

    // Radius
    entity.radius = PhysicsStore.data[idx + 3];

    // Stats
    entity.currentHealth = StatsStore.getCurrentHealth(entity.physicsIndex);

    // Speed multiplier for UI display
    if (entity.statusMultipliers) {
      // Use Accessors or local getters
      if ((ConfigAccess as any).getSpeedMult) {
        entity.statusMultipliers.speed = (ConfigAccess as any).getSpeedMult(defaultWorld, entity.physicsIndex);
      }
      if ((StatsAccess as any).getDamageMultiplier) {
        entity.statusMultipliers.damage = (StatsAccess as any).getDamageMultiplier(defaultWorld, entity.physicsIndex);
      }
    }
  },
};
