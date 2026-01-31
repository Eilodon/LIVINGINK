/**
 * VERIFY FIXES TEST
 * Tests specifically for the game mechanics fixes made
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { EntityFlags, MAX_ENTITIES } from '../services/engine/dod/EntityFlags';
import { entityManager } from '../services/engine/dod/EntityManager';
import {
  resetAllStores,
  TransformStore,
  PhysicsStore,
  StateStore,
  EntityLookup,
  InputStore
} from '../services/engine/dod/ComponentStores';
import { createInitialState } from '../services/engine/index';
import { createPlayer, createFood, createBot } from '../services/engine/factories';
import { MovementSystem } from '../services/engine/dod/systems/MovementSystem';
import { PhysicsSystem } from '../services/engine/dod/systems/PhysicsSystem';

describe('EntityFlags Fix Verification', () => {
  it('DEAD and OBSTACLE should have different bit values', () => {
    expect(EntityFlags.DEAD).not.toBe(EntityFlags.OBSTACLE);
    expect(EntityFlags.DEAD).toBe(1 << 5); // 32
    expect(EntityFlags.OBSTACLE).toBe(1 << 6); // 64
  });

  it('All EntityFlags should be unique powers of 2', () => {
    const flags = [
      EntityFlags.ACTIVE,
      EntityFlags.PLAYER,
      EntityFlags.BOT,
      EntityFlags.FOOD,
      EntityFlags.PROJECTILE,
      EntityFlags.DEAD,
      EntityFlags.OBSTACLE,
      EntityFlags.FOOD_PIGMENT,
      EntityFlags.FOOD_CATALYST,
      EntityFlags.FOOD_SHIELD,
      EntityFlags.FOOD_SOLVENT,
      EntityFlags.FOOD_NEUTRAL,
    ];

    // Check each flag is a power of 2
    for (const flag of flags) {
      expect(flag & (flag - 1)).toBe(0); // Power of 2 check
      expect(flag).toBeGreaterThan(0);
    }

    // Check all flags are unique
    const uniqueFlags = new Set(flags);
    expect(uniqueFlags.size).toBe(flags.length);
  });

  it('Setting DEAD flag should not affect OBSTACLE and vice versa', () => {
    const testId = 0;
    StateStore.flags[testId] = 0;

    // Set DEAD
    StateStore.setFlag(testId, EntityFlags.DEAD);
    expect(StateStore.hasFlag(testId, EntityFlags.DEAD)).toBe(true);
    expect(StateStore.hasFlag(testId, EntityFlags.OBSTACLE)).toBe(false);

    // Clear and set OBSTACLE
    StateStore.flags[testId] = 0;
    StateStore.setFlag(testId, EntityFlags.OBSTACLE);
    expect(StateStore.hasFlag(testId, EntityFlags.OBSTACLE)).toBe(true);
    expect(StateStore.hasFlag(testId, EntityFlags.DEAD)).toBe(false);
  });
});

describe('DOD Stores Reset Fix Verification', () => {
  beforeEach(() => {
    resetAllStores();
    entityManager.reset();
  });

  it('resetAllStores should clear all data', () => {
    // Set some data first
    TransformStore.set(0, 100, 200, 0);
    PhysicsStore.set(0, 10, 20, 1, 30);
    StateStore.setFlag(0, EntityFlags.ACTIVE | EntityFlags.PLAYER);

    // Reset
    resetAllStores();

    // Verify cleared
    expect(TransformStore.data[0]).toBe(0);
    expect(TransformStore.data[1]).toBe(0);
    expect(PhysicsStore.data[0]).toBe(0);
    expect(StateStore.flags[0]).toBe(0);
  });

  it('entityManager.reset should reset entity count and free list', () => {
    // Create some entities
    const id1 = entityManager.createEntity();
    const id2 = entityManager.createEntity();
    const id3 = entityManager.createEntity();

    expect(entityManager.count).toBe(3);

    // Reset
    entityManager.reset();

    expect(entityManager.count).toBe(0);

    // Should be able to create entities again starting from 0
    const newId = entityManager.createEntity();
    expect(newId).toBe(0);
  });

  it('createInitialState should reset stores before creating entities', () => {
    // Create some stale data
    TransformStore.set(0, 9999, 9999, 0);
    StateStore.setFlag(0, EntityFlags.DEAD);

    // Create new game state
    const state = createInitialState(1);

    // Player should be at a valid position, not stale data
    expect(state.player).toBeDefined();
    expect(state.player.position.x).not.toBe(9999);

    // Entity at index 0 should be ACTIVE PLAYER, not DEAD
    const playerIdx = state.player.physicsIndex;
    if (playerIdx !== undefined) {
      expect(StateStore.hasFlag(playerIdx, EntityFlags.ACTIVE)).toBe(true);
      expect(StateStore.hasFlag(playerIdx, EntityFlags.DEAD)).toBe(false);
    }
  });
});

describe('Entity Loop Fix Verification', () => {
  beforeEach(() => {
    resetAllStores();
    entityManager.reset();
  });

  it('PhysicsSystem should iterate over all MAX_ENTITIES', () => {
    // Create entity at high index by creating and removing entities
    const ids: number[] = [];
    for (let i = 0; i < 100; i++) {
      ids.push(entityManager.createEntity());
    }

    // Remove middle entities
    for (let i = 10; i < 90; i++) {
      entityManager.removeEntity(ids[i]);
      StateStore.flags[ids[i]] = 0;
    }

    // Entity 99 should still be processed
    const highIdx = ids[99];
    StateStore.setFlag(highIdx, EntityFlags.ACTIVE);
    TransformStore.set(highIdx, 100, 100, 0);
    PhysicsStore.set(highIdx, 10, 10, 1, 20, 0.5, 0.9);

    const initialX = TransformStore.data[highIdx * 8];

    // Run physics
    PhysicsSystem.update(1/60);

    // Position should have changed (velocity applied)
    const newX = TransformStore.data[highIdx * 8];
    expect(newX).not.toBe(initialX);
  });
});

describe('Entity Creation and Cleanup Verification', () => {
  beforeEach(() => {
    resetAllStores();
    entityManager.reset();
  });

  it('createPlayer should properly initialize DOD stores', () => {
    const player = createPlayer('TestPlayer');

    expect(player).not.toBeNull();
    if (player) {
      expect(player.physicsIndex).toBeDefined();

      const idx = player.physicsIndex!;
      expect(StateStore.hasFlag(idx, EntityFlags.ACTIVE)).toBe(true);
      expect(StateStore.hasFlag(idx, EntityFlags.PLAYER)).toBe(true);
      expect(StateStore.hasFlag(idx, EntityFlags.DEAD)).toBe(false);
      expect(EntityLookup[idx]).toBe(player);
    }
  });

  it('createFood should properly initialize DOD stores', () => {
    const food = createFood({ x: 100, y: 100 });

    expect(food).not.toBeNull();
    if (food) {
      expect(food.physicsIndex).toBeDefined();

      const idx = food.physicsIndex!;
      expect(StateStore.hasFlag(idx, EntityFlags.ACTIVE)).toBe(true);
      expect(StateStore.hasFlag(idx, EntityFlags.FOOD)).toBe(true);
      expect(StateStore.hasFlag(idx, EntityFlags.DEAD)).toBe(false);
      expect(EntityLookup[idx]).toBe(food);
    }
  });

  it('createBot should properly initialize DOD stores with BOT flag', () => {
    const bot = createBot('TestBot');

    expect(bot).not.toBeNull();
    if (bot) {
      expect(bot.physicsIndex).toBeDefined();

      const idx = bot.physicsIndex!;
      expect(StateStore.hasFlag(idx, EntityFlags.ACTIVE)).toBe(true);
      expect(StateStore.hasFlag(idx, EntityFlags.BOT)).toBe(true);
      expect(StateStore.hasFlag(idx, EntityFlags.PLAYER)).toBe(false); // Should NOT have PLAYER flag
      expect(StateStore.hasFlag(idx, EntityFlags.DEAD)).toBe(false);
    }
  });
});

describe('Movement System Verification', () => {
  beforeEach(() => {
    resetAllStores();
    entityManager.reset();
  });

  it('MovementSystem should read from InputStore and update velocity', () => {
    const player = createPlayer('TestPlayer');
    expect(player).not.toBeNull();

    if (player && player.physicsIndex !== undefined) {
      const idx = player.physicsIndex;

      // Set initial position
      TransformStore.set(idx, 0, 0, 0);
      PhysicsStore.set(idx, 0, 0, 10, 28, 0.5, 0.9);

      // Set target in InputStore (player wants to move to 100, 100)
      InputStore.setTarget(idx, 100, 100);

      // Run movement system
      MovementSystem.update(idx, 1/60);

      // Velocity should be updated towards target
      const vx = PhysicsStore.data[idx * 8];
      const vy = PhysicsStore.data[idx * 8 + 1];

      // Should have velocity towards target (positive in both x and y)
      expect(vx).toBeGreaterThan(0);
      expect(vy).toBeGreaterThan(0);
    }
  });
});
