/**
 * CJR BOSS SYSTEM - Simplified (1 Boss)
 * 
 * Features:
 * - Single Ring Guardian boss in Ring2
 * - Boss death triggers Rush Window
 * - Telegraph attack patterns with visual warnings
 * - Contribution tracking for tier rewards
 * - "Rush Window" buff when boss dies
 */

import { RING_RADII } from './cjrConstants';
import { GameState, Bot, Player, Vector2 } from '../../types';
import { createBoss, createProjectile } from '../engine/factories';
import { getCurrentSpatialGrid } from '../engine/context';
import { distance, normalize } from '../engine/math';
import { applyContributionBuffs, resetContributionLog, getContributionRanking, getLastHitter, getPlayerDamage } from './contribution';
import { createFloatingText } from '../engine/effects';
import { LevelConfig } from './levels';

// ============================================
// BOSS CONFIGURATION (SINGLE BOSS)
// ============================================

interface BossConfig {
    id: 'ring_guardian';
    name: string;
    guardsRing: 2;
    spawnTime: number;      // Game time to spawn
    health: number;
    radius: number;
    leashRadius: number;
    attackInterval: number;
    attackPattern: 'telegraph' | 'rapid';
    telegraphDuration: number;
}

const BOSS_CONFIG: BossConfig = {
    id: 'ring_guardian',
    name: 'Ring Guardian',
    guardsRing: 2,
    spawnTime: 45,
    health: 600,
    radius: 65,
    leashRadius: RING_RADII.R2_BOUNDARY,
    attackInterval: 3.0,
    attackPattern: 'telegraph',
    telegraphDuration: 1.0,
};

// State tracking (simplified)
interface BossState {
    bossDefeated: boolean;
    rushWindowTimer: number;
    rushWindowRing: 2 | null;
    currentBossActive: boolean;
    attackCharging: boolean;
    attackTarget: Vector2 | null;
}

let bossState: BossState = {
    bossDefeated: false,
    rushWindowTimer: 0,
    rushWindowRing: null,
    currentBossActive: false,
    attackCharging: false,
    attackTarget: null,
};

/**
 * Check if a ring is accessible (boss defeated or not yet guarded)
 */
export const isRingAccessible = (ring: 2 | 3): boolean => {
    if (ring === 2) {
        return bossState.bossDefeated;
    }
    if (ring === 3) {
        return true; // Ring 3 always accessible (no boss2)
    }
    return true;
};

/**
 * Check if Rush Window is active for a ring
 */
export const isRushWindowActive = (ring: 2 | 3): boolean => {
    return bossState.rushWindowTimer > 0 && bossState.rushWindowRing === ring;
};

/**
 * Get remaining Rush Window time
 */
export const getRushWindowTime = (): number => bossState.rushWindowTimer;

/**
 * Handle boss defeat
 */
const handleBossDefeat = (state: GameState) => {
    bossState.bossDefeated = true;
    bossState.currentBossActive = false;
    bossState.rushWindowTimer = 5.0; // 5 second rush window
    bossState.rushWindowRing = 2;

    // Apply contribution rewards
    const rankings = getContributionRanking();
    rankings.forEach((entry) => {
        const entity = state.player.id === entry.id ? state.player : state.bots.find(b => b.id === entry.id);
        if (entity) {
            // Apply simple buff - speed boost
            entity.statusEffects.tempSpeedBoost = 1.2;
            entity.statusEffects.tempSpeedTimer = 5.0;
        }
    });

    // Last hitter bonus
    const lastHitter = getLastHitter('ring_guardian');
    if (lastHitter) {
        const entity = state.player.id === lastHitter ? state.player : state.bots.find(b => b.id === lastHitter);
        if (entity) {
            entity.statusEffects.tempSpeedBoost = 1.3;
            entity.statusEffects.tempSpeedTimer = 3.0;
        }
    }

    createFloatingText({ x: 0, y: 0 }, 'BOSS DEFEATED!', '#ff0000', 32, state);
    resetContributionLog();
};

/**
 * Update boss AI
 */
const updateBossAI = (boss: Bot, state: GameState, dt: number) => {
    // Leash to Ring 2
    const distFromCenter = distance(boss.position, { x: 0, y: 0 });
    if (distFromCenter > BOSS_CONFIG.leashRadius) {
        const pullBack = normalize({ x: -boss.position.x, y: -boss.position.y });
        boss.velocity.x += pullBack.x * 200 * dt;
        boss.velocity.y += pullBack.y * 200 * dt;
    }

    // Find target (closest player/bot)
    let closestTarget: Player | Bot | null = null;
    let closestDist = Infinity;
    
    [state.player, ...state.bots].forEach(entity => {
        if (entity.isDead) return;
        const dist = distance(boss.position, entity.position);
        if (dist < closestDist) {
            closestDist = dist;
            closestTarget = entity;
        }
    });

    if (!closestTarget) return;

    // Attack logic
    boss.bossAttackTimer = (boss.bossAttackTimer || 0) + dt;

    if (boss.bossAttackTimer >= BOSS_CONFIG.attackInterval) {
        boss.bossAttackTimer = 0;

        if (BOSS_CONFIG.attackPattern === 'telegraph') {
            // Telegraph attack
            bossState.attackCharging = true;
            bossState.attackTarget = closestTarget.position;
            setTimeout(() => {
                executeAttack(boss, closestTarget!, state);
                bossState.attackCharging = false;
                bossState.attackTarget = null;
            }, BOSS_CONFIG.telegraphDuration * 1000);
        } else {
            // Rapid attack
            executeAttack(boss, closestTarget, state);
        }
    }
};

/**
 * Execute boss attack
 */
const executeAttack = (boss: Bot, target: Player | Bot, state: GameState) => {
    const projectile = createProjectile(
        boss.id,
        boss.position,
        target.position,
        15,
        'web',
        2.0
    );
    
    state.projectiles.push(projectile);
};

/**
 * Apply candy wind effect during Ring 3 rush window
 */
export const applyCandyWind = (entity: Player | Bot, dt: number) => {
    if (bossState.rushWindowTimer > 0 && bossState.rushWindowRing === 2) {
        const pullForce = 50 * dt;
        entity.velocity.x += -entity.position.x * pullForce * 0.01;
        entity.velocity.y += -entity.position.y * pullForce * 0.01;
    }
};

/**
 * Main boss logic update
 */
export const updateBossLogic = (state: GameState, dt: number) => {
    // Update rush window timer
    if (bossState.rushWindowTimer > 0) {
        bossState.rushWindowTimer -= dt;
    }

    // Spawn boss
    if (!bossState.bossDefeated && !bossState.currentBossActive && state.gameTime >= BOSS_CONFIG.spawnTime) {
        const boss = createBoss(BOSS_CONFIG.spawnTime);
        boss.position = { x: RING_RADII.R2_BOUNDARY * 0.7, y: 0 };
        boss.radius = BOSS_CONFIG.radius;
        boss.isBoss = true;
        
        state.boss = boss;
        state.bots.push(boss);
        bossState.currentBossActive = true;
        
        createFloatingText(boss.position, 'RING GUARDIAN APPEARED!', '#ff0000', 24, state);
    }

    // Update boss AI
    if (state.boss && !state.boss.isDead) {
        updateBossAI(state.boss, state, dt);
        
        // Check defeat
        if (state.boss.currentHealth <= 0) {
            handleBossDefeat(state);
            state.boss.isDead = true;
            state.boss = null;
        }
    }
};

/**
 * Reset boss state for new game
 */
export const resetBossState = () => {
    bossState = {
        bossDefeated: false,
        rushWindowTimer: 0,
        rushWindowRing: null,
        currentBossActive: false,
        attackCharging: false,
        attackTarget: null,
    };
};

/**
 * Get boss state for rendering
 */
export const getBossState = () => bossState;

/**
 * Legacy exports for compatibility
 */
export const getRushWindowInfo = () => ({
    active: bossState.rushWindowTimer > 0,
    ring: bossState.rushWindowRing,
    timeLeft: bossState.rushWindowTimer
});

export const getRushThreshold = () => 0.8; // Simplified

// Export bossState for tests (read-only)
export { bossState };
