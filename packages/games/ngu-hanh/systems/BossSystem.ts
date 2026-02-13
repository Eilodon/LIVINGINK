
import { WorldState, EntityManager, StatsAccess, EntityFlags, StateAccess } from '@cjr/engine';
import { GridSystem } from './GridSystem.js';
import { TileMod, ElementType } from '../types.js';
import { SeededRNG } from '../utils/SeededRNG.js';
import { AudioManager } from '../audio/AudioManager.js';
import { HapticManager } from '../audio/HapticManager.js';

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

    private availableSkills: string[] = [];
    private rng!: SeededRNG;

    initialize(world: WorldState, entityManager: EntityManager, config: { hp: number, damageMultiplier: number, skills: string[] }, seed: number): void {
        this.bossId = entityManager.createEntity();
        this.availableSkills = config.skills;
        this.rng = new SeededRNG(seed);

        // Determine Boss Type visually (simplified)
        // In real impl, config would have 'visualType' or 'name'
        // For now, assume based on skills? Or just random?
        // Let's use first skill to determine type for now
        if (config.skills.includes('ASH_SPREAD')) this.bossType = BossType.FIRE_PHOENIX;
        else if (config.skills.includes('STONE_WALL')) this.bossType = BossType.EARTH_GOLEM;
        else if (config.skills.includes('LOCK_TILE')) this.bossType = BossType.METAL_DRAGON;
        else this.bossType = BossType.FIRE_PHOENIX; // Default

        // Activate
        StateAccess.activate(world, this.bossId);
        StateAccess.setFlag(world, this.bossId, EntityFlags.BOSS);

        // Stats
        StatsAccess.setHp(world, this.bossId, config.hp);
        StatsAccess.setMaxHp(world, this.bossId, config.hp);
        StatsAccess.setDefense(world, this.bossId, 10 * config.damageMultiplier); // Defense scaling

        console.log(`[BossSystem] Boss Spawned! ID: ${this.bossId}, HP: ${config.hp}, Skills: ${config.skills.join(', ')}`);
    }

    onMatch(world: WorldState, count: number, multiplier: number): void {
        if (this.bossId === -1 || (StateAccess.getFlags(world, this.bossId) & EntityFlags.DEAD)) return;

        // Damage Formula
        const damage = count * 10 * multiplier;

        const currentHp = StatsAccess.getHp(world, this.bossId);
        const newHp = Math.max(0, currentHp - damage);

        StatsAccess.setHp(world, this.bossId, newHp);

        console.log(`[BossSystem] Boss take ${damage} dmg! HP: ${newHp}/${StatsAccess.getMaxHp(world, this.bossId)}`);

        // Audio/Haptic
        AudioManager.getInstance().playSound('boss_damage');
        HapticManager.getInstance().trigger('boss_damage');

        if (newHp <= 0) {
            this.onBossDeath(world);
        }
    }

    /**
     * Called every player move
     */
    onPlayerMove(world: WorldState, gridSystem: GridSystem, setVisualState: (id: number, state: number) => void): void {
        if (this.bossId === -1 || (StateAccess.getFlags(world, this.bossId) & EntityFlags.DEAD)) return;

        this.movesCounter++;
        console.log(`[BossSystem] Move ${this.movesCounter}/${this.movesPerAction}`);

        if (this.movesCounter >= this.movesPerAction) {
            this.executeSkill(world, gridSystem, setVisualState);
            this.movesCounter = 0;
        }
    }

    private executeSkill(world: WorldState, gridSystem: GridSystem, setVisualState: (id: number, state: number) => void): void {
        if (this.availableSkills.length === 0) return;

        // Pick random available skill
        const skill = this.rng.nextElement(this.availableSkills);
        if (!skill) return;
        console.log(`[BossSystem] EXECUTING SKILL: ${skill}`);

        switch (skill) {
            case 'ASH_SPREAD':
                this.skillAshSpread(world, gridSystem, setVisualState);
                break;
            case 'STONE_WALL':
                this.skillStoneWall(world, gridSystem, setVisualState);
                break;
            case 'LOCK_TILE':
                this.skillMetalLock(world, gridSystem, setVisualState);
                break;
            default:
                console.warn(`[BossSystem] Unknown skill: ${skill}`);
                break;
        }
    }

    // Skill 1: Ash Spread - Converts 3 random tiles to Ash
    // Skill 1: Ash Spread - Converts neighbors of existing Ash to Ash (Infection)
    private skillAshSpread(world: WorldState, gridSystem: GridSystem, setVisualState: (id: number, state: number) => void): void {
        const ashTiles = gridSystem.getTilesByElementAndFlag(11, 2); // Ash Element & Flag

        if (ashTiles.length === 0) {
            // Initial Infection: Spawn 3 random Ash tiles
            const count = 3;
            gridSystem.spawnSpecial(count, 11, 2, 10);
            console.log(`[BossSystem] Initial Ash Infection on ${count} tiles!`);
            return;
        }

        let spreadCount = 0;
        ashTiles.forEach(tileIdx => {
            const neighbors = gridSystem.getNeighborIndices(tileIdx);
            neighbors.forEach(neighborIdx => {
                // 30% chance to infect clean tiles
                if (this.rng.chance(0.3) && gridSystem.getMod(neighborIdx) === TileMod.NONE) {
                    gridSystem.setMod(world, neighborIdx, TileMod.ASH, setVisualState);
                    spreadCount++;
                }
            });
        });

        console.log(`[BossSystem] Ash infection spread to ${spreadCount} new tiles.`);
    }

    // Skill 2: Stone Wall - Spawns 2 Stone Blocks
    private skillStoneWall(world: WorldState, gridSystem: GridSystem, setVisualState: (id: number, state: number) => void): void {
        const count = 2;
        // Stone = Element 10, Flag 0. Exclude 'Stone' (10).
        gridSystem.spawnSpecial(count, 10, 0, 10);
        console.log(`[BossSystem] Spawning STONE WALL (${count} blocks)!`);
    }

    // Skill 3: Metal Lock - Locks 1 random tile
    private skillMetalLock(world: WorldState, gridSystem: GridSystem, setVisualState: (id: number, state: number) => void): void {
        // Locking requires finding a valid tile that acts as "Metal" or just any tile?
        // Typically Metal Boss locks Metal tiles or random tiles.
        // Let's use manual loop for "Lock" because we want to Preserve Element.
        // spawnSpecial replaces element.

        let attempts = 0;
        while (attempts < 10) {
            const tileId = gridSystem.getRandomTileId();
            if (tileId !== -1) {
                const currentMod = gridSystem.getMod(tileId);
                if (currentMod === TileMod.NONE) {
                    // Apply Lock (Flag 4)
                    gridSystem.setFlag(tileId, 4);
                    console.log(`[BossSystem] Tile ${tileId} LOCKED!`);
                    break;
                }
            }
            attempts++;
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
