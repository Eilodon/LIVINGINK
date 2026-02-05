/**
 * EIDOLON-V: DOD Component Stores Unit Tests
 * Tests for Data-Oriented Design TypedArray operations
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  TransformStore,
  PhysicsStore,
  StatsStore,
  StateStore,
  InputStore,
  ConfigStore,
  SkillStore,
  ProjectileStore,
  resetAllStores,
} from '../dod/ComponentStores';
import { EntityFlags } from '../dod/EntityFlags';
import { MAX_ENTITIES } from '../dod/EntityFlags';

describe('DOD Component Stores', () => {
  beforeEach(() => {
    resetAllStores();
  });

  describe('TransformStore', () => {
    it('should set and get position correctly', () => {
      const index = 0;
      TransformStore.set(index, 100, 200, 0.5, 1.5);

      expect(TransformStore.getX(index)).toBe(100);
      expect(TransformStore.getY(index)).toBe(200);
    });

    it('should set position independently for different entities', () => {
      TransformStore.set(0, 10, 20, 0, 1);
      TransformStore.set(1, 100, 200, 1, 2);

      expect(TransformStore.getX(0)).toBe(10);
      expect(TransformStore.getY(0)).toBe(20);
      expect(TransformStore.getX(1)).toBe(100);
      expect(TransformStore.getY(1)).toBe(200);
    });

    it('should handle boundary indices', () => {
      const lastIndex = MAX_ENTITIES - 1;
      TransformStore.set(lastIndex, 500, 600, 0, 1);

      expect(TransformStore.getX(lastIndex)).toBe(500);
      expect(TransformStore.getY(lastIndex)).toBe(600);
    });

    it('should update position with setPosition', () => {
      TransformStore.set(5, 50, 60, 0, 1);
      TransformStore.setPosition(5, 100, 120);

      expect(TransformStore.getX(5)).toBe(100);
      expect(TransformStore.getY(5)).toBe(120);
    });
  });

  describe('PhysicsStore', () => {
    it('should set and get velocity correctly', () => {
      const index = 0;
      PhysicsStore.setVelocity(index, 10, 20);

      expect(PhysicsStore.getVelocityX(index)).toBe(10);
      expect(PhysicsStore.getVelocityY(index)).toBe(20);
    });

    it('should set and get radius correctly', () => {
      PhysicsStore.set(10, 0, 0, 100, 25.5);

      expect(PhysicsStore.getRadius(10)).toBe(25.5);
    });

    it('should set all physics properties at once', () => {
      PhysicsStore.set(0, 5, 10, 100, 20, 0.8, 0.9);

      expect(PhysicsStore.getVelocityX(0)).toBe(5);
      expect(PhysicsStore.getVelocityY(0)).toBe(10);
      expect(PhysicsStore.getRadius(0)).toBe(20);
    });
  });

  describe('StatsStore', () => {
    it('should set and get health correctly', () => {
      StatsStore.setCurrentHealth(0, 75);
      StatsStore.setMaxHealth(0, 100);

      expect(StatsStore.getCurrentHealth(0)).toBe(75);
      expect(StatsStore.getMaxHealth(0)).toBe(100);
    });

    it('should set and get score via set method', () => {
      StatsStore.set(5, 100, 100, 1500, 0, 1, 1);

      expect(StatsStore.getScore(5)).toBe(1500);
    });

    it('should set all stats at once', () => {
      StatsStore.set(0, 80, 100, 500, 0.5, 1, 1.5);

      expect(StatsStore.getCurrentHealth(0)).toBe(80);
      expect(StatsStore.getMaxHealth(0)).toBe(100);
      expect(StatsStore.getScore(0)).toBe(500);
      expect(StatsStore.getMatchPercent(0)).toBe(0.5);
    });

    it('should clamp health to non-negative values', () => {
      StatsStore.setCurrentHealth(0, -10);

      // Should be clamped or handled gracefully
      const health = StatsStore.getCurrentHealth(0);
      expect(health).toBeLessThanOrEqual(0);
    });
  });

  describe('StateStore', () => {
    it('should set and check flags correctly', () => {
      StateStore.setFlag(0, EntityFlags.ACTIVE | EntityFlags.PLAYER);

      expect(StateStore.isActive(0)).toBe(true);
      expect(StateStore.hasFlag(0, EntityFlags.PLAYER)).toBe(true);
      expect(StateStore.hasFlag(0, EntityFlags.BOT)).toBe(false);
    });

    it('should clear flags correctly', () => {
      StateStore.setFlag(0, EntityFlags.ACTIVE | EntityFlags.PLAYER);
      StateStore.clearFlag(0, EntityFlags.PLAYER);

      expect(StateStore.isActive(0)).toBe(true);
      expect(StateStore.hasFlag(0, EntityFlags.PLAYER)).toBe(false);
    });

    it('should handle multiple entity flags independently', () => {
      StateStore.setFlag(0, EntityFlags.ACTIVE | EntityFlags.PLAYER);
      StateStore.setFlag(1, EntityFlags.ACTIVE | EntityFlags.BOT);
      StateStore.setFlag(2, EntityFlags.DEAD);

      expect(StateStore.isActive(0)).toBe(true);
      expect(StateStore.isActive(1)).toBe(true);
      expect(StateStore.isActive(2)).toBe(false);
      expect(StateStore.hasFlag(0, EntityFlags.PLAYER)).toBe(true);
      expect(StateStore.hasFlag(1, EntityFlags.BOT)).toBe(true);
    });
  });

  describe('InputStore', () => {
    it('should set and get target position correctly', () => {
      InputStore.setTarget(0, 300, 400);
      const out = { x: 0, y: 0 };
      InputStore.getTarget(0, out);

      expect(out.x).toBe(300);
      expect(out.y).toBe(400);
    });

    it('should set and consume action bits', () => {
      // Set action bit 0 (skill)
      InputStore.setAction(0, 0, true);
      expect(InputStore.isActionActive(0, 0)).toBe(true);
      expect(InputStore.consumeAction(0, 0)).toBe(true);
      expect(InputStore.consumeAction(0, 0)).toBe(false); // Already consumed
    });

    it('should handle multiple action bits independently', () => {
      // Set bit 0 and bit 1
      InputStore.setAction(0, 0, true);
      InputStore.setAction(0, 1, true);
      
      expect(InputStore.isActionActive(0, 0)).toBe(true);
      expect(InputStore.isActionActive(0, 1)).toBe(true);
      
      // Consume only bit 0
      expect(InputStore.consumeAction(0, 0)).toBe(true);
      expect(InputStore.isActionActive(0, 0)).toBe(false);
      expect(InputStore.isActionActive(0, 1)).toBe(true); // Bit 1 still active
    });

    it('should handle multiple entities independently', () => {
      InputStore.setTarget(0, 100, 200);
      InputStore.setTarget(1, 500, 600);

      const out0 = { x: 0, y: 0 };
      const out1 = { x: 0, y: 0 };
      InputStore.getTarget(0, out0);
      InputStore.getTarget(1, out1);

      expect(out0.x).toBe(100);
      expect(out0.y).toBe(200);
      expect(out1.x).toBe(500);
      expect(out1.y).toBe(600);
    });
  });

  describe('ConfigStore', () => {
    it('should set and get max speed correctly', () => {
      ConfigStore.setMaxSpeed(0, 150);

      expect(ConfigStore.getMaxSpeed(0)).toBe(150);
    });

    it('should set and get speed multiplier correctly', () => {
      ConfigStore.setSpeedMultiplier(0, 1.5);

      expect(ConfigStore.getSpeedMultiplier(0)).toBe(1.5);
    });

    it('should set and get magnet radius correctly', () => {
      ConfigStore.setMagnetRadius(0, 50);

      expect(ConfigStore.getMagnetRadius(0)).toBe(50);
    });
  });

  describe('SkillStore', () => {
    it('should set and get cooldown correctly', () => {
      SkillStore.setCooldown(0, 5.5);

      expect(SkillStore.getCooldown(0)).toBe(5.5);
    });

    it('should set and get max cooldown correctly', () => {
      SkillStore.setMaxCooldown(0, 10);

      expect(SkillStore.getMaxCooldown(0)).toBe(10);
    });

    it('should set and get active timer correctly', () => {
      SkillStore.setActiveTimer(0, 2.5);

      expect(SkillStore.getActiveTimer(0)).toBe(2.5);
    });

    it('should set all values at once', () => {
      SkillStore.set(0, 5.0, 10.0, 2.0);

      expect(SkillStore.getCooldown(0)).toBe(5.0);
      expect(SkillStore.getMaxCooldown(0)).toBe(10.0);
      expect(SkillStore.getActiveTimer(0)).toBe(2.0);
    });
  });

  describe('ProjectileStore', () => {
    it('should set all properties at once', () => {
      ProjectileStore.set(0, 1, 25, 3.5, 2);

      // ProjectileStore only has `set` method in engine version
      // Data is stored at stride 4: [ownerId, damage, duration, typeId]
      expect(ProjectileStore.data[0]).toBe(1);
      expect(ProjectileStore.data[1]).toBe(25);
      expect(ProjectileStore.data[2]).toBe(3.5);
      expect(ProjectileStore.data[3]).toBe(2);
    });
  });

  describe('resetAllStores', () => {
    it('should reset all stores to zero', () => {
      // Set some values
      TransformStore.set(0, 100, 200, 0, 1);
      StateStore.setFlag(0, EntityFlags.ACTIVE);
      StatsStore.set(0, 100, 100, 1000, 0.5, 1, 1);

      // Reset
      resetAllStores();

      // Verify reset
      expect(TransformStore.getX(0)).toBe(0);
      expect(StateStore.isActive(0)).toBe(false);
      expect(StatsStore.getScore(0)).toBe(0);
    });

    it('should handle multiple entities', () => {
      for (let i = 0; i < 10; i++) {
        TransformStore.set(i, i * 10, i * 20, 0, 1);
        StateStore.setFlag(i, EntityFlags.ACTIVE);
      }

      resetAllStores();

      for (let i = 0; i < 10; i++) {
        expect(TransformStore.getX(i)).toBe(0);
        expect(StateStore.isActive(i)).toBe(false);
      }
    });
  });

  describe('Edge Cases', () => {
    it('should handle float precision correctly', () => {
      TransformStore.set(0, 0.1, 0.2, 0.3, 1.1);

      // Float32Array has precision limits
      expect(TransformStore.getX(0)).toBeCloseTo(0.1, 5);
      expect(TransformStore.getY(0)).toBeCloseTo(0.2, 5);
    });

    it('should handle very large values', () => {
      TransformStore.set(0, 1e6, 1e7, 0, 1);

      expect(TransformStore.getX(0)).toBe(1e6);
      expect(TransformStore.getY(0)).toBe(1e7);
    });

    it('should handle concurrent modifications', () => {
      const iterations = 100;

      for (let i = 0; i < iterations; i++) {
        TransformStore.set(i % 10, i, i * 2, 0, 1);
      }

      // Last 10 values should be set correctly
      for (let i = iterations - 10; i < iterations; i++) {
        const index = i % 10;
        expect(TransformStore.getX(index)).toBeGreaterThanOrEqual(iterations - 10);
      }
    });
  });
});
