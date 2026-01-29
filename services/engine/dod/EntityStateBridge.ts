/**
 * ENTITY STATE BRIDGE - FULL DOD VERSION
 * 
 * EIDOLON-V P2: Eliminated dual-write anti-pattern.
 * DOD Stores are now the SINGLE SOURCE OF TRUTH.
 * Object properties are DEPRECATED - use getters that read from stores.
 */

import { Player, Bot } from '../../../types';
import { ConfigStore, StatsStore, TransformStore, PhysicsStore } from './ComponentStores';

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
        ConfigStore.setMagneticRadius(entity.physicsIndex, value);
    },

    setDamageMultiplier: (entity: Player | Bot, value: number) => {
        if (entity.physicsIndex === undefined) return;
        ConfigStore.setDamageMultiplier(entity.physicsIndex, value);
        StatsStore.setDamageMultiplier(entity.physicsIndex, value);
    },

    setDefense: (entity: Player | Bot, value: number) => {
        if (entity.physicsIndex === undefined) return;
        StatsStore.setDefense(entity.physicsIndex, value);
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
        return ConfigStore.getSpeedMultiplier(entity.physicsIndex);
    },

    getMagnetRadius: (entity: Player | Bot): number => {
        if (entity.physicsIndex === undefined) return 0;
        return ConfigStore.getMagneticRadius(entity.physicsIndex);
    },

    getDamageMultiplier: (entity: Player | Bot): number => {
        if (entity.physicsIndex === undefined) return 1;
        return ConfigStore.getDamageMultiplier(entity.physicsIndex);
    },

    getDefense: (entity: Player | Bot): number => {
        if (entity.physicsIndex === undefined) return 0;
        return StatsStore.getDefense(entity.physicsIndex);
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
            entity.statusMultipliers.speed = ConfigStore.getSpeedMultiplier(entity.physicsIndex);
            entity.statusMultipliers.damage = ConfigStore.getDamageMultiplier(entity.physicsIndex);
        }
    }
};
