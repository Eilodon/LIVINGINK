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
import { createBoss, createParticle, createProjectile } from '../engine/factories';
import { getCurrentSpatialGrid } from '../engine/context';
import { distance, normalize } from '../engine/math';
import { applyContributionBuffs, resetContributionLog, getLastHitter } from './contribution';
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
    leashRadius: RING_RADII.R2,
    attackInterval: 3.0,
    attackPattern: 'telegraph',
    telegraphDuration: 1.0,
};

const getBossState = (state: GameState) => state.runtime.boss;

/**
 * Check if a ring is accessible (boss defeated or not yet guarded)
 */
export const isRingAccessible = (state: GameState, ring: 2 | 3): boolean => {
    const bossState = getBossState(state);
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
export const isRushWindowActive = (state: GameState, ring: 2 | 3): boolean => {
    const bossState = getBossState(state);
    return bossState.rushWindowTimer > 0 && bossState.rushWindowRing === ring;
};

/**
 * Get remaining Rush Window time
 */
export const getRushWindowTime = (state: GameState): number => getBossState(state).rushWindowTimer;

/**
 * Handle boss defeat
 */
const handleBossDefeat = (state: GameState) => {
    const bossState = getBossState(state);
    bossState.bossDefeated = true;
    bossState.currentBossActive = false;
    bossState.rushWindowTimer = 5.0; // 5 second rush window
    bossState.rushWindowRing = 2;

    // Apply contribution rewards
    const participants = [state.player, ...state.bots].filter(p => !p.isDead);
    applyContributionBuffs(participants, state.runtime, state);

    // Last hitter bonus
    const lastHitter = getLastHitter(state.runtime, 'ring_guardian');
    if (lastHitter) {
        const entity = state.player.id === lastHitter ? state.player : state.bots.find(b => b.id === lastHitter);
        if (entity) {
            entity.statusEffects.tempSpeedBoost = 1.3;
            entity.statusEffects.tempSpeedTimer = 3.0;
        }
    }

    createFloatingText({ x: 0, y: 0 }, 'BOSS DEFEATED!', '#ff0000', 32, state);
    resetContributionLog(state.runtime);
};

/**
 * Update boss AI
 */
const updateBossAI = (boss: Bot, state: GameState, dt: number) => {
    const bossState = getBossState(state);
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

    const players = state.players?.length ? state.players : [state.player];
    [...players, ...state.bots].forEach(entity => {
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
            if (!bossState.attackCharging) {
                bossState.attackCharging = true;
                bossState.attackChargeTimer = BOSS_CONFIG.telegraphDuration;
                bossState.attackTarget = { ...closestTarget.position };
                spawnTelegraph(bossState.attackTarget, state);
            }
        } else {
            // Rapid attack
            executeAttack(boss, closestTarget.position, state);
        }
    }
};

/**
 * Execute boss attack
 */
const executeAttack = (boss: Bot, targetPos: Vector2, state: GameState) => {
    const healthRatio = boss.currentHealth / Math.max(1, boss.maxHealth);
    const roll = Math.random();

    if (healthRatio < 0.25) {
        if (roll < 0.33) {
            spawnBossPulse(boss.position, state, '#ef4444');
            fireRadialBurst(boss, state, 12);
        } else if (roll < 0.66) {
            spawnBossPulse(boss.position, state, '#f97316');
            fireCross(boss, state, 8);
        } else {
            spawnBossPulse(boss.position, state, '#f59e0b');
            fireSpiral(boss, state, 10);
        }
        return;
    }

    if (healthRatio < 0.5) {
        if (roll < 0.3) {
            spawnBossPulse(boss.position, state, '#ef4444');
            fireRadialBurst(boss, state, 8);
        } else if (roll < 0.6) {
            fireSpread(boss, targetPos, state, 5, Math.PI / 12);
        } else {
            fireCross(boss, state, 4);
        }
        return;
    }

    fireSingle(boss, targetPos, state);
};

const spawnTelegraph = (targetPos: Vector2, state: GameState) => {
    const ring = createParticle(targetPos.x, targetPos.y, '#ef4444', 0);
    ring.style = 'ring';
    ring.lineWidth = 3;
    ring.pulseRadius = 20;
    ring.pulseMaxRadius = 140;
    ring.pulseSpeed = 180;
    ring.maxLife = BOSS_CONFIG.telegraphDuration;
    ring.life = ring.maxLife;
    ring.fadeOut = true;
    ring.isPulse = true;
    state.particles.push(ring);

    const inner = createParticle(targetPos.x, targetPos.y, '#f97316', 0);
    inner.style = 'ring';
    inner.lineWidth = 2;
    inner.pulseRadius = 10;
    inner.pulseMaxRadius = 80;
    inner.pulseSpeed = 220;
    inner.maxLife = BOSS_CONFIG.telegraphDuration;
    inner.life = inner.maxLife;
    inner.fadeOut = true;
    inner.isPulse = true;
    state.particles.push(inner);
};

const fireSingle = (boss: Bot, targetPos: Vector2, state: GameState) => {
    const projectile = createProjectile(
        boss.id,
        boss.position,
        targetPos,
        15,
        'web',
        2.0
    );
    state.projectiles.push(projectile);
};

const fireSpread = (boss: Bot, targetPos: Vector2, state: GameState, count: number, spreadAngle: number) => {
    const dir = normalize({
        x: targetPos.x - boss.position.x,
        y: targetPos.y - boss.position.y
    });
    const baseAngle = Math.atan2(dir.y, dir.x);
    const aimDistance = 240;

    for (let i = 0; i < count; i++) {
        const offset = (i - Math.floor(count / 2)) * spreadAngle;
        const angle = baseAngle + offset;
        const aim = {
            x: boss.position.x + Math.cos(angle) * aimDistance,
            y: boss.position.y + Math.sin(angle) * aimDistance
        };
        const projectile = createProjectile(
            boss.id,
            boss.position,
            aim,
            12,
            'web',
            2.0
        );
        state.projectiles.push(projectile);
    }
};

const fireRadialBurst = (boss: Bot, state: GameState, count: number) => {
    const aimDistance = 200;
    for (let i = 0; i < count; i++) {
        const angle = (i / count) * Math.PI * 2;
        const aim = {
            x: boss.position.x + Math.cos(angle) * aimDistance,
            y: boss.position.y + Math.sin(angle) * aimDistance
        };
        const projectile = createProjectile(
            boss.id,
            boss.position,
            aim,
            10,
            'web',
            2.0
        );
        state.projectiles.push(projectile);
    }
};

const fireCross = (boss: Bot, state: GameState, count: number) => {
    const aimDistance = 220;
    const steps = Math.max(4, count);
    for (let i = 0; i < steps; i++) {
        const angle = (i / steps) * Math.PI * 2;
        const aim = {
            x: boss.position.x + Math.cos(angle) * aimDistance,
            y: boss.position.y + Math.sin(angle) * aimDistance
        };
        const projectile = createProjectile(
            boss.id,
            boss.position,
            aim,
            11,
            'web',
            2.0
        );
        state.projectiles.push(projectile);
    }
};

const fireSpiral = (boss: Bot, state: GameState, count: number) => {
    const aimDistance = 210;
    const offset = Math.random() * Math.PI * 2;
    for (let i = 0; i < count; i++) {
        const angle = offset + (i / count) * Math.PI * 2;
        const aim = {
            x: boss.position.x + Math.cos(angle) * aimDistance,
            y: boss.position.y + Math.sin(angle) * aimDistance
        };
        const projectile = createProjectile(
            boss.id,
            boss.position,
            aim,
            10,
            'web',
            2.2
        );
        state.projectiles.push(projectile);
    }
};

const spawnBossPulse = (position: Vector2, state: GameState, color: string) => {
    const pulse = createParticle(position.x, position.y, color, 0);
    pulse.style = 'ring';
    pulse.lineWidth = 4;
    pulse.pulseRadius = 40;
    pulse.pulseMaxRadius = 180;
    pulse.pulseSpeed = 240;
    pulse.maxLife = 0.6;
    pulse.life = pulse.maxLife;
    pulse.fadeOut = true;
    pulse.isPulse = true;
    state.particles.push(pulse);
};

/**
 * Apply candy wind effect during Ring 3 rush window
 */
export const applyCandyWind = (entity: Player | Bot, state: GameState, dt: number) => {
    const bossState = getBossState(state);
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
    const bossState = getBossState(state);
    // Update rush window timer
    if (bossState.rushWindowTimer > 0) {
        bossState.rushWindowTimer -= dt;
    }

    // Spawn boss
    if (!bossState.bossDefeated && !bossState.currentBossActive && state.gameTime >= BOSS_CONFIG.spawnTime) {
        const boss = createBoss(BOSS_CONFIG.spawnTime);
        boss.position = { x: RING_RADII.R2 * 0.7, y: 0 };
        boss.radius = BOSS_CONFIG.radius;
        boss.isBoss = true;
        boss.maxHealth = BOSS_CONFIG.health;
        boss.currentHealth = BOSS_CONFIG.health;

        state.boss = boss;
        state.bots.push(boss);
        bossState.currentBossActive = true;

        createFloatingText(boss.position, 'RING GUARDIAN APPEARED!', '#ff0000', 24, state);
    }

    // Update boss AI
    if (state.boss && !state.boss.isDead) {
        updateBossAI(state.boss, state, dt);

        if (bossState.attackCharging) {
            bossState.attackChargeTimer -= dt;
            if (bossState.attackChargeTimer <= 0 && bossState.attackTarget) {
                executeAttack(state.boss, bossState.attackTarget, state);
                bossState.attackCharging = false;
                bossState.attackTarget = null;
                bossState.attackChargeTimer = 0;
            }
        }

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
export const resetBossState = (runtime: GameState['runtime']) => {
    runtime.boss = {
        bossDefeated: false,
        rushWindowTimer: 0,
        rushWindowRing: null,
        currentBossActive: false,
        attackCharging: false,
        attackTarget: null,
        attackChargeTimer: 0,
    };
};

/**
 * Get boss state for rendering
 */
export const getBossStateSnapshot = (state: GameState) => getBossState(state);

/**
 * Legacy exports for compatibility
 */
export const getRushWindowInfo = (state: GameState) => {
    const bossState = getBossState(state);
    return {
        active: bossState.rushWindowTimer > 0,
        ring: bossState.rushWindowRing,
        timeLeft: bossState.rushWindowTimer
    };
};

export const getRushThreshold = () => 0.8; // Simplified
