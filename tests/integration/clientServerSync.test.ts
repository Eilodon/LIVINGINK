/**
 * Integration Tests: Client-Server Sync
 * Tests authoritative server physics sync with client prediction
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
  StatsStore,
  resetAllStores,
  EntityFlags,
  MAX_ENTITIES,
  RING_RADII_SQ,
  THRESHOLDS,
  checkRingTransition,
  defaultWorld,
} from '@cjr/engine';
// EIDOLON-V AUDIT FIX: BinaryPacker was deleted, replaced by SchemaBinaryPacker in networking subpath
import { SchemaBinaryPacker as BinaryPacker } from '@cjr/engine/networking';

const w = defaultWorld;

describe('Client-Server Sync', () => {
  beforeEach(() => {
    resetAllStores();
  });

  describe('Entity State Sync', () => {
    it('should sync position from TransformStore to network buffer', () => {
      // Setup: Create entity at position (100, 200)
      const entityId = 0;
      TransformStore.set(w, entityId, 100, 200, 0, 1);
      PhysicsStore.set(w, entityId, 50, 0, 100, 28);
      StateStore.setFlag(w, entityId, EntityFlags.ACTIVE);

      // Pack transform for network
      const updates = [{
        id: 'player1',
        x: TransformStore.getX(w, entityId),
        y: TransformStore.getY(w, entityId),
        vx: PhysicsStore.getVelocityX(w, entityId),
        vy: PhysicsStore.getVelocityY(w, entityId),
      }];

      const buffer = BinaryPacker.packTransforms(updates, 0);
      expect(buffer).toBeDefined();
      expect(buffer.byteLength).toBeGreaterThan(0);

      // Unpack and verify
      let unpackedX = 0, unpackedY = 0, unpackedVx = 0;
      BinaryPacker.unpackAndApply(buffer, (id, x, y, vx, vy) => {
        expect(id).toBe('player1');
        unpackedX = x;
        unpackedY = y;
        unpackedVx = vx;
      });

      expect(unpackedX).toBeCloseTo(100, 3);
      expect(unpackedY).toBeCloseTo(200, 3);
      expect(unpackedVx).toBeCloseTo(50, 3);
    });

    it('should handle multiple entity sync', () => {
      const entityCount = 5;
      const updates: { id: string; x: number; y: number; vx: number; vy: number }[] = [];

      // Create multiple entities
      for (let i = 0; i < entityCount; i++) {
        TransformStore.set(w, i, i * 100, i * 50, 0, 1);
        PhysicsStore.set(w, i, i * 10, i * 5, 100, 28);
        StateStore.setFlag(w, i, EntityFlags.ACTIVE);

        updates.push({
          id: `player${i}`,
          x: TransformStore.getX(w, i),
          y: TransformStore.getY(w, i),
          vx: PhysicsStore.getVelocityX(w, i),
          vy: PhysicsStore.getVelocityY(w, i),
        });
      }

      const buffer = BinaryPacker.packTransforms(updates, 0);
      const receivedUpdates: any[] = [];

      BinaryPacker.unpackAndApply(buffer, (id, x, y, vx, vy) => {
        receivedUpdates.push({ id, x, y, vx, vy });
      });

      expect(receivedUpdates.length).toBe(entityCount);
      expect(receivedUpdates[0].id).toBe('player0');
      expect(receivedUpdates[4].id).toBe('player4');
    });
  });

  describe('Input Application', () => {
    it('should apply target input and update position', () => {
      const entityId = 0;
      const startX = 0, startY = 0;

      // Setup entity
      TransformStore.set(w, entityId, startX, startY, 0, 1);
      PhysicsStore.set(w, entityId, 0, 0, 100, 28);
      InputStore.setTarget(w, entityId, 500, 0); // Target at (500, 0)
      ConfigStore.setMaxSpeed(entityId, 150);
      StateStore.setFlag(w, entityId, EntityFlags.ACTIVE);

      // Run physics for 60 frames (1 second at 60fps)
      for (let i = 0; i < 60; i++) {
        MovementSystem.update(w, entityId, 1 / 60);
        PhysicsSystem.update(w, 1 / 60);
      }

      // Entity should have moved towards target
      const finalX = TransformStore.getX(w, entityId);
      expect(finalX).toBeGreaterThan(startX);
      expect(finalX).toBeLessThan(500); // Shouldn't overshoot in 1 second
    });

    it('should respect max speed limit', () => {
      const entityId = 0;
      const maxSpeed = 100;

      TransformStore.set(w, entityId, 0, 0, 0, 1);
      PhysicsStore.set(w, entityId, 0, 0, 100, 28);
      InputStore.setTarget(w, entityId, 1000, 0);
      ConfigStore.setMaxSpeed(entityId, maxSpeed);
      StateStore.setFlag(w, entityId, EntityFlags.ACTIVE);

      // Apply movement
      MovementSystem.update(w, entityId, 1 / 60);

      const vx = PhysicsStore.getVelocityX(w, entityId);
      const vy = PhysicsStore.getVelocityY(w, entityId);
      const speed = Math.sqrt(vx * vx + vy * vy);

      expect(speed).toBeLessThanOrEqual(maxSpeed * 1.01); // Allow small tolerance
    });
  });

  describe('Ring Transition Sync', () => {
    it('should correctly detect ring based on position', () => {
      const entityId = 0;

      // Setup entity at ring 1 (outer)
      const ring1X = 1200; // Between R2 (1000) and R1 (1600)
      TransformStore.set(w, entityId, ring1X, 0, 0, 1);

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
      TransformStore.setPosition(w, entityId, 800, 0);

      const result = checkRingTransition(entity);

      expect(result.transitioned).toBe(true);
      expect(result.newRing).toBe(2);
    });

    it('should block transition without sufficient match percent', () => {
      const entityId = 0;

      TransformStore.set(w, entityId, 800, 0, 0, 1);

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

      TransformStore.set(w, entityId, 0, 0, 0, 1);
      // Set velocity above limit (simulating client hack)
      PhysicsStore.set(w, entityId, 200, 0, 100, 28);
      StateStore.setFlag(w, entityId, EntityFlags.ACTIVE);

      const vx = PhysicsStore.getVelocityX(w, entityId);
      const vy = PhysicsStore.getVelocityY(w, entityId);
      const speed = Math.sqrt(vx * vx + vy * vy);

      // Server validation check
      const isViolating = speed > maxAllowedSpeed * tolerance;
      expect(isViolating).toBe(true);

      // Apply clamp
      if (isViolating) {
        const scale = (maxAllowedSpeed * tolerance) / speed;
        PhysicsStore.setVelocity(w, entityId, vx * scale, vy * scale);
      }

      const newSpeed = Math.sqrt(
        PhysicsStore.getVelocityX(w, entityId) ** 2 +
        PhysicsStore.getVelocityY(w, entityId) ** 2
      );
      expect(newSpeed).toBeLessThanOrEqual(maxAllowedSpeed * tolerance * 1.01);
    });
  });
});

describe('Network Protocol', () => {
  it('should pack and unpack events correctly', () => {
    const events = [
      { type: 1, entityId: 'player1', data: 100, x: 50, y: 75 },
      { type: 2, entityId: 'player2', data: 50, x: 100, y: 200 },
    ];

    const buffer = BinaryPacker.packEvents(events, 1234);
    const receivedEvents: any[] = [];

    BinaryPacker.unpackEvents(buffer, (type, entityId, data, x, y) => {
      receivedEvents.push({ type, entityId, data, x, y });
    });

    expect(receivedEvents.length).toBe(2);
    expect(receivedEvents[0].entityId).toBe('player1');
    expect(receivedEvents[0].data).toBeCloseTo(100, 3);
    expect(receivedEvents[1].entityId).toBe('player2');
  });
});
