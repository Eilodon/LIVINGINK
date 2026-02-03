/**
 * @cjr/engine - Win Condition Logic
 * Pure logic - VFX decoupled via eventBuffer
 */

import { eventBuffer, EngineEventType, TEXT_IDS } from '../../events/EventRingBuffer';
import { THRESHOLDS } from '../../config/constants';

/**
 * Minimal entity interface for win condition
 */
export interface IWinEntity {
    id: string;
    physicsIndex?: number;
    position: { x: number; y: number };
    matchPercent: number;
    isDead: boolean;
    statusScalars: Record<string, number>;
}

export interface IWinState {
    result?: 'win' | 'lose' | null;
    kingId?: string;
    shakeIntensity?: number;
    runtime: {
        winCondition?: {
            timer: number;
        };
    };
}

export interface ILevelConfig {
    winCondition?: 'default' | 'hold_center';
    winHoldSeconds?: number;
}

/**
 * Update win condition logic
 * Returns true if game ended
 */
export const updateWinConditionLogic = (
    entities: IWinEntity[],
    state: IWinState,
    dt: number,
    levelConfig: ILevelConfig
): { winner: IWinEntity | null; pulseEmitted: boolean } => {
    const winType = levelConfig.winCondition || 'default';

    if (winType === 'default') {
        return { winner: null, pulseEmitted: false };
    }

    if (winType === 'hold_center') {
        const WIN_ZONE_RADIUS = 200;
        let potentialWinner: IWinEntity | null = null;

        for (const p of entities) {
            if (p.isDead) continue;
            const d = Math.hypot(p.position.x, p.position.y);
            if (d < WIN_ZONE_RADIUS) {
                if (p.matchPercent >= THRESHOLDS.WIN_HOLD) {
                    potentialWinner = p;
                    break;
                }
            }
        }

        // Initialize runtime state if missing
        if (!state.runtime.winCondition) {
            state.runtime.winCondition = { timer: 0 };
        }

        if (potentialWinner) {
            if (!potentialWinner.statusScalars.kingForm) {
                potentialWinner.statusScalars.kingForm = 0;
            }
            potentialWinner.statusScalars.kingForm += dt;

            // Sync to Global Runtime for HUD
            state.runtime.winCondition.timer = potentialWinner.statusScalars.kingForm;

            const pulseInterval = 0.5;
            let pulseEmitted = false;

            if (potentialWinner.statusScalars.kingForm % pulseInterval < dt) {
                // Emit VFX event instead of direct call
                eventBuffer.push(
                    EngineEventType.SHOCKWAVE,
                    potentialWinner.physicsIndex ?? 0,
                    potentialWinner.position.x,
                    potentialWinner.position.y,
                    100 // Pulse radius
                );
                state.shakeIntensity = 5;
                pulseEmitted = true;
            }

            // Win Condition
            const reqTime = levelConfig.winHoldSeconds || 1.5;
            if (potentialWinner.statusScalars.kingForm >= reqTime) {
                state.result = 'win';
                state.kingId = potentialWinner.id;
                return { winner: potentialWinner, pulseEmitted };
            }

            return { winner: null, pulseEmitted };
        } else {
            // Decay channel if not holding
            state.runtime.winCondition.timer = 0;
            for (const p of entities) {
                if ((p.statusScalars.kingForm || 0) > 0) {
                    p.statusScalars.kingForm = Math.max(0, (p.statusScalars.kingForm || 0) - dt * 2);
                }
            }
            return { winner: null, pulseEmitted: false };
        }
    }

    return { winner: null, pulseEmitted: false };
};

// ============================================================================
// LEGACY-COMPATIBLE WRAPPERS (for client migration)
// ============================================================================

/**
 * Legacy-compatible updateWinCondition
 * Matches client signature: (state: GameState, dt: number, levelConfig: any) => void
 */
export const updateWinCondition = (
    state: any,
    dt: number,
    levelConfig: any
): void => {
    // Combine players and bots for win condition check
    const entities = [...state.players, ...(state.bots || [])];
    updateWinConditionLogic(entities, state as IWinState, dt, levelConfig);
};
