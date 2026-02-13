
import { WorldState, EntityManager, StatsAccess, EntityFlags, StateAccess } from '@cjr/engine';
import { GridSystem } from './GridSystem.js';
import { TileMod, ElementType } from '../types.js';

export enum BossType {
    FIRE_PHOENIX = 0,
    EARTH_GOLEM = 1,
    METAL_DRAGON = 2
}

export class BossSystem {
    private bossId: number = -1;
    private bossType: BossType = BossType.FIRE_PHOENIX;

    // Skill timing
    private movesCounter: number = 0;
    private movesPerAction: number = 3;

    initialize(world: WorldState, entityManager: EntityManager, level: number = 1): void {
        this.bossId = entityManager.createEntity();

        // Determine Boss Type based on Level (simple logic for now)
        if (level < 25) this.bossType = BossType.FIRE_PHOENIX;
        else if (level < 50) this.bossType = BossType.EARTH_GOLEM;
        else this.bossType = BossType.METAL_DRAGON;

        // Activate
        StateAccess.activate(world, this.bossId);
        StateAccess.setFlag(world, this.bossId, EntityFlags.BOSS);

        // Stats
        const maxHp = 1000 * level;
        StatsAccess.setHp(world, this.bossId, maxHp);
        StatsAccess.setMaxHp(world, this.bossId, maxHp);
        StatsAccess.setDefense(world, this.bossId, 5 * level);

        console.log(`[BossSystem] Boss Spawned! ID: ${this.bossId}, Type: ${BossType[this.bossType]}, HP: ${maxHp}`);
    }

    onMatch(world: WorldState, count: number, multiplier: number): void {
        if (this.bossId === -1 || (StateAccess.getFlags(world, this.bossId) & EntityFlags.DEAD)) return;

        // Damage Formula
        const damage = count * 10 * multiplier;

        const currentHp = StatsAccess.getHp(world, this.bossId);
        const newHp = Math.max(0, currentHp - damage);

        StatsAccess.setHp(world, this.bossId, newHp);

        console.log(`[BossSystem] Boss take ${damage} dmg! HP: ${newHp}/${StatsAccess.getMaxHp(world, this.bossId)}`);

        if (newHp <= 0) {
            this.onBossDeath(world);
        }
    }

    /**
     * Called every player move
     */
    onPlayerMove(world: WorldState, gridSystem: GridSystem, spawnVisual: (id: number, mod: TileMod) => void): void {
        if (this.bossId === -1 || (StateAccess.getFlags(world, this.bossId) & EntityFlags.DEAD)) return;

        this.movesCounter++;
        console.log(`[BossSystem] Move ${this.movesCounter}/${this.movesPerAction}`);

        if (this.movesCounter >= this.movesPerAction) {
            this.executeSkill(world, gridSystem, spawnVisual);
            this.movesCounter = 0;
        }
    }

    private executeSkill(world: WorldState, gridSystem: GridSystem, spawnVisual: (id: number, mod: TileMod) => void): void {
        console.log(`[BossSystem] EXECUTING SKILL for ${BossType[this.bossType]}!`);

        switch (this.bossType) {
            case BossType.FIRE_PHOENIX:
                this.skillAshSpread(world, gridSystem, spawnVisual);
                break;
            case BossType.EARTH_GOLEM:
                this.skillStoneWall(world, gridSystem, spawnVisual);
                break;
            case BossType.METAL_DRAGON:
                this.skillMetalLock(world, gridSystem, spawnVisual);
                break;
        }
    }

    // Skill 1: Ash Spread - Converts 3 random tiles to Ash
    private skillAshSpread(world: WorldState, gridSystem: GridSystem, spawnVisual: (id: number, mod: TileMod) => void): void {
        for (let i = 0; i < 3; i++) {
            const tileId = gridSystem.getRandomTileId();
            if (tileId !== -1 && gridSystem.getMod(tileId) === TileMod.NONE) {
                gridSystem.setMod(world, tileId, TileMod.ASH, spawnVisual);
                console.log(`[BossSystem] Tile ${tileId} turned to ASH!`);
            }
        }
    }

    // Skill 2: Stone Wall - Spawns 2 Stone Blocks
    private skillStoneWall(world: WorldState, gridSystem: GridSystem, spawnVisual: (id: number, mod: TileMod) => void): void {
        for (let i = 0; i < 2; i++) {
            const tileId = gridSystem.getRandomTileId();
            if (tileId !== -1 && gridSystem.getMod(tileId) === TileMod.NONE) {
                gridSystem.setMod(world, tileId, TileMod.STONE, spawnVisual);
                console.log(`[BossSystem] Tile ${tileId} turned to STONE!`);
            }
        }
    }

    // Skill 3: Metal Lock - Locks 1 random tile
    private skillMetalLock(world: WorldState, gridSystem: GridSystem, spawnVisual: (id: number, mod: TileMod) => void): void {
        const tileId = gridSystem.getRandomTileId();
        if (tileId !== -1 && gridSystem.getMod(tileId) === TileMod.NONE) {
            gridSystem.setMod(world, tileId, TileMod.LOCKED, spawnVisual);
            console.log(`[BossSystem] Tile ${tileId} LOCKED!`);
        }
    }

    private onBossDeath(world: WorldState): void {
        console.log(`[BossSystem] BOSS DEFEATED!`);
        StateAccess.markDead(world, this.bossId);
        StateAccess.deactivate(world, this.bossId);
        // Dispatch Event? For MVP just log.
    }

    getStats(world: WorldState): { hp: number, maxHp: number } {
        if (this.bossId === -1) return { hp: 0, maxHp: 100 };
        return {
            hp: StatsAccess.getHp(world, this.bossId),
            maxHp: StatsAccess.getMaxHp(world, this.bossId)
        };
    }

    getBossStatus(world: WorldState): { hp: number, maxHP: number, state: number } {
        if (this.bossId === -1) return { hp: 0, maxHP: 100, state: 0 };
        return {
            hp: StatsAccess.getHp(world, this.bossId),
            maxHP: StatsAccess.getMaxHp(world, this.bossId),
            state: 0 // Mock state for now as we didn't fully implement State Component yet
        };
    }
}
