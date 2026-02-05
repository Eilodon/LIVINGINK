/**
 * EIDOLON-V: Entity Handle Validation Tests
 * Tests for ABA problem prevention and handle validation
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { GameRoom } from '../rooms/GameRoom';
import { MAX_ENTITIES } from '@cjr/engine';

describe('Entity Handle Validation', () => {
  let room: GameRoom;

  beforeEach(() => {
    room = new GameRoom();
    // Initialize room state
    (room as any).setState({
      players: new Map(),
      bots: new Map(),
      food: new Map(),
      gameTime: 0,
    });
  });

  describe('Entity Handle Generation', () => {
    it('should generate unique handles for different entities', () => {
      const makeHandle = (room as any).makeEntityHandle.bind(room);

      const handle1 = makeHandle(0);
      const handle2 = makeHandle(1);
      const handle3 = makeHandle(2);

      expect(handle1).not.toBe(handle2);
      expect(handle2).not.toBe(handle3);
      expect(handle1).not.toBe(handle3);
    });

    it('should include generation in handle', () => {
      const makeHandle = (room as any).makeEntityHandle.bind(room);
      const entityGenerations = (room as any).entityGenerations;

      // Set generation for index 0
      entityGenerations[0] = 5;
      const handle = makeHandle(0);

      // Extract generation from handle (high 16 bits)
      const generation = handle >> 16;
      expect(generation).toBe(5);
    });

    it('should include index in handle (low 16 bits)', () => {
      const makeHandle = (room as any).makeEntityHandle.bind(room);

      const handle = makeHandle(42);
      const index = handle & 0xFFFF;

      expect(index).toBe(42);
    });
  });

  describe('Entity Handle Validation', () => {
    it('should validate correct handle', () => {
      const makeHandle = (room as any).makeEntityHandle.bind(room);
      const isValid = (room as any).isValidEntityHandle.bind(room);

      const handle = makeHandle(5);
      expect(isValid(handle)).toBe(true);
    });

    it('should invalidate handle with wrong generation', () => {
      const makeHandle = (room as any).makeEntityHandle.bind(room);
      const isValid = (room as any).isValidEntityHandle.bind(room);
      const entityGenerations = (room as any).entityGenerations;

      // Create handle
      const handle = makeHandle(5);

      // Increment generation
      entityGenerations[5]++;

      // Handle should now be invalid
      expect(isValid(handle)).toBe(false);
    });

    it('should invalidate out-of-bounds index', () => {
      const isValid = (room as any).isValidEntityHandle.bind(room);

      // Handle with index >= MAX_ENTITIES
      const invalidHandle = (1 << 16) | MAX_ENTITIES;
      expect(isValid(invalidHandle)).toBe(false);
    });

    it('should invalidate negative index', () => {
      const isValid = (room as any).isValidEntityHandle.bind(room);

      // Handle with negative index (when cast to unsigned)
      const invalidHandle = (1 << 16) | 0xFFFF; // -1 as u16
      expect(isValid(invalidHandle)).toBe(false);
    });
  });

  describe('Entity Index Allocation', () => {
    it('should allocate sequential indices initially', () => {
      const allocate = (room as any).allocateEntityIndex.bind(room);

      expect(allocate()).toBe(0);
      expect(allocate()).toBe(1);
      expect(allocate()).toBe(2);
    });

    it('should recycle released indices', () => {
      const allocate = (room as any).allocateEntityIndex.bind(room);
      const release = (room as any).releaseEntityIndex.bind(room);

      // Allocate and release
      const idx1 = allocate();
      release(idx1);

      // Should get recycled index
      const idx2 = allocate();
      expect(idx2).toBe(idx1);
    });

    it('should increment generation on recycle', () => {
      const allocate = (room as any).allocateEntityIndex.bind(room);
      const release = (room as any).releaseEntityIndex.bind(room);
      const entityGenerations = (room as any).entityGenerations;

      const idx = allocate();
      const genBefore = entityGenerations[idx];

      release(idx);
      allocate(); // Reuse

      const genAfter = entityGenerations[idx];
      expect(genAfter).toBe(genBefore + 1);
    });

    it('should return -1 when pool exhausted', () => {
      const allocate = (room as any).allocateEntityIndex.bind(room);

      // Exhaust pool
      for (let i = 0; i < MAX_ENTITIES; i++) {
        allocate();
      }

      // Should return -1
      expect(allocate()).toBe(-1);
    });

    it('should prefer recycled indices over new ones', () => {
      const allocate = (room as any).allocateEntityIndex.bind(room);
      const release = (room as any).releaseEntityIndex.bind(room);

      // Allocate 3 indices
      const idx0 = allocate();
      const idx1 = allocate();
      allocate();

      // Release middle one
      release(idx1);

      // Next allocation should reuse idx1
      expect(allocate()).toBe(idx1);
    });
  });

  describe('ABA Problem Prevention', () => {
    it('should prevent ABA problem with generation counter', () => {
      const makeHandle = (room as any).makeEntityHandle.bind(room);
      const isValid = (room as any).isValidEntityHandle.bind(room);
      const allocate = (room as any).allocateEntityIndex.bind(room);
      const release = (room as any).releaseEntityIndex.bind(room);

      // Allocate entity
      const idx = allocate();
      const originalHandle = makeHandle(idx);

      // Entity dies
      release(idx);

      // New entity gets same index (different generation)
      const newIdx = allocate();
      expect(newIdx).toBe(idx); // Same index recycled

      const newHandle = makeHandle(newIdx);

      // Original handle should be invalid
      expect(isValid(originalHandle)).toBe(false);

      // New handle should be valid
      expect(isValid(newHandle)).toBe(true);

      // Handles should be different
      expect(originalHandle).not.toBe(newHandle);
    });

    it('should handle multiple recycles', () => {
      const makeHandle = (room as any).makeEntityHandle.bind(room);
      const isValid = (room as any).isValidEntityHandle.bind(room);
      const allocate = (room as any).allocateEntityIndex.bind(room);
      const release = (room as any).releaseEntityIndex.bind(room);

      const idx = allocate();
      const handles: number[] = [];

      // Recycle multiple times
      for (let i = 0; i < 5; i++) {
        handles.push(makeHandle(idx));
        release(idx);
        allocate();
      }

      // Only the last handle should be valid
      for (let i = 0; i < handles.length - 1; i++) {
        expect(isValid(handles[i])).toBe(false);
      }
      expect(isValid(handles[handles.length - 1])).toBe(true);

      // All handles should be unique
      const uniqueHandles = new Set(handles);
      expect(uniqueHandles.size).toBe(handles.length);
    });
  });

  describe('Entity Index Extraction', () => {
    it('should extract index from valid handle', () => {
      const makeHandle = (room as any).makeEntityHandle.bind(room);
      const getIndex = (room as any).getIndexFromHandle.bind(room);

      const handle = makeHandle(42);
      const index = getIndex(handle);

      expect(index).toBe(42);
    });

    it('should return null for invalid handle', () => {
      const getIndex = (room as any).getIndexFromHandle.bind(room);
      const entityGenerations = (room as any).entityGenerations;

      // Create handle
      (room as any).nextEntityIndex = 0;
      const allocate = (room as any).allocateEntityIndex.bind(room);
      const release = (room as any).releaseEntityIndex.bind(room);

      const idx = allocate();
      const makeHandle = (room as any).makeEntityHandle.bind(room);
      const handle = makeHandle(idx);

      // Release and recycle
      release(idx);
      allocate();

      // Should return null for stale handle
      expect(getIndex(handle)).toBeNull();
    });
  });

  describe('Concurrent Operations', () => {
    it('should handle rapid allocate/release cycles', () => {
      const allocate = (room as any).allocateEntityIndex.bind(room);
      const release = (room as any).releaseEntityIndex.bind(room);
      const entityGenerations = (room as any).entityGenerations;

      const iterations = 100;
      const indices: number[] = [];

      for (let i = 0; i < iterations; i++) {
        const idx = allocate();
        indices.push(idx);

        if (indices.length > 10) {
          const toRelease = indices.shift()!;
          release(toRelease);
        }
      }

      // All active indices should have valid generations
      indices.forEach((idx) => {
        expect(entityGenerations[idx]).toBeGreaterThanOrEqual(0);
        expect(entityGenerations[idx]).toBeLessThanOrEqual(iterations);
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle generation overflow gracefully', () => {
      const makeHandle = (room as any).makeEntityHandle.bind(room);
      const entityGenerations = (room as any).entityGenerations;

      // Set generation near overflow
      entityGenerations[0] = 65534;

      const handle1 = makeHandle(0);
      entityGenerations[0]++;
      const handle2 = makeHandle(0);
      entityGenerations[0]++;
      const handle3 = makeHandle(0);

      // All handles should be unique
      expect(handle1).not.toBe(handle2);
      expect(handle2).not.toBe(handle3);

      // Handle generation overflow (wraps to 0)
      expect(entityGenerations[0]).toBe(0);
    });

    it('should handle index 0 correctly', () => {
      const makeHandle = (room as any).makeEntityHandle.bind(room);
      const isValid = (room as any).isValidEntityHandle.bind(room);
      const getIndex = (room as any).getIndexFromHandle.bind(room);

      const handle = makeHandle(0);

      expect(isValid(handle)).toBe(true);
      expect(getIndex(handle)).toBe(0);
    });

    it('should handle max valid index', () => {
      const makeHandle = (room as any).makeEntityHandle.bind(room);
      const isValid = (room as any).isValidEntityHandle.bind(room);

      const maxIndex = MAX_ENTITIES - 1;
      const handle = makeHandle(maxIndex);

      expect(isValid(handle)).toBe(true);
    });
  });
});
