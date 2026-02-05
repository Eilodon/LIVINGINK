/**
 * @cjr/engine - Boss Logic
 * Pure boss AI and combat - VFX decoupled via eventBuffer
 */

import { eventBuffer, EngineEventType, TEXT_IDS } from '../../events/EventRingBuffer';
import { distanceSquared } from '../../math/FastMath';
import { PhysicsStore } from '../../compat';

/**
 * Minimal entity interfaces
 */
export interface IBossEntity {
    id: string;
    physicsIndex?: number;
    position: { x: number; y: number };
    velocity: { x: number; y: number };
    isDead: boolean;
    bossAttackTimer?: number;
}

export interface IPlayerEntity {
    id: string;
    physicsIndex?: number;
    position: { x: number; y: number };
    isDead: boolean;
    score: number;
}

export interface IBossState {
    runtime: {
        boss: {
            bossDefeated: boolean;
            rushWindowTimer: number;
            rushWindowRing: number | null;
            currentBossActive: boolean;
            attackCharging: boolean;
            attackTarget: IPlayerEntity | null;
            attackChargeTimer: number;
        };
    };
}

/**
 * Update boss AI logic
 */
export const updateBossLogic = (
    boss: IBossEntity | null,
    players: IPlayerEntity[],
    dt: number
): void => {
    if (!boss || boss.isDead) {
        return;
    }

    const target = findNearestTarget(players, boss);

    if (target) {
        const dx = target.position.x - boss.position.x;
        const dy = target.position.y - boss.position.y;
        const dist = Math.hypot(dx, dy);

        // Move towards target
        const speed = 100;
        if (dist > 50) {
            const vx = (dx / dist) * speed;
            const vy = (dy / dist) * speed;

            // EIDOLON-V P1: Sync to DOD if boss has physicsIndex
            if (boss.physicsIndex !== undefined) {
                PhysicsStore.setVelocity(boss.physicsIndex, vx, vy);
            }
            boss.velocity.x = vx;
            boss.velocity.y = vy;
        }

        // Dash Attack Logic
        if (!boss.bossAttackTimer) boss.bossAttackTimer = 0;
        boss.bossAttackTimer -= dt;

        if (boss.bossAttackTimer <= 0) {
            // Dash!
            const dashVx = boss.velocity.x * 3;
            const dashVy = boss.velocity.y * 3;

            if (boss.physicsIndex !== undefined) {
                PhysicsStore.setVelocity(boss.physicsIndex, dashVx, dashVy);
            }
            boss.velocity.x = dashVx;
            boss.velocity.y = dashVy;
            boss.bossAttackTimer = 5; // 5s cooldown
        }
    }
};

export const resetBossState = (runtime: IBossState['runtime']): void => {
    if (!runtime.boss) return;
    runtime.boss.bossDefeated = false;
    runtime.boss.rushWindowTimer = 0;
    runtime.boss.rushWindowRing = null;
    runtime.boss.currentBossActive = false;
    runtime.boss.attackCharging = false;
    runtime.boss.attackTarget = null;
    runtime.boss.attackChargeTimer = 0;
};

export const isRushWindowActive = (
    runtime: IBossState['runtime'],
    ring: number
): boolean => {
    if (!runtime.boss) return false;
    return runtime.boss.rushWindowTimer > 0 && runtime.boss.rushWindowRing === ring;
};

export const getRushThreshold = (): number => {
    return 0.8;
};

const findNearestTarget = (
    players: IPlayerEntity[],
    boss: IBossEntity
): IPlayerEntity | null => {
    let nearest: IPlayerEntity | null = null;
    let minD = Infinity;

    for (const p of players) {
        if (p.isDead) continue;
        const d = distanceSquared(p.position, boss.position);
        if (d < minD) {
            minD = d;
            nearest = p;
        }
    }
    return nearest;
};

/**
 * Handle boss death - emits VFX events instead of direct calls
 */
export const onBossDeath = (
    players: IPlayerEntity[],
    runtime: IBossState['runtime']
): void => {
    runtime.boss.bossDefeated = true;
    runtime.boss.rushWindowTimer = 5.0;
    runtime.boss.rushWindowRing = 2;

    // Emit VFX events for each player
    players.forEach(p => {
        p.score += 500;

        eventBuffer.push(
            EngineEventType.FLOATING_TEXT,
            p.physicsIndex ?? 0,
            p.position.x,
            p.position.y,
            TEXT_IDS.BOSS_SLAIN
        );
    });
};

// ============================================================================
// LEGACY-COMPATIBLE WRAPPERS (for client migration)
// ============================================================================

/**
 * Legacy-compatible updateBossLogic
 * Matches client signature: (state: GameState, dt: number) => void
 */
export const updateBossLogicLegacy = (
    state: {
        boss: IBossEntity | null;
        players: IPlayerEntity[];
    },
    dt: number
): void => {
    updateBossLogic(state.boss, state.players, dt);
};

/**
 * Legacy-compatible resetBossState  
 * Matches client signature: (runtime: any) => void
 */
export const resetBossStateLegacy = (runtime: IBossState['runtime']): void => {
    resetBossState(runtime);
};
