
import { GameState, Player } from '../../types';
import { THRESHOLDS, RING_RADII } from './cjrConstants';

export const updateWinCondition = (state: GameState, dt: number, levelConfig: any) => {
    // Only check for players inside center zone (e.g. radius < 200)
    const WIN_ZONE_RADIUS = 200;

    let potentialWinner: Player | null = null;

    const playersToCheck = [...state.players, ...state.bots];

    for (const p of playersToCheck) {
        if (p.isDead) continue;

        // Check Physics
        const d = Math.hypot(p.position.x, p.position.y);
        if (d < WIN_ZONE_RADIUS) {
            if ('matchPercent' in p && p.matchPercent >= THRESHOLDS.WIN_HOLD) {
                potentialWinner = p as Player; // Bots can win?
                break;
            }
        }
    }

    if (potentialWinner) {
        if (!potentialWinner.kingForm) potentialWinner.kingForm = 0;

        potentialWinner.kingForm += dt;

        const pulseInterval = 0.5;
        if (potentialWinner.kingForm % pulseInterval < dt) {
            // Pulse!
            state.vfxEvents.push(`pulse_${potentialWinner.id}`);
            state.shakeIntensity = 5;
        }

        // Win Condition
        if (potentialWinner.kingForm >= 1.5) { // 1.5s Hold
            state.result = 'win';
            state.kingId = potentialWinner.id;
        }

    } else {
        // Decay channel if not holding
        for (const p of playersToCheck) {
            if ((p.kingForm || 0) > 0) {
                p.kingForm = Math.max(0, (p.kingForm || 0) - dt * 2);
            }
        }
    }
};
