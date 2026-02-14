// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { WorldState, EntityManager } from '@cjr/engine';

// Mock engine to avoid PixiJS load
vi.mock('@cjr/engine', async () => {
    const actual = await vi.importActual<any>('@cjr/engine');
    return {
        ...actual,
        FluidRenderer: class { },
    };
});

import { GridSystem } from '../systems/GridSystem.js';
import { BossSystem, BossType } from '../systems/BossSystem.js';
import { TileMod } from '../types.js';
// Mock SeededRNG
vi.mock('../utils/SeededRNG.js', () => ({
    SeededRNG: vi.fn().mockImplementation(() => ({
        nextElement: vi.fn((list) => list[0]),
        chance: vi.fn(() => true),
        nextInt: vi.fn(() => 0)
    }))
}));
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
        gridSystem.spawnSpecial = vi.fn();
        gridSystem.getTilesByElementAndFlag = vi.fn().mockReturnValue([]); // Initially empty
        gridSystem.getNeighborIndices = vi.fn().mockReturnValue([101]); // Mock neighbors

        bossSystem = new BossSystem();
        bossSystem.initialize(world, entityManager, { hp: 1000, damageMultiplier: 1, skills: ['ASH_SPREAD'] }, 12345);
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
        bossSystem.onPlayerMove(world, gridSystem, spawnVisual);
        // Initial infection calls spawnSpecial, NOT setMod
        expect(gridSystem.spawnSpecial).toHaveBeenCalled();
        expect(gridSystem.setMod).not.toHaveBeenCalled();

        // 4. Test Spread (Mock existing ash)
        gridSystem.getTilesByElementAndFlag = vi.fn().mockReturnValue([100]); // Tile 100 is Ash
        // Reset counters/mocks
        (bossSystem as any).movesCounter = 2; // Fast forward

        bossSystem.onPlayerMove(world, gridSystem, spawnVisual);
        // Should trigger spread now
        expect(gridSystem.getMod(101)).toBe(TileMod.NONE); // Pre-check
        expect(gridSystem.setMod).toHaveBeenCalled();
    });
});
