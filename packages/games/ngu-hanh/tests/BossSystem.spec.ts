import { describe, it, expect, beforeEach, vi } from 'vitest';
import { WorldState, EntityManager } from '@cjr/engine';
import { GridSystem } from '../systems/GridSystem.js';
import { BossSystem, BossType } from '../systems/BossSystem.js';
import { TileMod } from '../types.js';

describe('BossSystem', () => {
    let world: WorldState;
    let entityManager: EntityManager;
    let gridSystem: GridSystem;
    let bossSystem: BossSystem;

    beforeEach(() => {
        // Use real WorldState with small capacity
        world = new WorldState({ maxEntities: 200 });

        // Mock EntityManager
        entityManager = {
            createEntity: () => 1,
            removeEntity: () => { }
        } as any;

        gridSystem = new GridSystem(5, 5, 10);
        // Mock gridSystem methods needed
        gridSystem.getRandomTileId = () => 100;
        gridSystem.getMod = () => TileMod.NONE;
        gridSystem.setMod = vi.fn();

        bossSystem = new BossSystem();
        bossSystem.initialize(world, entityManager, 1);
    });

    it('should initialize with correct stats', () => {
        const stats = bossSystem.getStats(world);
        expect(stats.maxHp).toBe(1000);
    });

    it('should execute Ash Spread skill on Fire Phoenix', () => {
        // bossType is private, but we know level 1 = Fire Phoenix
        const spawnVisual = vi.fn();

        // Move 1
        bossSystem.onPlayerMove(world, gridSystem, spawnVisual);
        expect(gridSystem.setMod).not.toHaveBeenCalled();

        // Move 2
        bossSystem.onPlayerMove(world, gridSystem, spawnVisual);
        expect(gridSystem.setMod).not.toHaveBeenCalled();

        // Move 3 -> Skill Trigger
        bossSystem.onPlayerMove(world, gridSystem, spawnVisual);
        expect(gridSystem.setMod).toHaveBeenCalledWith(world, 100, TileMod.ASH, spawnVisual);
    });
});
