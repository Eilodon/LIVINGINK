
import {
    RING_RADII
} from './cjrConstants';
import { GameState } from '../../types';
import { TattooId } from './cjrTypes';
import { distance } from '../engine/math';
import { LevelConfig } from './levels';

export const updateWinCondition = (state: GameState, dt: number, config: LevelConfig) => {
    if (state.isPaused || !state.player || state.player.isDead || state.result) return;

    const p = state.player;

    // 1. Check Condition: In Center Ring (Ring 3) AND Match >= 90%
    // Ring 3 is physically center? No, Center is separate zone radius.
    // cjrConstants: CENTER = 150

    const dist = distance(p.position, { x: 0, y: 0 });
    const inCenter = dist < RING_RADII.CENTER;
    const matchReady = p.matchPercent >= config.thresholds.win;

    if (inCenter && matchReady) {
        if (!p.stationaryTime) p.stationaryTime = 0;

        // Reset hold if recently hit
        if (p.lastHitTime < 0.5) {
            p.stationaryTime = 0;
            return;
        }

        if (p.tattoos?.includes(TattooId.DepositShield)) {
            p.statusEffects.shielded = true;
            p.statusEffects.commitShield = Math.max(p.statusEffects.commitShield || 0, 1.0);
        }

        p.stationaryTime += dt;

        // Visual: Pulse/Heartbeat
        state.shakeIntensity = Math.min(5, p.stationaryTime * 2);

        // WIN CHECK
        if (p.stationaryTime >= config.winHoldSeconds) {
            triggerWin(state);
        }
    } else {
        p.stationaryTime = 0;
    }
};

const triggerWin = (state: GameState) => {
    // Game Over - Victory
    console.log("VICTORY!");
    state.player.emotion = 'victory';
    // Set Phase?
    // We typically don't have GamePhase in GameState (it's in App.tsx).
    // But we can signal via state flag or event.
    // For MVP: Floating Text + Console
    state.floatingTexts.push({
        id: Math.random().toString(),
        position: { x: 0, y: 0 },
        text: "VICTORY!",
        color: '#ffd700',
        size: 60,
        life: 5.0,
        velocity: { x: 0, y: -10 }
    });

    state.result = 'win';
    state.isPaused = true;
};
