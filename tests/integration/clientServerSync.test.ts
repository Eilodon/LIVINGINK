/**
 * Integration Tests: Client-Server Sync
 * Tests authoritative server physics sync with client prediction
 * 
 * EIDOLON-V: Migrated to Access APIs (removed compat layer dependency)
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
  MAX_ENTITIES,
  RING_RADII_SQ,
  THRESHOLDS,
  checkRingTransition,
  defaultWorld,
} from '@cjr/engine';
// EIDOLON-V AUDIT FIX: Use new SchemaBinaryPacker API
import { SchemaBinaryPacker } from '@cjr/engine/networking';

const w = defaultWorld;

describe('Client-Server Sync', () => {
  beforeEach(() => {
    w.reset();
  });

  describe('Entity State Sync', () => {
    it('should pack transform data from WorldState to binary buffer', () => {
      // Setup: Create entity at position (100, 200)
      const entityId = 0;
      TransformAccess.set(w, entityId, 100, 200, 0, 1, 100, 200, 0);
      PhysicsAccess.set(w, entityId, 50, 0, 0, 100, 28, 0.5, 0.9);
      StateAccess.activate(w, entityId);

      // Pack transform using new API
      const buffer = SchemaBinaryPacker.packTransformSnapshot(w, 0);
      expect(buffer).toBeDefined();
      expect(buffer.byteLength).toBeGreaterThan(0);

      // Verify buffer contains header + at least one entity
      // Header: Type(1) + Timestamp(4) + Count(2) = 7 bytes
      // Per entity: ID(2) + X(4) + Y(4) = 10 bytes
      expect(buffer.byteLength).toBe(7 + 10);
    });

    it('should handle multiple entity sync', () => {
      const entityCount = 5;

      // Create multiple entities
      for (let i = 0; i < entityCount; i++) {
        TransformAccess.set(w, i, i * 100, i * 50, 0, 1, i * 100, i * 50, 0);
        PhysicsAccess.set(w, i, i * 10, i * 5, 0, 100, 28, 0.5, 0.9);
        StateAccess.activate(w, i);
      }

      const buffer = SchemaBinaryPacker.packTransformSnapshot(w, 0);

      // Should pack all 5 entities
      // Header: 7 bytes
      // Per entity: 10 bytes * 5 = 50 bytes
      expect(buffer.byteLength).toBe(7 + 10 * entityCount);
    });
  });

  describe('Input Application', () => {
    it('should apply target input and update position', () => {
      const entityId = 0;
      const startX = 0, startY = 0;

      // Setup entity
      TransformAccess.set(w, entityId, startX, startY, 0, 1, startX, startY, 0);
      PhysicsAccess.set(w, entityId, 0, 0, 0, 100, 28, 0.5, 0.9);
      InputAccess.setTargetX(w, entityId, 500);
      InputAccess.setTargetY(w, entityId, 0);
      ConfigAccess.setMaxSpeed(w, entityId, 150);
      StateAccess.activate(w, entityId);

      // Run physics for 60 frames (1 second at 60fps)
      for (let i = 0; i < 60; i++) {
        MovementSystem.update(w, entityId, 1 / 60);
        PhysicsSystem.update(w, 1 / 60);
      }

      // Entity should have moved towards target
      const finalX = TransformAccess.getX(w, entityId);
      expect(finalX).toBeGreaterThan(startX);
      expect(finalX).toBeLessThan(500); // Shouldn't overshoot in 1 second
    });

    it('should respect max speed limit', () => {
      const entityId = 0;
      const maxSpeed = 100;

      TransformAccess.set(w, entityId, 0, 0, 0, 1, 0, 0, 0);
      PhysicsAccess.set(w, entityId, 0, 0, 0, 100, 28, 0.5, 0.9);
      InputAccess.setTargetX(w, entityId, 1000);
      InputAccess.setTargetY(w, entityId, 0);
      ConfigAccess.setMaxSpeed(w, entityId, maxSpeed);
      StateAccess.activate(w, entityId);

      // Apply movement
      MovementSystem.update(w, entityId, 1 / 60);

      const vx = PhysicsAccess.getVx(w, entityId);
      const vy = PhysicsAccess.getVy(w, entityId);
      const speed = Math.sqrt(vx * vx + vy * vy);

      expect(speed).toBeLessThanOrEqual(maxSpeed * 1.01); // Allow small tolerance
    });
  });

  describe('Ring Transition Sync', () => {
    it('should correctly detect ring based on position', () => {
      const entityId = 0;

      // Setup entity at ring 1 (outer)
      const ring1X = 1200; // Between R2 (1000) and R1 (1600)
      TransformAccess.set(w, entityId, ring1X, 0, 0, 1, ring1X, 0, 0);

      const entity = {
        physicsIndex: entityId,
        position: { x: ring1X, y: 0 },
        velocity: { x: 0, y: 0 },
        ring: 1 as 1 | 2 | 3,
        matchPercent: 0.6,
        isDead: false,
        statusScalars: {},
        statusMultipliers: {},
        statusTimers: {},
      };

      // Move entity to ring 2 position
      entity.position.x = 800; // Inside R2
      TransformAccess.setX(w, entityId, 800);
      TransformAccess.setY(w, entityId, 0);

      const result = checkRingTransition(entity);

      expect(result.transitioned).toBe(true);
      expect(result.newRing).toBe(2);
    });

    it('should block transition without sufficient match percent', () => {
      const entityId = 0;

      TransformAccess.set(w, entityId, 800, 0, 0, 1, 800, 0, 0);

      const entity = {
        physicsIndex: entityId,
        position: { x: 800, y: 0 },
        velocity: { x: 0, y: 0 },
        ring: 1 as 1 | 2 | 3,
        matchPercent: 0.3, // Below ENTER_RING2 threshold (0.5)
        isDead: false,
        statusScalars: {},
        statusMultipliers: {},
        statusTimers: {},
      };

      const result = checkRingTransition(entity);

      expect(result.transitioned).toBe(false);
      expect(entity.ring).toBe(1); // Still in ring 1
    });
  });

  describe('Server Authority Validation', () => {
    it('should detect speed violations', () => {
      const entityId = 0;
      const maxAllowedSpeed = 150;
      const tolerance = 1.15;

      TransformAccess.set(w, entityId, 0, 0, 0, 1, 0, 0, 0);
      // Set velocity above limit (simulating client hack)
      PhysicsAccess.set(w, entityId, 200, 0, 0, 100, 28, 0.5, 0.9);
      StateAccess.activate(w, entityId);

      const vx = PhysicsAccess.getVx(w, entityId);
      const vy = PhysicsAccess.getVy(w, entityId);
      const speed = Math.sqrt(vx * vx + vy * vy);

      // Server validation check
      const isViolating = speed > maxAllowedSpeed * tolerance;
      expect(isViolating).toBe(true);

      // Apply clamp
      if (isViolating) {
        const scale = (maxAllowedSpeed * tolerance) / speed;
        PhysicsAccess.setVx(w, entityId, vx * scale);
        PhysicsAccess.setVy(w, entityId, vy * scale);
      }

      const newSpeed = Math.sqrt(
        PhysicsAccess.getVx(w, entityId) ** 2 +
        PhysicsAccess.getVy(w, entityId) ** 2
      );
      expect(newSpeed).toBeLessThanOrEqual(maxAllowedSpeed * tolerance * 1.01);
    });
  });
});

describe('Network Protocol', () => {
  beforeEach(() => {
    w.reset();
  });

  it('should pack binary buffer with correct header format', () => {
    // Setup entity
    const entityId = 0;
    TransformAccess.set(w, entityId, 100, 200, 0, 1, 100, 200, 0);
    StateAccess.activate(w, entityId);

    const timestamp = 1234.5;
    const buffer = SchemaBinaryPacker.packTransformSnapshot(w, timestamp);

    // Verify header
    const view = new DataView(buffer);

    // Type byte (offset 0)
    const packetType = view.getUint8(0);
    expect(packetType).toBe(1); // SchemaPacketType.TRANSFORM_UPDATE

    // Timestamp (offset 1, float32 LE)
    const packedTimestamp = view.getFloat32(1, true);
    expect(packedTimestamp).toBeCloseTo(timestamp, 3);

    // Count (offset 5, uint16 LE)
    const count = view.getUint16(5, true);
    expect(count).toBe(1); // One entity
  });

  it('should pack entity data with correct format', () => {
    const entityId = 5;
    const testX = 123.456;
    const testY = 789.012;

    TransformAccess.set(w, entityId, testX, testY, 0, 1, testX, testY, 0);
    StateAccess.activate(w, entityId);

    const buffer = SchemaBinaryPacker.packTransformSnapshot(w, 0);
    const view = new DataView(buffer);

    // Entity data starts at offset 7
    // EntityId (offset 7, uint16 LE)
    const packedId = view.getUint16(7, true);
    expect(packedId).toBe(entityId);

    // X (offset 9, float32 LE)
    const packedX = view.getFloat32(9, true);
    expect(packedX).toBeCloseTo(testX, 3);

    // Y (offset 13, float32 LE)
    const packedY = view.getFloat32(13, true);
    expect(packedY).toBeCloseTo(testY, 3);
  });
});
