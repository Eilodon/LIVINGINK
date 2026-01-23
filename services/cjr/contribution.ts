
import {
    CONTRIBUTION_TIERS
} from './cjrConstants';
import { Player, Bot } from '../../types';
import { createFloatingText } from '../engine/effects';

// In-memory tracking for match session
let damageLog: Map<string, number> = new Map();
let lastHitBy: Map<string, string> = new Map(); // Track last-hit for spotlight

export const trackDamage = (attacker: Player | Bot, victim: Player | Bot, amount: number) => {
    if (!attacker || !victim) return;

    const current = damageLog.get(attacker.id) || 0;
    damageLog.set(attacker.id, current + amount);

    // Track last hit for spotlight
    lastHitBy.set(victim.id, attacker.id);
};

export const getContributionRanking = () => {
    return Array.from(damageLog.entries())
        .map(([id, dmg]) => ({ id, dmg }))
        .sort((a, b) => b.dmg - a.dmg);
};

export const getLastHitter = (victimId: string): string | undefined => {
    return lastHitBy.get(victimId);
};

/**
 * Apply contribution-based rewards when boss dies
 * Vision doc spec:
 * - Top1: speed +20% 4s + shield 2s
 * - Top2-3: speed +15% 3s
 * - Top4-8: speed +10% 2s
 */
export const applyContributionBuffs = (players: (Player | Bot)[], state?: any) => {
    const ranking = getContributionRanking();

    players.forEach(p => {
        if (p.isDead) return;

        const rankIdx = ranking.findIndex(r => r.id === p.id);
        if (rankIdx === -1) return;

        const rank = rankIdx + 1; // 1-indexed

        if (rank === 1) {
            // Top1: Speed +20% for 4s, Shield 2s
            p.statusEffects.speedBoost = 1.20;
            p.statusEffects.shielded = true;
            p.statusEffects.commitShield = 2.0;
            if (state) createFloatingText(p.position, '🏆 TOP CONTRIBUTOR!', '#ffd700', 28, state);
        } else if (rank <= 3) {
            // Top2-3: Speed +15% for 3s
            p.statusEffects.speedBoost = 1.15;
            if (state) createFloatingText(p.position, '🥈 Great Effort!', '#c0c0c0', 22, state);
        } else if (rank <= 8) {
            // Top4-8: Speed +10% for 2s
            p.statusEffects.speedBoost = 1.10;
            if (state) createFloatingText(p.position, '⭐ Contributor!', '#cd7f32', 18, state);
        }
    });

    // Give last-hitter spotlight VFX (drama, but NOT exclusive reward)
    // This is handled separately in bossCjr when boss dies
};

/**
 * Reset tracking for new boss fight
 */
export const resetContributionLog = () => {
    damageLog = new Map();
    lastHitBy = new Map();
};

/**
 * Get total damage dealt to boss by player
 */
export const getPlayerDamage = (playerId: string): number => {
    return damageLog.get(playerId) || 0;
};
