import { describe, test, expect, beforeEach } from 'vitest';
import { NetworkClient } from '../game/networking/NetworkClient';
import type { GameState } from '../types';

describe('NetworkClient - Ring Buffer Optimization', () => {
  let client: NetworkClient;
  let mockGameState: GameState;

  beforeEach(() => {
    client = new NetworkClient();
    // Create minimal mock GameState
    mockGameState = {
      players: [],
      bots: [],
      food: [],
      projectiles: [],
      gameTime: 0,
      isPaused: false,
      player: null as any,
      arena: null as any,
      engine: null as any,
      inputState: null as any,
    } as unknown as GameState; // Use type assertion for minimal mock
    client.setLocalState(mockGameState);
  });

  describe('Ring Buffer Wraparound', () => {
    test('should wrap around after SNAPSHOT_BUFFER_SIZE snapshots', () => {
      // Access private members for testing via type assertion
      const clientAny = client as any;
      const BUFFER_SIZE = (NetworkClient as any).SNAPSHOT_BUFFER_SIZE;

      // Push more snapshots than buffer size
      for (let i = 0; i < BUFFER_SIZE + 5; i++) {
        const mockState = {
          players: new Map(),
          bots: new Map(),
          food: new Map(),
        };
        clientAny.pushSnapshot(mockState);
      }

      // Verify circular index wrapped
      expect(clientAny.snapshotHead).toBe(5); // (20 + 5) % 20 = 5
      expect(clientAny.snapshotCount).toBe(BUFFER_SIZE); // Capped at max
    });

    test('should maintain correct count when partially filled', () => {
      const clientAny = client as any;

      // Push only 5 snapshots
      for (let i = 0; i < 5; i++) {
        clientAny.pushSnapshot({ players: new Map(), bots: new Map(), food: new Map() });
      }

      expect(clientAny.snapshotHead).toBe(5);
      expect(clientAny.snapshotCount).toBe(5); // Not full yet
    });
  });

  describe('Map Reuse (Zero Allocation)', () => {
    test('should reuse same Map objects across writes', () => {
      const clientAny = client as any;

      // Get reference to first snapshot's Maps
      const firstSnapshot = clientAny.snapshotBuffer[0];
      const originalPlayersMap = firstSnapshot.players;
      const originalBotsMap = firstSnapshot.bots;
      const originalFoodMap = firstSnapshot.food;

      // Push snapshot (should reuse Maps via .clear())
      clientAny.pushSnapshot({
        players: new Map([
          ['p1', { position: { x: 100, y: 200 }, velocity: { x: 0, y: 0 }, radius: 50 }],
        ]),
        bots: new Map(),
        food: new Map(),
      });

      // Verify same Map object references (not new allocations)
      expect(firstSnapshot.players).toBe(originalPlayersMap);
      expect(firstSnapshot.bots).toBe(originalBotsMap);
      expect(firstSnapshot.food).toBe(originalFoodMap);
    });

    test('should clear Maps before repopulating', () => {
      const clientAny = client as any;

      // First write
      clientAny.pushSnapshot({
        players: new Map([
          ['p1', { position: { x: 1, y: 1 }, velocity: { x: 0, y: 0 }, radius: 10 }],
        ]),
        bots: new Map([['b1', { position: { x: 2, y: 2 }, velocity: { x: 0, y: 0 }, radius: 20 }]]),
        food: new Map(),
      });

      // Wrap around to overwrite first snapshot
      const BUFFER_SIZE = (NetworkClient as any).SNAPSHOT_BUFFER_SIZE;
      for (let i = 0; i < BUFFER_SIZE; i++) {
        clientAny.pushSnapshot({ players: new Map(), bots: new Map(), food: new Map() });
      }

      // Verify first snapshot was cleared and overwritten
      const firstSnapshot = clientAny.snapshotBuffer[0];
      expect(firstSnapshot.players.size).toBe(0);
      expect(firstSnapshot.bots.size).toBe(0);
    });
  });

  describe('Interpolation with Ring Buffer', () => {
    test('should find correct snapshot pair for interpolation', () => {
      const clientAny = client as any;
      const now = clientAny.nowMs();

      // Push 3 snapshots at different times
      clientAny.snapshotBuffer[0].time = now - 300;
      clientAny.snapshotBuffer[0].players = new Map([
        ['p1', { x: 0, y: 0, vx: 0, vy: 0, radius: 10 }],
      ]);

      clientAny.snapshotBuffer[1].time = now - 200;
      clientAny.snapshotBuffer[1].players = new Map([
        ['p1', { x: 50, y: 50, vx: 0, vy: 0, radius: 10 }],
      ]);

      clientAny.snapshotBuffer[2].time = now - 100;
      clientAny.snapshotBuffer[2].players = new Map([
        ['p1', { x: 100, y: 100, vx: 0, vy: 0, radius: 10 }],
      ]);

      clientAny.snapshotHead = 3;
      clientAny.snapshotCount = 3;

      // Add a player to gamestate
      const mockPlayer = {
        id: 'p1',
        position: { x: 0, y: 0 },
        velocity: { x: 0, y: 0 },
        radius: 10,
        trail: [],
        isDead: false,
      } as any;
      mockGameState.players.push(mockPlayer);

      // Interpolate at time that should be between snapshot 1 and 2
      const renderTime = now - 150; // Between 200ms and 100ms ago
      clientAny.interpolateState(mockGameState, renderTime + clientAny.interpolationDelayMs);

      // Position should be interpolated between 50 and 100
      expect(mockPlayer.position.x).toBeGreaterThan(40);
      expect(mockPlayer.position.x).toBeLessThan(110);
    });

    test('should handle empty buffer gracefully', () => {
      const clientAny = client as any;
      clientAny.snapshotCount = 0;

      // Should not throw
      expect(() => {
        clientAny.interpolateState(mockGameState);
      }).not.toThrow();
    });

    test('should use fallback when no suitable snapshot found', () => {
      const clientAny = client as any;
      const now = clientAny.nowMs();

      // All snapshots are in the future
      clientAny.snapshotBuffer[0].time = now + 1000;
      clientAny.snapshotHead = 1;
      clientAny.snapshotCount = 1;

      const mockPlayer = {
        id: 'p1',
        position: { x: 0, y: 0 },
        velocity: { x: 0, y: 0 },
      } as any;
      mockGameState.players.push(mockPlayer);
      clientAny.snapshotBuffer[0].players = new Map([
        ['p1', { x: 999, y: 999, vx: 0, vy: 0, radius: 10 }],
      ]);

      // Should apply most recent snapshot as fallback
      clientAny.interpolateState(mockGameState, now - 100);

      expect(mockPlayer.position.x).toBe(999);
      expect(mockPlayer.position.y).toBe(999);
    });
  });

  describe('Connection Lifecycle', () => {
    test('should reset ring buffer on disconnect', async () => {
      const clientAny = client as any;

      // Simulate some snapshots
      for (let i = 0; i < 5; i++) {
        clientAny.pushSnapshot({ players: new Map(), bots: new Map(), food: new Map() });
      }

      expect(clientAny.snapshotCount).toBe(5);

      // Disconnect
      await client.disconnect();

      // Verify reset
      expect(clientAny.snapshotHead).toBe(0);
      expect(clientAny.snapshotCount).toBe(0);
    });
  });
});
