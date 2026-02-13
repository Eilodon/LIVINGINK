
import { WorldState, EntityManager, StatsAccess, EntityFlags, StateAccess } from '@cjr/engine';

export class BossSystem {
    private bossId: number = -1;

    initialize(world: WorldState, entityManager: EntityManager, level: number = 1): void {
        this.bossId = entityManager.createEntity();

        // Activate
        StateAccess.activate(world, this.bossId);
        StateAccess.setFlag(world, this.bossId, EntityFlags.BOSS);

        // Stats
        const maxHp = 1000 * level;
        StatsAccess.setHp(world, this.bossId, maxHp);
        StatsAccess.setMaxHp(world, this.bossId, maxHp);
        StatsAccess.setDefense(world, this.bossId, 5 * level);

        console.log(`[BossSystem] Boss Spawned! ID: ${this.bossId}, HP: ${maxHp}`);
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
}
