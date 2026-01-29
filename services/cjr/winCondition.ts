
import { GameState, Player } from '../../types';
import { THRESHOLDS, RING_RADII } from '../../constants';
import { vfxSystem } from '../vfx/vfxSystem'; // EIDOLON-V: Static import

export const updateWinCondition = (state: GameState, dt: number, levelConfig: any) => {
    // EIDOLON-V: Support explicitly defined Win Condition from Level Config
    const winType = levelConfig.winCondition || 'default';

    // Default: Just time limit or elimination (handled in engine loop)
    if (winType === 'default') return;

    if (winType === 'hold_center') {
        const WIN_ZONE_RADIUS = 200;
        let potentialWinner: Player | null = null;
        const playersToCheck = [...state.players, ...state.bots];

        for (const p of playersToCheck) {
            if (p.isDead) continue;
            // Check Physics
            const d = Math.hypot(p.position.x, p.position.y);
            if (d < WIN_ZONE_RADIUS) {
                if ('matchPercent' in p && p.matchPercent >= THRESHOLDS.WIN_HOLD) {
                    potentialWinner = p as Player;
                    break;
                }
            }
        }

        // Initialize runtime state if missing
        if (!state.runtime.winCondition) {
            state.runtime.winCondition = { timer: 0 };
        }

        if (potentialWinner) {
            if (!potentialWinner.statusScalars.kingForm) potentialWinner.statusScalars.kingForm = 0;
            potentialWinner.statusScalars.kingForm += dt;

            // Sync to Global Runtime for HUD
            state.runtime.winCondition.timer = potentialWinner.statusScalars.kingForm;

            const pulseInterval = 0.5;
            if (potentialWinner.statusScalars.kingForm % pulseInterval < dt) {
                // Type 6 = Pulse (Win warning)
                vfxSystem.emitVFX(state, 6, potentialWinner.position.x, potentialWinner.position.y, 0, potentialWinner.id);
                state.shakeIntensity = 5;
            }

            // Win Condition
            const reqTime = levelConfig.winHoldSeconds || 1.5;
            if (potentialWinner.statusScalars.kingForm >= reqTime) {
                state.result = 'win';
                state.kingId = potentialWinner.id;
            }

        } else {
            // Decay channel if not holding
            state.runtime.winCondition.timer = 0;
            for (const p of playersToCheck) {
                if ('statusScalars' in p && (p.statusScalars.kingForm || 0) > 0) {
                    p.statusScalars.kingForm = Math.max(0, (p.statusScalars.kingForm || 0) - dt * 2);
                }
            }
        }
    }
};
