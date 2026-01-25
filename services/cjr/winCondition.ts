import { RING_THRESHOLDS, WIN_HOLD_DURATION } from './cjrConstants';

export type WinState = {
    isHolding: boolean;
    holdTimer: number; // 0 -> WIN_HOLD_DURATION
    winnerId: string | null;
    pulseScale: number; // 0..1 for rendering heartbeat
};

import { GameState, Player, RingId } from '../../types';

export function updateWinCondition(
    state: GameState,
    dt: number,
    config: any
) {
    if (state.result) return;

    state.players.forEach(p => {
        if (p.isDead) return;

        // Check if eligible (Center Ring + High Match)
        // Center Ring is Radius < 150 (approx) or just RingId.Inner
        const dist = Math.hypot(p.position.x, p.position.y);
        const inCenter = dist < 200 && p.ring === 3;
        const hasMatch = p.matchPercent >= 0.90; // Win Hold Threshold

        if (inCenter && hasMatch) {
            p.stationaryTime = (p.stationaryTime || 0) + dt;

            // WIN CONDITION MET
            if (p.stationaryTime >= (config.winHoldSeconds || 1.5)) {
                state.result = 'win';
                state.kingId = p.id;
                state.isPaused = true;
                // Add bonus score
                p.score += 5000;
            }
        } else {
            // Decay
            if (p.stationaryTime > 0) {
                p.stationaryTime = Math.max(0, p.stationaryTime - dt * 2);
            }
        }
    });

    // Also check time limit
    if (state.gameTime >= config.timeLimit && !state.result) {
        state.result = 'lose';
        state.isPaused = true;
    }
}
