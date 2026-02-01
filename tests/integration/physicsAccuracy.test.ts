/**
 * Integration Tests: Physics Accuracy
 * Tests physics system correctness and determinism
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  PhysicsSystem,
  MovementSystem,
  TransformStore,
  PhysicsStore,
  InputStore,
  StateStore,
  ConfigStore,
  resetAllStores,
  EntityFlags,
} from '@cjr/engine';

describe('Physics Accuracy', () => {
  beforeEach(() => {
    resetAllStores();
  });

  describe('Physics System', () => {
    it('should apply friction correctly', () => {
      const entityId = 0;
      const initialVx = 100;
      const friction = 0.92;

      TransformStore.set(entityId, 0, 0, 0, 1);
      PhysicsStore.set(entityId, initialVx, 0, 100, 28, 0.5, friction);
      StateStore.setFlag(entityId, EntityFlags.ACTIVE);

      // Run physics for 1 second at 60fps
      for (let i = 0; i < 60; i++) {
        PhysicsSystem.update(1 / 60);
      }

      const finalVx = PhysicsStore.getVelocityX(entityId);
      const expectedVx = initialVx * Math.pow(friction, 60);

      expect(finalVx).toBeCloseTo(expectedVx, 1);
      expect(finalVx).toBeLessThan(initialVx);
    });

    it('should integrate position correctly', () => {
      const entityId = 0;
      const vx = 60; // 60 units per second

      TransformStore.set(entityId, 0, 0, 0, 1);
      // Use friction=1.0 (no friction) for pure integration test
      PhysicsStore.set(entityId, vx, 0, 100, 28, 0.5, 1.0);
      StateStore.setFlag(entityId, EntityFlags.ACTIVE);

      // Run physics for exactly 1 second
      PhysicsSystem.update(1);

      const finalX = TransformStore.getX(entityId);
      // Position should be vx * dt * 10 (physics scale factor)
      // vx=60, dt=1, scale=10 => 600 units
      expect(finalX).toBeCloseTo(600, 1);
    });

    it('should enforce map boundary', () => {
      const entityId = 0;
      const MAP_RADIUS = 2500;

      // Start near boundary, moving outward
      TransformStore.set(entityId, MAP_RADIUS - 50, 0, 0, 1);
      PhysicsStore.set(entityId, 100, 0, 100, 100); // Large radius
      StateStore.setFlag(entityId, EntityFlags.ACTIVE);

      // Run physics - should bounce at boundary
      for (let i = 0; i < 60; i++) {
        PhysicsSystem.update(1 / 60);
      }

      const finalX = TransformStore.getX(entityId);
      const finalY = TransformStore.getY(entityId);
      const distFromCenter = Math.sqrt(finalX * finalX + finalY * finalY);

      // Should be clamped inside boundary
      expect(distFromCenter).toBeLessThanOrEqual(MAP_RADIUS);
    });

    it('should maintain energy conservation (approximately)', () => {
      const entityId = 0;
      const initialSpeed = 100;

      TransformStore.set(entityId, 0, 0, 0, 1);
      PhysicsStore.set(entityId, initialSpeed, 0, 100, 28, 1.0, 1.0); // No friction, perfect bounce
      StateStore.setFlag(entityId, EntityFlags.ACTIVE);

      // Store initial kinetic energy
      const initialEnergy = 0.5 * 100 * initialSpeed * initialSpeed;

      // Run physics with boundary hits
      for (let i = 0; i < 120; i++) {
        PhysicsSystem.update(1 / 60);
      }

      const vx = PhysicsStore.getVelocityX(entityId);
      const vy = PhysicsStore.getVelocityY(entityId);
      const finalSpeed = Math.sqrt(vx * vx + vy * vy);
      const finalEnergy = 0.5 * 100 * finalSpeed * finalSpeed;

      // Energy should be conserved (approximately, within numerical error)
      const energyRatio = finalEnergy / initialEnergy;
      expect(energyRatio).toBeGreaterThan(0.8);
      expect(energyRatio).toBeLessThan(1.2);
    });
  });

  describe('Movement System', () => {
    it('should accelerate towards target', () => {
      const entityId = 0;
      const startX = 0, startY = 0;
      const targetX = 300, targetY = 0;

      TransformStore.set(entityId, startX, startY, 0, 1);
      PhysicsStore.set(entityId, 0, 0, 100, 28);
      InputStore.setTarget(entityId, targetX, targetY);
      ConfigStore.setMaxSpeed(entityId, 150);
      StateStore.setFlag(entityId, EntityFlags.ACTIVE);

      const initialDist = Math.abs(targetX - startX);

      // Run movement for 30 frames
      for (let i = 0; i < 30; i++) {
        MovementSystem.update(entityId, 1 / 60);
        PhysicsSystem.update(1 / 60);
      }

      const currentX = TransformStore.getX(entityId);
      const currentDist = Math.abs(targetX - currentX);

      // Should have moved closer to target
      expect(currentX).toBeGreaterThan(startX);
      expect(currentDist).toBeLessThan(initialDist);
    });

    it('should stop at target (deadzone)', () => {
      const entityId = 0;

      TransformStore.set(entityId, 0, 0, 0, 1);
      PhysicsStore.set(entityId, 0, 0, 100, 28);
      // Target very close (within deadzone of 1 unit)
      InputStore.setTarget(entityId, 0.5, 0.5);
      StateStore.setFlag(entityId, EntityFlags.ACTIVE);

      const initialVx = PhysicsStore.getVelocityX(entityId);

      MovementSystem.update(entityId, 1 / 60);

      const finalVx = PhysicsStore.getVelocityX(entityId);

      // Velocity should remain unchanged (deadzone)
      expect(finalVx).toBe(initialVx);
    });

    it('should respect speed multiplier', () => {
      const entityId = 0;
      const baseMaxSpeed = 150;
      const speedMultiplier = 1.5;

      TransformStore.set(entityId, 0, 0, 0, 1);
      PhysicsStore.set(entityId, 0, 0, 100, 28);
      InputStore.setTarget(entityId, 1000, 0);
      ConfigStore.setMaxSpeed(entityId, baseMaxSpeed);
      ConfigStore.setSpeedMultiplier(entityId, speedMultiplier);
      StateStore.setFlag(entityId, EntityFlags.ACTIVE);

      // Accelerate towards target
      for (let i = 0; i < 60; i++) {
        MovementSystem.update(entityId, 1 / 60);
      }

      const vx = PhysicsStore.getVelocityX(entityId);
      const vy = PhysicsStore.getVelocityY(entityId);
      const speed = Math.sqrt(vx * vx + vy * vy);

      // Speed should not exceed max * multiplier
      expect(speed).toBeLessThanOrEqual(baseMaxSpeed * speedMultiplier * 1.01);
    });
  });

  describe('Determinism', () => {
    it('should produce same result given same inputs', () => {
      // Run simulation twice with same inputs
      const results: { x: number; y: number; vx: number; vy: number }[] = [];

      for (let run = 0; run < 2; run++) {
        resetAllStores();

        const entityId = 0;
        TransformStore.set(entityId, 100, 200, 0, 1);
        PhysicsStore.set(entityId, 50, 30, 100, 28);
        InputStore.setTarget(entityId, 500, 400);
        ConfigStore.setMaxSpeed(entityId, 150);
        StateStore.setFlag(entityId, EntityFlags.ACTIVE);

        // Run for 2 seconds
        for (let i = 0; i < 120; i++) {
          MovementSystem.update(entityId, 1 / 60);
          PhysicsSystem.update(1 / 60);
        }

        results.push({
          x: TransformStore.getX(entityId),
          y: TransformStore.getY(entityId),
          vx: PhysicsStore.getVelocityX(entityId),
          vy: PhysicsStore.getVelocityY(entityId),
        });
      }

      // Both runs should produce identical results
      expect(results[0].x).toBeCloseTo(results[1].x, 5);
      expect(results[0].y).toBeCloseTo(results[1].y, 5);
      expect(results[0].vx).toBeCloseTo(results[1].vx, 5);
      expect(results[0].vy).toBeCloseTo(results[1].vy, 5);
    });

    it('should handle variable timestep gracefully', () => {
      const entityId = 0;

      // Run with fixed timestep (60fps), no friction
      resetAllStores();
      TransformStore.set(entityId, 0, 0, 0, 1);
      PhysicsStore.set(entityId, 60, 0, 100, 28, 0.5, 1.0); // friction=1.0
      StateStore.setFlag(entityId, EntityFlags.ACTIVE);

      for (let i = 0; i < 60; i++) {
        PhysicsSystem.update(1 / 60);
      }
      const fixedTimestepPos = TransformStore.getX(entityId);

      // Run with variable timestep (equivalent total time), no friction
      resetAllStores();
      TransformStore.set(entityId, 0, 0, 0, 1);
      PhysicsStore.set(entityId, 60, 0, 100, 28, 0.5, 1.0); // friction=1.0
      StateStore.setFlag(entityId, EntityFlags.ACTIVE);

      // Two updates: 0.3s and 0.7s = 1s total
      PhysicsSystem.update(0.3);
      PhysicsSystem.update(0.7);
      const variableTimestepPos = TransformStore.getX(entityId);

      // Positions should be very similar (Euler integration is 1st order)
      const diff = Math.abs(fixedTimestepPos - variableTimestepPos);
      expect(diff).toBeLessThan(50); // Small tolerance for numerical differences
    });
  });

  describe('Collision Avoidance', () => {
    it('should handle multiple entities without interference', () => {
      const entityCount = 5;

      // Create multiple entities
      for (let i = 0; i < entityCount; i++) {
        TransformStore.set(i, i * 100, 0, 0, 1);
        PhysicsStore.set(i, 10 * (i + 1), 0, 100, 28);
        InputStore.setTarget(i, 1000, i * 50);
        ConfigStore.setMaxSpeed(i, 100 + i * 10);
        StateStore.setFlag(i, EntityFlags.ACTIVE);
      }

      // Run physics
      for (let frame = 0; frame < 60; frame++) {
        for (let i = 0; i < entityCount; i++) {
          MovementSystem.update(i, 1 / 60);
        }
        PhysicsSystem.update(1 / 60);
      }

      // Each entity should have moved
      for (let i = 0; i < entityCount; i++) {
        const x = TransformStore.getX(i);
        expect(x).toBeGreaterThan(i * 100); // Moved from start position
      }
    });
  });
});

describe('Performance', () => {
  it('should handle 100 entities at 60fps', () => {
    const entityCount = 100;
    const targetFrameTime = 1000 / 60; // ~16.67ms per frame

    // Setup entities
    for (let i = 0; i < entityCount; i++) {
      TransformStore.set(i, Math.random() * 1000, Math.random() * 1000, 0, 1);
      PhysicsStore.set(i, Math.random() * 50, Math.random() * 50, 100, 28);
      InputStore.setTarget(i, Math.random() * 1000, Math.random() * 1000);
      ConfigStore.setMaxSpeed(i, 150);
      StateStore.setFlag(i, EntityFlags.ACTIVE);
    }

    // Measure time for 60 frames
    const startTime = performance.now();

    for (let frame = 0; frame < 60; frame++) {
      // MovementSystem (per-entity)
      for (let i = 0; i < entityCount; i++) {
        MovementSystem.update(i, 1 / 60);
      }
      // PhysicsSystem (batch)
      PhysicsSystem.update(1 / 60);
    }

    const endTime = performance.now();
    const totalTime = endTime - startTime;
    const avgFrameTime = totalTime / 60;

    // Should complete within reasonable time (allow 2x target for test environment)
    expect(avgFrameTime).toBeLessThan(targetFrameTime * 2);
  });
});
