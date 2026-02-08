/**
 * EIDOLON-V: DOD Component Accessors Unit Tests
 * Tests for Data-Oriented Design TypedArray operations
 * 
 * Updated to use instance-based WorldState (no defaultWorld singleton)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { WorldState, MAX_ENTITIES } from '../generated/WorldState';
import {
  TransformAccess,
  PhysicsAccess,
  StatsAccess,
  StateAccess,
  InputAccess,
  ConfigAccess,
  SkillAccess,
  ProjectileAccess,
  EntityFlags,
} from '../generated/ComponentAccessors';

describe('DOD Component Accessors', () => {
  let world: WorldState;

  beforeEach(() => {
    world = new WorldState();
  });

  describe('TransformAccess', () => {
    it('should set and get position correctly', () => {
      const id = 0;
      TransformAccess.setX(world, id, 100);
      TransformAccess.setY(world, id, 200);

      expect(TransformAccess.getX(world, id)).toBe(100);
      expect(TransformAccess.getY(world, id)).toBe(200);
    });

    it('should set position independently for different entities', () => {
      TransformAccess.setX(world, 0, 10);
      TransformAccess.setY(world, 0, 20);
      TransformAccess.setX(world, 1, 100);
      TransformAccess.setY(world, 1, 200);

      expect(TransformAccess.getX(world, 0)).toBe(10);
      expect(TransformAccess.getY(world, 0)).toBe(20);
      expect(TransformAccess.getX(world, 1)).toBe(100);
      expect(TransformAccess.getY(world, 1)).toBe(200);
    });

    it('should handle boundary indices', () => {
      const lastIndex = MAX_ENTITIES - 1;
      TransformAccess.setX(world, lastIndex, 500);
      TransformAccess.setY(world, lastIndex, 600);

      expect(TransformAccess.getX(world, lastIndex)).toBe(500);
      expect(TransformAccess.getY(world, lastIndex)).toBe(600);
    });

    it('should set all values at once', () => {
      // TransformAccess.set takes: world, id, x, y, rotation, scale, prevX, prevY, prevRotation
      TransformAccess.set(world, 5, 100, 120, 0.5, 2.0, 0, 0, 0);

      expect(TransformAccess.getX(world, 5)).toBe(100);
      expect(TransformAccess.getY(world, 5)).toBe(120);
      expect(TransformAccess.getRotation(world, 5)).toBe(0.5);
      expect(TransformAccess.getScale(world, 5)).toBe(2.0);
    });
  });

  describe('PhysicsAccess', () => {
    it('should set and get velocity correctly', () => {
      const id = 0;
      PhysicsAccess.setVx(world, id, 10);
      PhysicsAccess.setVy(world, id, 20);

      expect(PhysicsAccess.getVx(world, id)).toBe(10);
      expect(PhysicsAccess.getVy(world, id)).toBe(20);
    });

    it('should set and get radius correctly', () => {
      PhysicsAccess.setRadius(world, 10, 25.5);

      expect(PhysicsAccess.getRadius(world, 10)).toBe(25.5);
    });

    it('should set all physics properties at once', () => {
      // PhysicsAccess.set takes: world, id, vx, vy, vRotation, mass, radius, restitution, friction
      PhysicsAccess.set(world, 0, 5, 10, 0, 100, 20, 0.8, 0.9);

      expect(PhysicsAccess.getVx(world, 0)).toBe(5);
      expect(PhysicsAccess.getVy(world, 0)).toBe(10);
      expect(PhysicsAccess.getRadius(world, 0)).toBe(20);
    });
  });

  describe('StatsAccess', () => {
    it('should set and get health correctly', () => {
      StatsAccess.setHp(world, 0, 75);
      StatsAccess.setMaxHp(world, 0, 100);

      expect(StatsAccess.getHp(world, 0)).toBe(75);
      expect(StatsAccess.getMaxHp(world, 0)).toBe(100);
    });

    it('should set and get score via set method', () => {
      // StatsAccess.set takes: world, id, hp, maxHp, score, matchPercent, defense, damageMultiplier
      StatsAccess.set(world, 5, 100, 100, 1500, 0, 1, 1);

      expect(StatsAccess.getScore(world, 5)).toBe(1500);
    });

    it('should set all stats at once', () => {
      StatsAccess.set(world, 0, 80, 100, 500, 0.5, 1, 1.5);

      expect(StatsAccess.getHp(world, 0)).toBe(80);
      expect(StatsAccess.getMaxHp(world, 0)).toBe(100);
      expect(StatsAccess.getScore(world, 0)).toBe(500);
      expect(StatsAccess.getMatchPercent(world, 0)).toBe(0.5);
    });
  });

  describe('StateAccess', () => {
    it('should set and check flags correctly', () => {
      StateAccess.setFlags(world, 0, EntityFlags.ACTIVE | EntityFlags.PLAYER);

      expect(StateAccess.isActive(world, 0)).toBe(true);
      expect(StateAccess.hasFlag(world, 0, EntityFlags.PLAYER)).toBe(true);
      expect(StateAccess.hasFlag(world, 0, EntityFlags.BOT)).toBe(false);
    });

    it('should clear flags correctly', () => {
      StateAccess.setFlags(world, 0, EntityFlags.ACTIVE | EntityFlags.PLAYER);
      StateAccess.clearFlag(world, 0, EntityFlags.PLAYER);

      expect(StateAccess.isActive(world, 0)).toBe(true);
      expect(StateAccess.hasFlag(world, 0, EntityFlags.PLAYER)).toBe(false);
    });

    it('should handle multiple entity flags independently', () => {
      StateAccess.setFlags(world, 0, EntityFlags.ACTIVE | EntityFlags.PLAYER);
      StateAccess.setFlags(world, 1, EntityFlags.ACTIVE | EntityFlags.BOT);
      StateAccess.setFlags(world, 2, EntityFlags.DEAD);

      expect(StateAccess.isActive(world, 0)).toBe(true);
      expect(StateAccess.isActive(world, 1)).toBe(true);
      expect(StateAccess.isActive(world, 2)).toBe(false);
      expect(StateAccess.hasFlag(world, 0, EntityFlags.PLAYER)).toBe(true);
      expect(StateAccess.hasFlag(world, 1, EntityFlags.BOT)).toBe(true);
    });

    it('should activate and deactivate entities', () => {
      StateAccess.activate(world, 0);
      expect(StateAccess.isActive(world, 0)).toBe(true);

      StateAccess.deactivate(world, 0);
      expect(StateAccess.isActive(world, 0)).toBe(false);
    });

    it('should mark entities as dead', () => {
      StateAccess.markDead(world, 0);
      expect(StateAccess.isDead(world, 0)).toBe(true);
    });
  });

  describe('InputAccess', () => {
    it('should set and get target position correctly', () => {
      InputAccess.setTargetX(world, 0, 300);
      InputAccess.setTargetY(world, 0, 400);

      expect(InputAccess.getTargetX(world, 0)).toBe(300);
      expect(InputAccess.getTargetY(world, 0)).toBe(400);
    });

    it('should handle multiple entities independently', () => {
      InputAccess.setTargetX(world, 0, 100);
      InputAccess.setTargetY(world, 0, 200);
      InputAccess.setTargetX(world, 1, 500);
      InputAccess.setTargetY(world, 1, 600);

      expect(InputAccess.getTargetX(world, 0)).toBe(100);
      expect(InputAccess.getTargetY(world, 0)).toBe(200);
      expect(InputAccess.getTargetX(world, 1)).toBe(500);
      expect(InputAccess.getTargetY(world, 1)).toBe(600);
    });
  });

  describe('ConfigAccess', () => {
    it('should set and get magneticRadius correctly', () => {
      ConfigAccess.setMagneticRadius(world, 0, 50);
      expect(ConfigAccess.getMagneticRadius(world, 0)).toBe(50);
    });

    it('should set and get speedMult correctly', () => {
      ConfigAccess.setSpeedMult(world, 0, 1.5);
      expect(ConfigAccess.getSpeedMult(world, 0)).toBe(1.5);
    });
  });

  describe('SkillAccess', () => {
    it('should set and get cooldown correctly', () => {
      SkillAccess.setCooldown(world, 0, 5.5);
      expect(SkillAccess.getCooldown(world, 0)).toBe(5.5);
    });

    it('should set and get maxCooldown correctly', () => {
      SkillAccess.setMaxCooldown(world, 0, 10);
      expect(SkillAccess.getMaxCooldown(world, 0)).toBe(10);
    });

    it('should set and get activeTimer correctly', () => {
      SkillAccess.setActiveTimer(world, 0, 2.5);
      expect(SkillAccess.getActiveTimer(world, 0)).toBe(2.5);
    });

    it('should set all values at once', () => {
      // SkillAccess.set takes: world, id, cooldown, maxCooldown, activeTimer, shapeId
      SkillAccess.set(world, 0, 5.0, 10.0, 2.0, 1);

      expect(SkillAccess.getCooldown(world, 0)).toBe(5.0);
      expect(SkillAccess.getMaxCooldown(world, 0)).toBe(10.0);
      expect(SkillAccess.getActiveTimer(world, 0)).toBe(2.0);
    });
  });

  describe('ProjectileAccess', () => {
    it('should set all properties at once', () => {
      ProjectileAccess.set(world, 0, 1, 25, 3.5, 2);

      expect(ProjectileAccess.getOwnerId(world, 0)).toBe(1);
      expect(ProjectileAccess.getDamage(world, 0)).toBe(25);
      expect(ProjectileAccess.getDuration(world, 0)).toBe(3.5);
      expect(ProjectileAccess.getTypeId(world, 0)).toBe(2);
    });
  });

  describe('WorldState.reset', () => {
    it('should reset all stores to zero', () => {
      // Set some values
      TransformAccess.setX(world, 0, 100);
      StateAccess.activate(world, 0);
      StatsAccess.setScore(world, 0, 1000);

      // Reset
      world.reset();

      // Verify reset
      expect(TransformAccess.getX(world, 0)).toBe(0);
      expect(StateAccess.isActive(world, 0)).toBe(false);
      expect(StatsAccess.getScore(world, 0)).toBe(0);
    });

    it('should handle multiple entities', () => {
      for (let i = 0; i < 10; i++) {
        TransformAccess.setX(world, i, i * 10);
        StateAccess.activate(world, i);
      }

      world.reset();

      for (let i = 0; i < 10; i++) {
        expect(TransformAccess.getX(world, i)).toBe(0);
        expect(StateAccess.isActive(world, i)).toBe(false);
      }
    });
  });

  describe('Edge Cases', () => {
    it('should handle float precision correctly', () => {
      TransformAccess.setX(world, 0, 0.1);
      TransformAccess.setY(world, 0, 0.2);

      // Float32Array has precision limits
      expect(TransformAccess.getX(world, 0)).toBeCloseTo(0.1, 5);
      expect(TransformAccess.getY(world, 0)).toBeCloseTo(0.2, 5);
    });

    it('should handle very large values', () => {
      TransformAccess.setX(world, 0, 1e6);
      TransformAccess.setY(world, 0, 1e7);

      expect(TransformAccess.getX(world, 0)).toBe(1e6);
      expect(TransformAccess.getY(world, 0)).toBe(1e7);
    });

    it('should handle concurrent modifications', () => {
      const iterations = 100;

      for (let i = 0; i < iterations; i++) {
        TransformAccess.setX(world, i % 10, i);
      }

      // Last 10 values should be set correctly
      for (let i = iterations - 10; i < iterations; i++) {
        const index = i % 10;
        expect(TransformAccess.getX(world, index)).toBeGreaterThanOrEqual(iterations - 10);
      }
    });
  });
});
