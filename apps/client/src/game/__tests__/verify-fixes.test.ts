/**
 * VERIFY FIXES TEST
 * Tests specifically for the game mechanics fixes made
 *
 * EIDOLON-V: Migrated to Access APIs (removed compat layer dependency)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  EntityFlags,
  MAX_ENTITIES,
  TransformAccess,
  PhysicsAccess,
  StateAccess,
  InputAccess,
  MovementSystem,
  PhysicsSystem,
  EntityLookup,
  // CJR-specific flags
  CJRFoodFlags,
} from '@cjr/engine';

// Keep local imports for client-specific modules
import { entityManager } from '../engine/dod/EntityManager';
import { createInitialState } from '../engine/index';
import { createPlayer, createFood, createBot } from '../engine/factories';
import { bindEngine, createGameEngine, getWorld } from '../engine/context';

// EIDOLON-V FIX: Dynamically get world via getWorld() after engine binding
// Do NOT use defaultWorld directly - it's a different instance!

describe('EntityFlags Fix Verification', () => {
  beforeEach(() => {
    // Bind a fresh engine before each test
    const engine = createGameEngine();
    bindEngine(engine);
    getWorld().reset();
  });

  it('DEAD and BOSS should have different bit values', () => {
    expect(EntityFlags.DEAD).not.toBe(EntityFlags.BOSS);
    expect(EntityFlags.DEAD).toBe(0x02); // bit 1
    expect(EntityFlags.BOSS).toBe(0x40); // bit 6
  });

  it('All core EntityFlags should be unique powers of 2', () => {
    const flags = [
      EntityFlags.ACTIVE,
      EntityFlags.DEAD,
      EntityFlags.PLAYER,
      EntityFlags.BOT,
      EntityFlags.FOOD,
      EntityFlags.PROJECTILE,
      EntityFlags.BOSS,
      EntityFlags.LOCAL,
    ];

    // Check each flag is a power of 2
    for (const flag of flags) {
      expect(flag & (flag - 1)).toBe(0);
      expect(flag).toBeGreaterThan(0);
    }

    // Check all flags are unique
    const uniqueFlags = new Set(flags);
    expect(uniqueFlags.size).toBe(flags.length);
  });

  it('CJR Food Flags should be unique powers of 2', () => {
    const foodFlags = [
      CJRFoodFlags.FOOD_PIGMENT,
      CJRFoodFlags.FOOD_CATALYST,
      CJRFoodFlags.FOOD_SHIELD,
      CJRFoodFlags.FOOD_SOLVENT,
      CJRFoodFlags.FOOD_NEUTRAL,
    ];

    for (const flag of foodFlags) {
      expect(flag & (flag - 1)).toBe(0);
      expect(flag).toBeGreaterThan(0);
    }

    const uniqueFlags = new Set(foodFlags);
    expect(uniqueFlags.size).toBe(foodFlags.length);
  });

  it('Setting DEAD flag should not affect other flags', () => {
    const w = getWorld();
    const testId = 0;
    w.stateFlags[testId] = 0;

    StateAccess.setFlag(w, testId, EntityFlags.DEAD);
    expect(StateAccess.hasFlag(w, testId, EntityFlags.DEAD)).toBe(true);
    expect(StateAccess.hasFlag(w, testId, EntityFlags.BOSS)).toBe(false);

    w.stateFlags[testId] = 0;
    StateAccess.setFlag(w, testId, EntityFlags.BOSS);
    expect(StateAccess.hasFlag(w, testId, EntityFlags.BOSS)).toBe(true);
    expect(StateAccess.hasFlag(w, testId, EntityFlags.DEAD)).toBe(false);
  });
});

describe('DOD Stores Reset Fix Verification', () => {
  beforeEach(() => {
    const engine = createGameEngine();
    bindEngine(engine);
    getWorld().reset();
    entityManager.reset();
  });

  it('world.reset() should clear all data', () => {
    const w = getWorld();

    // Set some data first (using new Access APIs)
    TransformAccess.set(w, 0, 100, 200, 0, 1, 100, 200, 0);
    PhysicsAccess.set(w, 0, 10, 20, 0, 1, 30, 0.5, 0.9);
    StateAccess.setFlag(w, 0, EntityFlags.ACTIVE | EntityFlags.PLAYER);

    // Reset using instance method
    w.reset();

    expect(w.transform[0]).toBe(0);
    expect(w.transform[1]).toBe(0);
    expect(w.physics[0]).toBe(0);
    expect(w.stateFlags[0]).toBe(0);
  });

  it('entityManager.reset should reset entity count and free list', () => {
    const id1 = entityManager.createEntity();
    const id2 = entityManager.createEntity();
    const id3 = entityManager.createEntity();

    expect(entityManager.count).toBe(3);

    entityManager.reset();

    expect(entityManager.count).toBe(0);

    const newId = entityManager.createEntity();
    expect(newId).toBe(0);
  });

  it('createInitialState should reset stores before creating entities', () => {
    // Create new game state - this binds its own engine
    const state = createInitialState(1);
    const w = getWorld(); // Get the world from the newly bound engine

    expect(state.player).toBeDefined();
    expect(state.player.position.x).not.toBe(9999);

    const playerIdx = state.player.physicsIndex;
    if (playerIdx !== undefined) {
      expect(StateAccess.hasFlag(w, playerIdx, EntityFlags.ACTIVE)).toBe(true);
      expect(StateAccess.hasFlag(w, playerIdx, EntityFlags.DEAD)).toBe(false);
    }
  });
});

describe('Entity Loop Fix Verification', () => {
  beforeEach(() => {
    const engine = createGameEngine();
    bindEngine(engine);
    getWorld().reset();
    entityManager.reset();
  });

  it('PhysicsSystem should iterate over all MAX_ENTITIES', () => {
    const w = getWorld();
    const ids: number[] = [];
    for (let i = 0; i < 100; i++) {
      ids.push(entityManager.createEntity());
    }

    for (let i = 10; i < 90; i++) {
      entityManager.removeEntity(ids[i]);
      w.stateFlags[ids[i]] = 0;
    }

    const highIdx = ids[99];
    StateAccess.setFlag(w, highIdx, EntityFlags.ACTIVE);
    TransformAccess.set(w, highIdx, 100, 100, 0, 1, 100, 100, 0);
    PhysicsAccess.set(w, highIdx, 10, 10, 0, 1, 20, 0.5, 0.9);

    const initialX = w.transform[highIdx * 8];

    PhysicsSystem.update(w, 1 / 60);

    const newX = w.transform[highIdx * 8];
    expect(newX).not.toBe(initialX);
  });
});

describe('Entity Creation and Cleanup Verification', () => {
  beforeEach(() => {
    const engine = createGameEngine();
    bindEngine(engine);
    getWorld().reset();
    entityManager.reset();
  });

  it('createPlayer should properly initialize DOD stores', () => {
    const w = getWorld();
    const player = createPlayer('TestPlayer');

    expect(player).not.toBeNull();
    if (player) {
      expect(player.physicsIndex).toBeDefined();

      const idx = player.physicsIndex!;
      expect(StateAccess.hasFlag(w, idx, EntityFlags.ACTIVE)).toBe(true);
      expect(StateAccess.hasFlag(w, idx, EntityFlags.PLAYER)).toBe(true);
      expect(StateAccess.hasFlag(w, idx, EntityFlags.DEAD)).toBe(false);
      expect(EntityLookup[idx]).toBe(player);
    }
  });

  it('createFood should properly initialize DOD stores', () => {
    const w = getWorld();
    const food = createFood({ x: 100, y: 100 });

    expect(food).not.toBeNull();
    if (food) {
      expect(food.physicsIndex).toBeDefined();

      const idx = food.physicsIndex!;
      expect(StateAccess.hasFlag(w, idx, EntityFlags.ACTIVE)).toBe(true);
      expect(StateAccess.hasFlag(w, idx, EntityFlags.FOOD)).toBe(true);
      expect(StateAccess.hasFlag(w, idx, EntityFlags.DEAD)).toBe(false);
      expect(EntityLookup[idx]).toBe(food);
    }
  });

  it('createBot should properly initialize DOD stores with BOT flag', () => {
    const w = getWorld();
    const bot = createBot('TestBot');

    expect(bot).not.toBeNull();
    if (bot) {
      expect(bot.physicsIndex).toBeDefined();

      const idx = bot.physicsIndex!;
      expect(StateAccess.hasFlag(w, idx, EntityFlags.ACTIVE)).toBe(true);
      expect(StateAccess.hasFlag(w, idx, EntityFlags.BOT)).toBe(true);
      expect(StateAccess.hasFlag(w, idx, EntityFlags.PLAYER)).toBe(false);
      expect(StateAccess.hasFlag(w, idx, EntityFlags.DEAD)).toBe(false);
    }
  });
});

describe('Movement System Verification', () => {
  beforeEach(() => {
    const engine = createGameEngine();
    bindEngine(engine);
    getWorld().reset();
    entityManager.reset();
  });

  it('MovementSystem should read from InputAccess and update velocity', () => {
    const w = getWorld();
    const player = createPlayer('TestPlayer');
    expect(player).not.toBeNull();

    if (player && player.physicsIndex !== undefined) {
      const idx = player.physicsIndex;

      TransformAccess.set(w, idx, 0, 0, 0, 1, 0, 0, 0);
      PhysicsAccess.set(w, idx, 0, 0, 0, 10, 28, 0.5, 0.9);
      InputAccess.setTargetX(w, idx, 100);
      InputAccess.setTargetY(w, idx, 100);

      MovementSystem.update(w, idx, 1 / 60);

      const vx = w.physics[idx * 8];
      const vy = w.physics[idx * 8 + 1];

      expect(vx).toBeGreaterThan(0);
      expect(vy).toBeGreaterThan(0);
    }
  });
});
