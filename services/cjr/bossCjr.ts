/**
 * CJR BOSS SYSTEM - Drama Style
 * 
 * Features:
 * - Boss1 appears in Ring2, Boss2 in Ring3
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
// BOSS CONFIGURATION
// ============================================

interface BossConfig {
    id: 'boss1' | 'boss2';
    name: string;
    guardsRing: 2 | 3;
    spawnTime: number;      // Game time to spawn
    health: number;
    radius: number;
    leashRadius: number;
    attackInterval: number;
    attackPattern: 'telegraph' | 'rapid';
    telegraphDuration: number;
}

const BOSS_CONFIGS: Record<string, BossConfig> = {
    boss1: {
        id: 'boss1',
        name: 'Ring Guardian I',
        guardsRing: 2,
        spawnTime: 45,
        health: 500,
        radius: 60,
        leashRadius: RING_RADII.R2_BOUNDARY,
        attackInterval: 3.0,
        attackPattern: 'telegraph',
        telegraphDuration: 1.0,
    },
    boss2: {
        id: 'boss2',
        name: 'Core Warden',
        guardsRing: 3,
        spawnTime: 120,
        health: 800,
        radius: 80,
        leashRadius: RING_RADII.R3_BOUNDARY,
        attackInterval: 2.0,
        attackPattern: 'rapid',
        telegraphDuration: 0.5,
    },
};

// State tracking
interface BossState {
    boss1Defeated: boolean;
    boss2Defeated: boolean;
    rushWindowTimer: number;
    rushWindowRing: 2 | 3 | null;
    currentBossId: 'boss1' | 'boss2' | null;
    attackCharging: boolean;
    attackTarget: Vector2 | null;
}

let bossState: BossState = {
    boss1Defeated: false,
    boss2Defeated: false,
    rushWindowTimer: 0,
    rushWindowRing: null,
    currentBossId: null,
    attackCharging: false,
    attackTarget: null,
};

/**
 * Check if a ring is accessible (boss defeated or not yet guarded)
 */
export const isRingAccessible = (ring: 2 | 3): boolean => {
    if (ring === 2) {
        return bossState.boss1Defeated;
    }
    if (ring === 3) {
        return bossState.boss2Defeated;
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
 * Get reduced threshold during rush window
 */
export const getRushThreshold = (baseThreshold: number): number => {
    // 20% easier during rush window
    return baseThreshold * 0.8;
};

/**
 * Main update function
 */
export const updateBossLogic = (state: GameState, dt: number) => {
    const levelConfig = state.levelConfig;
    const bossConfigs = getBossConfigs(levelConfig);

    // Update rush window timer
    if (bossState.rushWindowTimer > 0) {
        bossState.rushWindowTimer -= dt;
        if (bossState.rushWindowTimer <= 0) {
            bossState.rushWindowRing = null;
        }
    }

    if (bossState.rushWindowRing === 3 && bossState.rushWindowTimer > 0) {
        applyCandyWind(state, dt);
    }

    // Check if current boss is dead
    if (state.boss && state.boss.isDead) {
        handleBossDefeat(state);
        state.boss = null;
        bossState.currentBossId = null;
    }

    // Spawn boss based on game time
    if (!state.boss) {
        if (levelConfig.boss.boss1Enabled && !bossState.boss1Defeated && state.gameTime >= bossConfigs.boss1.spawnTime) {
            spawnBoss(state, 'boss1', bossConfigs.boss1);
        } else if (levelConfig.boss.boss2Enabled && bossState.boss1Defeated && !bossState.boss2Defeated &&
            state.gameTime >= bossConfigs.boss2.spawnTime) {
            spawnBoss(state, 'boss2', bossConfigs.boss2);
        }
        return;
    }

    // Boss AI
    updateBossAI(state, dt, bossConfigs);
};

/**
 * Spawn a boss
 */
const spawnBoss = (state: GameState, bossId: 'boss1' | 'boss2', config: BossConfig) => {
    const boss = createBoss();

    boss.id = bossId;
    boss.name = config.name;
    boss.isBoss = true;
    boss.maxHealth = config.health;
    boss.currentHealth = config.health;
    boss.radius = config.radius;

    // Position based on guarded ring
    const angle = Math.random() * Math.PI * 2;
    const r = config.leashRadius * 0.5;
    boss.position.x = Math.cos(angle) * r;
    boss.position.y = Math.sin(angle) * r;

    boss.bossAttackTimer = config.attackInterval;
    boss.bossAttackCharge = 0;

    state.boss = boss;
    state.bots.push(boss);
    bossState.currentBossId = bossId;

    // Reset contribution tracking for this fight
    resetContributionLog();

    console.log(`[CJR] ${config.name} has appeared! Defeat to unlock Ring ${config.guardsRing}!`);
    createFloatingText({ x: 0, y: -200 }, `${config.name} APPEARED!`, '#ff4444', 32, state);
};

/**
 * Handle boss defeat
 */
const handleBossDefeat = (state: GameState) => {
    const bossId = bossState.currentBossId;
    if (!bossId) return;

    const config = getBossConfigs(state.levelConfig)[bossId];

    // Mark defeated
    if (bossId === 'boss1') {
        bossState.boss1Defeated = true;
    } else {
        bossState.boss2Defeated = true;
    }

    // Apply contribution rewards
    const allPlayers = [state.player, ...state.bots.filter(b => !b.isBoss)] as Player[];
    applyContributionBuffs(allPlayers);

    applyFinisherHeadstart(state, config);

    // Start Rush Window
    bossState.rushWindowTimer = state.levelConfig.rushWindowDuration;
    bossState.rushWindowRing = config.guardsRing;

    console.log(`[CJR] ${config.name} DEFEATED! Ring ${config.guardsRing} unlocked! Rush Window active for ${state.levelConfig.rushWindowDuration}s!`);
    createFloatingText({ x: 0, y: 0 }, `RING ${config.guardsRing} UNLOCKED!`, '#00ff00', 40, state);
};

/**
 * Boss AI Logic
 */
const updateBossAI = (state: GameState, dt: number, bossConfigs: Record<'boss1' | 'boss2', BossConfig>) => {
    const boss = state.boss;
    if (!boss || boss.isDead) return;

    const config = bossConfigs[bossState.currentBossId || 'boss1'];

    // Leash to zone
    const distToCenter = distance(boss.position, { x: 0, y: 0 });
    if (distToCenter > config.leashRadius) {
        const pullStrength = 0.5;
        boss.velocity.x += (-boss.position.x * pullStrength * dt);
        boss.velocity.y += (-boss.position.y * pullStrength * dt);
    }

    // Find target
    const grid = getCurrentSpatialGrid();
    const nearby = grid.getNearby(boss);

    let closestTarget: Player | Bot | null = null;
    let minDist = Infinity;

    nearby.forEach(e => {
        if (e === boss || e.isDead) return;
        if ('score' in e && !('isBoss' in e && (e as Bot).isBoss)) {
            const d = distance(boss.position, e.position);
            if (d < minDist) {
                minDist = d;
                closestTarget = e as Player | Bot;
            }
        }
    });

    // Attack logic
    if (!boss.bossAttackTimer) boss.bossAttackTimer = 0;
    boss.bossAttackTimer -= dt;

    if (closestTarget && boss.bossAttackTimer <= 0) {
        if (config.attackPattern === 'telegraph') {
            // Start charging (visual telegraph)
            if (!bossState.attackCharging) {
                bossState.attackCharging = true;
                bossState.attackTarget = { ...closestTarget.position };
                boss.bossAttackCharge = config.telegraphDuration;

                // Visual warning
                createFloatingText(boss.position, '⚠️ CHARGING', '#ffff00', 24, state);
            }
        } else {
            // Rapid: immediate attack
            executeAttack(state, closestTarget.position);
            boss.bossAttackTimer = config.attackInterval;
        }
    }

    // Handle charge completion
    if (bossState.attackCharging && boss.bossAttackCharge) {
        boss.bossAttackCharge -= dt;
        if (boss.bossAttackCharge <= 0) {
            if (bossState.attackTarget) {
                executeAttack(state, bossState.attackTarget);
            }
            bossState.attackCharging = false;
            bossState.attackTarget = null;
            boss.bossAttackTimer = config.attackInterval;
        }
    }

    // Chase target slowly
    if (closestTarget && !bossState.attackCharging) {
        const dir = normalize({
            x: closestTarget.position.x - boss.position.x,
            y: closestTarget.position.y - boss.position.y,
        });
        const chaseSpeed = 50;
        boss.velocity.x += dir.x * chaseSpeed * dt;
        boss.velocity.y += dir.y * chaseSpeed * dt;
    }
};

/**
 * Execute boss attack
 */
const executeAttack = (state: GameState, target: Vector2) => {
    const boss = state.boss;
    if (!boss) return;

    const proj = createProjectile(
        boss.id,
        boss.position,
        target,
        50,     // damage
        'ice',  // type
        2.0     // duration
    );
    state.projectiles.push(proj);

    createFloatingText(boss.position, 'ATTACK!', '#ff0000', 20, state);
};

/**
 * Reset boss state for new game
 */
export const resetBossState = () => {
    bossState = {
        boss1Defeated: false,
        boss2Defeated: false,
        rushWindowTimer: 0,
        rushWindowRing: null,
        currentBossId: null,
        attackCharging: false,
        attackTarget: null,
    };
};

export const getRushWindowInfo = () => ({
    ring: bossState.rushWindowRing,
    timer: bossState.rushWindowTimer,
});

export { bossState, BOSS_CONFIGS };

const applyCandyWind = (state: GameState, dt: number) => {
    const all = [state.player, ...state.bots.filter(b => !b.isDead)] as Player[];
    all.forEach(p => {
        if (p.ring !== 3) return;
        const dir = normalize({ x: -p.position.x, y: -p.position.y });
        const strength = 30;
        p.velocity.x += dir.x * strength * dt;
        p.velocity.y += dir.y * strength * dt;
    });
};

const applyFinisherHeadstart = (state: GameState, config: BossConfig) => {
    const ranking = getContributionRanking();
    if (ranking.length === 0) return;

    const lastHitterId = getLastHitter(config.id);
    const topContributorId = ranking[0]?.id;
    let winnerId = topContributorId;

    if (lastHitterId) {
        const dmg = getPlayerDamage(lastHitterId);
        const rankIdx = ranking.findIndex(r => r.id === lastHitterId);
        const isTop3 = rankIdx >= 0 && rankIdx < 3;
        if (dmg >= config.health * 0.1 || isTop3) {
            winnerId = lastHitterId;
        }
    }

    const allPlayers = [state.player, ...state.bots.filter(b => !b.isBoss)] as Player[];
    const winner = allPlayers.find(p => p.id === winnerId);
    if (!winner) return;

    winner.statusEffects.tempSpeedBoost = Math.max(winner.statusEffects.tempSpeedBoost || 1, 1.15);
    winner.statusEffects.tempSpeedTimer = Math.max(winner.statusEffects.tempSpeedTimer || 0, 3.0);
    winner.statusEffects.shielded = true;
    winner.statusEffects.commitShield = 1.5;

    createFloatingText(winner.position, 'FINISHER BOOST!', '#00ff99', 22, state);
};

const getBossConfigs = (levelConfig: LevelConfig): Record<'boss1' | 'boss2', BossConfig> => ({
    boss1: {
        ...BOSS_CONFIGS.boss1,
        spawnTime: levelConfig.boss.boss1Time,
        health: levelConfig.boss.boss1Health,
    },
    boss2: {
        ...BOSS_CONFIGS.boss2,
        spawnTime: levelConfig.boss.boss2Time,
        health: levelConfig.boss.boss2Health,
    },
});
