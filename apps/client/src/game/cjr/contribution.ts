import { GameState, Player } from '@/types';
import { StatusFlag } from '../engine/statusFlags';

export const resetContributionLog = (runtime: any) => {
  runtime.contribution.damageLog.clear();
  runtime.contribution.lastHitBy.clear();
};

export const trackBossDamage = (state: GameState, playerId: string, damage: number) => {
  const current = state.runtime.contribution.damageLog.get(playerId) || 0;
  state.runtime.contribution.damageLog.set(playerId, current + damage);
};

export const trackDamage = (attacker: any, victim: any, amount: number, state: GameState) => {
  if (victim.isBoss) {
    trackBossDamage(state, attacker.id, amount);
  }
};

export const distributeBossRewards = (state: GameState) => {
  // Sort damage log
  const damages = Array.from(state.runtime.contribution.damageLog.entries()).sort(
    (a, b) => b[1] - a[1]
  );

  damages.forEach((entry, index) => {
    const [pid, dmg] = entry;
    // Find player
    const player = state.players.find(p => p.id === pid);
    if (!player) return;

    // Tier Logic
    if (index === 0) {
      // Top 1
      applyReward(player, { speed: 1.2, duration: 4000, shield: true });
    } else if (index < 3) {
      // Top 2-3
      applyReward(player, { speed: 1.15, duration: 3000, shield: false });
    } else {
      // Participation
      applyReward(player, { speed: 1.1, duration: 2000, shield: false });
    }
  });

  // Clear log
  state.runtime.contribution.damageLog.clear();
};

const applyReward = (player: Player, reward: any) => {
  player.statusMultipliers.speed = reward.speed;
  player.statusTimers.tempSpeed = reward.duration / 1000;
  if (reward.shield) {
    player.statusFlags |= StatusFlag.SHIELDED;
    player.statusTimers.invulnerable = 2.0;
  }
};
