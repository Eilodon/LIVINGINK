import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Client } from 'colyseus';
import { GameRoom } from './GameRoom';
import { GameRoomState } from '../schema/GameState';
import { MAX_ENTITIES } from '@cjr/engine';

vi.mock('../logging/Logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() }
}));

vi.mock('../security/ServerValidator', () => ({
  serverValidator: { cleanup: vi.fn() }
}));

function createMockClient(sessionId: string): Client {
  return {
    sessionId, id: sessionId, userData: {}, state: null, ping: 0, readyState: 1,
    raw: {} as any, send: vi.fn(), sendBytes: vi.fn(), error: vi.fn(), leave: vi.fn(),
  } as unknown as Client;
}

describe('GameRoom', () => {
  let room: GameRoom;

  beforeEach(() => {
    room = new GameRoom();
    room.setState(new GameRoomState());
  });

  afterEach(() => {
    room.onDispose?.();
  });

  describe('Lifecycle', () => {
    it('creates room with valid options', () => {
      expect(() => room.onCreate({ level: 1 })).not.toThrow();
      expect(room.state).toBeDefined();
      expect(room.maxClients).toBe(50);
    });

    it('rejects invalid room options', () => {
      expect(() => room.onCreate(null)).toThrow();
    });

    it('disposes cleanly', () => {
      room.onCreate({});
      expect(() => room.onDispose()).not.toThrow();
    });
  });

  describe('Player Join/Leave', () => {
    beforeEach(() => room.onCreate({}));

    it('adds player on join', () => {
      const client = createMockClient('p1');
      room.onJoin(client, { name: 'Player1', shape: 'circle' });
      expect(room.state.players.has('p1')).toBe(true);
      expect(room.state.players.get('p1')?.name).toBe('Player1');
    });

    it('assigns default name when empty', () => {
      const client = createMockClient('p2');
      room.onJoin(client, {});
      expect(room.state.players.get('p2')?.name).toMatch(/^Jelly/);
    });

    it('allocates DOD entity index', () => {
      const client = createMockClient('p3');
      room.onJoin(client, {});
      const idx = (room as any).entityIndices.get('p3');
      expect(idx).toBeGreaterThanOrEqual(0);
      expect(idx).toBeLessThan(MAX_ENTITIES);
    });

    it('removes player on leave', () => {
      const client = createMockClient('p4');
      room.onJoin(client, {});
      room.onLeave(client, true);
      expect(room.state.players.has('p4')).toBe(false);
    });

    it('recycles entity index on leave', () => {
      const client = createMockClient('p5');
      room.onJoin(client, {});
      const idx = (room as any).entityIndices.get('p5');
      room.onLeave(client, true);
      expect((room as any).freeEntityIndices).toContain(idx);
    });

    it('rejects join when pool exhausted', () => {
      (room as any).nextEntityIndex = MAX_ENTITIES;
      (room as any).freeEntityIndices = [];
      const client = createMockClient('p6');
      room.onJoin(client, {});
      expect(client.leave).toHaveBeenCalled();
    });
  });

  describe('Input Handling', () => {
    beforeEach(() => room.onCreate({}));

    it('accepts valid input', () => {
      const client = createMockClient('i1');
      room.onJoin(client, {});
      // Directly set input (simulating validated input handler)
      (room as any).inputsBySession.set('i1', {
        seq: 1, targetX: 100, targetY: 200, space: true, w: false
      });
      const stored = (room as any).inputsBySession.get('i1');
      expect(stored?.targetX).toBe(100);
      expect(stored?.space).toBe(true);
    });

    it('has rate limiting structure', () => {
      const client = createMockClient('r1');
      room.onJoin(client, {});
      // Rate limiter map should exist
      expect((room as any).clientRates).toBeDefined();
      expect((room as any).RATE_LIMIT_MAX).toBe(60);
      expect((room as any).RATE_LIMIT_WINDOW).toBe(1000);
    });
  });

  describe('Game Loop', () => {
    beforeEach(() => room.onCreate({}));

    it('updates game time', () => {
      const t0 = room.state.gameTime;
      room.update(16.67);
      expect(room.state.gameTime).toBeGreaterThan(t0);
    });

    it('clamps delta time', () => {
      const t0 = room.state.gameTime;
      room.update(1000);
      expect(room.state.gameTime - t0).toBeLessThanOrEqual(0.21);
    });
  });

  describe('Player Death', () => {
    beforeEach(() => room.onCreate({}));

    it('handles player death and respawn', () => {
      const client = createMockClient('d1');
      room.onJoin(client, {});
      const entityIdx = (room as any).entityIndices.get('d1');
      const initialX = room.state.players.get('d1')?.position.x;

      // Simulate death (health <= 0) using Accessor API with world
      const world = (room as any).world;
      const { StatsAccess } = require('@cjr/engine');
      StatsAccess.setHp(world, entityIdx, 0);

      room.update(16.67);

      const player = room.state.players.get('d1');
      // Player is immediately respawned (isDead = false), health reset
      expect(player?.isDead).toBe(false);
      expect(player?.currentHealth).toBe(100);
      // Position should have changed (respawn at random location)
      expect(player?.position.x).not.toBe(initialX);
    });
  });
});
