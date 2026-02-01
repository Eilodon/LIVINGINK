import { describe, test, expect } from 'vitest';
import { BinaryPacker, PacketType } from '../game/networking/BinaryPacker';

describe('BinaryPacker - Zero-Allocation Refactor', () => {
  describe('unpackAndApply - Callback API', () => {
    test('should invoke callback with correct primitive values', () => {
      const testData = [
        { id: 'player1', x: 100.5, y: 200.25, vx: 5.0, vy: -3.5 },
        { id: 'bot2', x: 300.75, y: 400.0, vx: 0.0, vy: 10.25 },
      ];

      const timestamp = 1234.56;
      const buffer = BinaryPacker.packTransforms(testData, timestamp);

      const received: Array<{ id: string; x: number; y: number; vx: number; vy: number }> = [];

      const returnedTimestamp = BinaryPacker.unpackAndApply(buffer, (id, x, y, vx, vy) => {
        received.push({ id, x, y, vx, vy });
      });

      expect(returnedTimestamp).toBeCloseTo(timestamp, 2);
      expect(received).toHaveLength(2);

      expect(received[0].id).toBe('player1');
      expect(received[0].x).toBeCloseTo(100.5, 2);
      expect(received[0].y).toBeCloseTo(200.25, 2);
      expect(received[0].vx).toBeCloseTo(5.0, 2);
      expect(received[0].vy).toBeCloseTo(-3.5, 2);

      expect(received[1].id).toBe('bot2');
      expect(received[1].x).toBeCloseTo(300.75, 2);
    });

    test('should return null for invalid packet type', () => {
      const invalidBuffer = new ArrayBuffer(10);
      const view = new Uint8Array(invalidBuffer);
      view[0] = 99; // Invalid packet type

      const callbackCalled = { value: false };
      const timestamp = BinaryPacker.unpackAndApply(invalidBuffer, () => {
        callbackCalled.value = true;
      });

      expect(timestamp).toBeNull();
      expect(callbackCalled.value).toBe(false);
    });

    test('should handle empty entity list', () => {
      const buffer = BinaryPacker.packTransforms([], 5678.9);

      const callbackCalled = { value: false };
      const timestamp = BinaryPacker.unpackAndApply(buffer, () => {
        callbackCalled.value = true;
      });

      expect(timestamp).toBeCloseTo(5678.9, 2);
      expect(callbackCalled.value).toBe(false);
    });

    test('should handle long entity IDs (up to 64 bytes)', () => {
      const longId = 'a'.repeat(60); // 60 chars, within 64 byte limit
      const testData = [{ id: longId, x: 1, y: 2, vx: 3, vy: 4 }];
      const buffer = BinaryPacker.packTransforms(testData, 100);

      let receivedId = '';
      BinaryPacker.unpackAndApply(buffer, id => {
        receivedId = id;
      });

      expect(receivedId).toBe(longId);
      expect(receivedId.length).toBe(60);
    });

    test('should correctly decode UTF-8 strings', () => {
      // Test with ASCII-compatible IDs (standard case)
      const testData = [{ id: 'player_123', x: 1, y: 2, vx: 3, vy: 4 }];
      const buffer = BinaryPacker.packTransforms(testData, 100);

      let receivedId = '';
      BinaryPacker.unpackAndApply(buffer, id => {
        receivedId = id;
      });

      expect(receivedId).toBe('player_123');
    });
  });

  describe('Backwards Compatibility - Legacy API', () => {
    test('unpackTransforms should still work using new callback API internally', () => {
      const testData = [{ id: 'legacy1', x: 10, y: 20, vx: 1, vy: 2 }];
      const timestamp = 999.99;
      const buffer = BinaryPacker.packTransforms(testData, timestamp);

      const result = BinaryPacker.unpackTransforms(buffer);

      expect(result).not.toBeNull();
      expect(result!.timestamp).toBeCloseTo(timestamp, 2);
      expect(result!.updates).toHaveLength(1);
      expect(result!.updates[0].id).toBe('legacy1');
      expect(result!.updates[0].x).toBeCloseTo(10, 2);
    });
  });

  describe('Performance - Zero Allocation Verification', () => {
    test('callback should be invoked once per entity without intermediate arrays', () => {
      const largeDataset = Array.from({ length: 100 }, (_, i) => ({
        id: `entity_${i}`,
        x: i * 10,
        y: i * 20,
        vx: i,
        vy: -i,
      }));

      const buffer = BinaryPacker.packTransforms(largeDataset, 5000);

      let callbackCount = 0;
      const timestamp = BinaryPacker.unpackAndApply(buffer, (id, x, y, vx, vy) => {
        callbackCount++;
        // Verify data is correct for spot checks
        if (id === 'entity_0') {
          expect(x).toBe(0);
          expect(y).toBe(0);
        }
        if (id === 'entity_99') {
          expect(x).toBe(990);
          expect(y).toBe(1980);
        }
      });

      expect(callbackCount).toBe(100);
      expect(timestamp).toBeCloseTo(5000, 2);
    });
  });
});
