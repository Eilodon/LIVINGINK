/**
 * Integration Tests: Physics Accuracy
 * Tests physics system correctness and determinism
 * 
 * EIDOLON-V: Migrated from legacy *Store wrappers to *Access pattern
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  PhysicsSystem,
  MovementSystem,
  TransformAccess,
  PhysicsAccess,
  InputAccess,
  StateAccess,
  ConfigAccess,
  EntityFlags,
  WorldState,
} from '@cjr/engine';

// EIDOLON-V FIX: Use instance-based WorldState instead of defaultWorld singleton
let w: WorldState;

describe('Physics Accuracy', () => {
  beforeEach(() => {
    // Create fresh WorldState for each test (isolation)
    w = new WorldState();
  });

  describe('Physics System', () => {
    it('should apply friction correctly', () => {
      const entityId = 0;
      const initialVx = 100;
      const friction = 0.92;

      TransformAccess.set(w, entityId, 0, 0, 0, 1, 0, 0, 0);
      PhysicsAccess.set(w, entityId, initialVx, 0, 0, 100, 28, 0.5, friction);
      StateAccess.activate(w, entityId);

      // Run physics for 1 second at 60fps
      for (let i = 0; i < 60; i++) {
        PhysicsSystem.update(w, 1 / 60);
      }

      const finalVx = PhysicsAccess.getVx(w, entityId);
      const expectedVx = initialVx * Math.pow(friction, 60);

      expect(finalVx).toBeCloseTo(expectedVx, 1);
      expect(finalVx).toBeLessThan(initialVx);
    });

    it('should integrate position correctly', () => {
      const entityId = 0;
      const vx = 60; // 60 units per second

      TransformAccess.set(w, entityId, 0, 0, 0, 1, 0, 0, 0);
      // Use friction=1.0 (no friction) for pure integration test
      PhysicsAccess.set(w, entityId, vx, 0, 0, 100, 28, 0.5, 1.0);
      StateAccess.activate(w, entityId);

      // Run physics for exactly 1 second
      PhysicsSystem.update(w, 1);

      const finalX = TransformAccess.getX(w, entityId);
      // Position should be vx * dt * 10 (physics scale factor)
      // vx=60, dt=1, scale=10 => 600 units
      expect(finalX).toBeCloseTo(600, 1);
    });

    it('should enforce map boundary', () => {
      const entityId = 0;
      const MAP_RADIUS = 2500;

      // Start near boundary, moving outward
      TransformAccess.set(w, entityId, MAP_RADIUS - 50, 0, 0, 1, 0, 0, 0);
      PhysicsAccess.set(w, entityId, 100, 0, 0, 100, 100, 0.5, 0.9);
      StateAccess.activate(w, entityId);

      // Run physics - should bounce at boundary
      for (let i = 0; i < 60; i++) {
        PhysicsSystem.update(w, 1 / 60);
      }

      const finalX = TransformAccess.getX(w, entityId);
      const finalY = TransformAccess.getY(w, entityId);
      const distFromCenter = Math.sqrt(finalX * finalX + finalY * finalY);

      // Should be clamped inside boundary
      expect(distFromCenter).toBeLessThanOrEqual(MAP_RADIUS);
    });

    it('should maintain energy conservation (approximately)', () => {
      const entityId = 0;
      const initialSpeed = 100;

      TransformAccess.set(w, entityId, 0, 0, 0, 1, 0, 0, 0);
      PhysicsAccess.set(w, entityId, initialSpeed, 0, 0, 100, 28, 1.0, 1.0); // No friction, perfect bounce
      StateAccess.activate(w, entityId);

      // Store initial kinetic energy
      const initialEnergy = 0.5 * 100 * initialSpeed * initialSpeed;

      // Run physics with boundary hits
      for (let i = 0; i < 120; i++) {
        PhysicsSystem.update(w, 1 / 60);
      }

      const vx = PhysicsAccess.getVx(w, entityId);
      const vy = PhysicsAccess.getVy(w, entityId);
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

      TransformAccess.set(w, entityId, startX, startY, 0, 1, 0, 0, 0);
      PhysicsAccess.set(w, entityId, 0, 0, 0, 100, 28, 0.5, 0.9);
      InputAccess.set(w, entityId, targetX, targetY, 0);
      ConfigAccess.set(w, entityId, 0, 1, 1, 0, 0, 150); // maxSpeed = 150
      StateAccess.activate(w, entityId);

      const initialDist = Math.abs(targetX - startX);

      // Run movement for 30 frames
      for (let i = 0; i < 30; i++) {
        MovementSystem.update(w, entityId, 1 / 60);
        PhysicsSystem.update(w, 1 / 60);
      }

      const currentX = TransformAccess.getX(w, entityId);
      const currentDist = Math.abs(targetX - currentX);

      // Should have moved closer to target
      expect(currentX).toBeGreaterThan(startX);
      expect(currentDist).toBeLessThan(initialDist);
    });

    it('should stop at target (deadzone)', () => {
      const entityId = 0;

      TransformAccess.set(w, entityId, 0, 0, 0, 1, 0, 0, 0);
      PhysicsAccess.set(w, entityId, 0, 0, 0, 100, 28, 0.5, 0.9);
      // Target very close (within deadzone of 1 unit)
      InputAccess.set(w, entityId, 0.5, 0.5, 0);
      StateAccess.activate(w, entityId);

      const initialVx = PhysicsAccess.getVx(w, entityId);

      MovementSystem.update(w, entityId, 1 / 60);

      const finalVx = PhysicsAccess.getVx(w, entityId);

      // Velocity should remain unchanged (deadzone)
      expect(finalVx).toBe(initialVx);
    });

    it('should respect speed multiplier', () => {
      const entityId = 0;
      const baseMaxSpeed = 150;
      const speedMultiplier = 1.5;

      TransformAccess.set(w, entityId, 0, 0, 0, 1, 0, 0, 0);
      PhysicsAccess.set(w, entityId, 0, 0, 0, 100, 28, 0.5, 0.9);
      InputAccess.set(w, entityId, 1000, 0, 0);
      ConfigAccess.set(w, entityId, 0, 1, speedMultiplier, 0, 0, baseMaxSpeed);
      StateAccess.activate(w, entityId);

      // Accelerate towards target
      for (let i = 0; i < 60; i++) {
        MovementSystem.update(w, entityId, 1 / 60);
      }

      const vx = PhysicsAccess.getVx(w, entityId);
      const vy = PhysicsAccess.getVy(w, entityId);
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
        // Create fresh WorldState for each run
        w = new WorldState();

        const entityId = 0;
        TransformAccess.set(w, entityId, 100, 200, 0, 1, 0, 0, 0);
        PhysicsAccess.set(w, entityId, 50, 30, 0, 100, 28, 0.5, 0.9);
        InputAccess.set(w, entityId, 500, 400, 0);
        ConfigAccess.set(w, entityId, 0, 1, 1, 0, 0, 150);
        StateAccess.activate(w, entityId);

        // Run for 2 seconds
        for (let i = 0; i < 120; i++) {
          MovementSystem.update(w, entityId, 1 / 60);
          PhysicsSystem.update(w, 1 / 60);
        }

        results.push({
          x: TransformAccess.getX(w, entityId),
          y: TransformAccess.getY(w, entityId),
          vx: PhysicsAccess.getVx(w, entityId),
          vy: PhysicsAccess.getVy(w, entityId),
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
      w = new WorldState();
      TransformAccess.set(w, entityId, 0, 0, 0, 1, 0, 0, 0);
      PhysicsAccess.set(w, entityId, 60, 0, 0, 100, 28, 0.5, 1.0); // friction=1.0
      StateAccess.activate(w, entityId);

      for (let i = 0; i < 60; i++) {
        PhysicsSystem.update(w, 1 / 60);
      }
      const fixedTimestepPos = TransformAccess.getX(w, entityId);

      // Run with variable timestep (equivalent total time), no friction
      w = new WorldState();
      TransformAccess.set(w, entityId, 0, 0, 0, 1, 0, 0, 0);
      PhysicsAccess.set(w, entityId, 60, 0, 0, 100, 28, 0.5, 1.0); // friction=1.0
      StateAccess.activate(w, entityId);

      // Two updates: 0.3s and 0.7s = 1s total
      PhysicsSystem.update(w, 0.3);
      PhysicsSystem.update(w, 0.7);
      const variableTimestepPos = TransformAccess.getX(w, entityId);

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
        TransformAccess.set(w, i, i * 100, 0, 0, 1, 0, 0, 0);
        PhysicsAccess.set(w, i, 10 * (i + 1), 0, 0, 100, 28, 0.5, 0.9);
        InputAccess.set(w, i, 1000, i * 50, 0);
        ConfigAccess.set(w, i, 0, 1, 1, 0, 0, 100 + i * 10);
        StateAccess.activate(w, i);
      }

      // Run physics
      for (let frame = 0; frame < 60; frame++) {
        for (let i = 0; i < entityCount; i++) {
          MovementSystem.update(w, i, 1 / 60);
        }
        PhysicsSystem.update(w, 1 / 60);
      }

      // Each entity should have moved
      for (let i = 0; i < entityCount; i++) {
        const x = TransformAccess.getX(w, i);
        expect(x).toBeGreaterThan(i * 100); // Moved from start position
      }
    });
  });
});

describe('Performance', () => {
  it('should handle 100 entities at 60fps', () => {
    const entityCount = 100;
    const targetFrameTime = 1000 / 60; // ~16.67ms per frame

    // Fresh WorldState for perf test
    w = new WorldState();

    // Setup entities (use PRNG.next() when available, for now use deterministic setup)
    for (let i = 0; i < entityCount; i++) {
      const x = (i * 17) % 1000; // Pseudo-random but deterministic
      const y = (i * 31) % 1000;
      TransformAccess.set(w, i, x, y, 0, 1, 0, 0, 0);
      PhysicsAccess.set(w, i, (i * 7) % 50, (i * 11) % 50, 0, 100, 28, 0.5, 0.9);
      InputAccess.set(w, i, (i * 13) % 1000, (i * 19) % 1000, 0);
      ConfigAccess.set(w, i, 0, 1, 1, 0, 0, 150);
      StateAccess.activate(w, i);
    }

    // Measure time for 60 frames
    const startTime = performance.now();

    for (let frame = 0; frame < 60; frame++) {
      // MovementSystem (per-entity)
      for (let i = 0; i < entityCount; i++) {
        MovementSystem.update(w, i, 1 / 60);
      }
      // PhysicsSystem (batch)
      PhysicsSystem.update(w, 1 / 60);
    }

    const endTime = performance.now();
    const totalTime = endTime - startTime;
    const avgFrameTime = totalTime / 60;

    // Should complete within reasonable time (allow 2x target for test environment)
    expect(avgFrameTime).toBeLessThan(targetFrameTime * 2);
  });
});
