
import {
    THRESHOLDS,
    RING_RADII
} from './cjrConstants';
import { GameState, Player, GamePhase } from '../../types';
import { distance } from '../engine/math';

const CHANNEL_DURATION = 1.5; // Seconds

export const updateWinCondition = (state: GameState, dt: number) => {
    if (state.isPaused || !state.player || state.player.isDead) return;

    const p = state.player;

    // 1. Check Condition: In Center Ring (Ring 3) AND Match >= 90%
    // Ring 3 is physically center? No, Center is separate zone radius.
    // cjrConstants: CENTER = 150

    const dist = distance(p.position, { x: 0, y: 0 });
    const inCenter = dist < RING_RADII.CENTER;
    const matchReady = p.matchPercent >= THRESHOLDS.WIN_HOLD; // 0.90

    if (inCenter && matchReady) {
        if (!p.stationaryTime) p.stationaryTime = 0;

        // Is holding? We just check position.
        // Do we enforce stationary? "Hold" implies stay.
        // Let's use stationary check: velocity small.
        const speed = Math.hypot(p.velocity.x, p.velocity.y);
        if (speed < 100) { // Relatively still
            p.stationaryTime += dt;

            // Visual: Pulse/Heartbeat
            state.shakeIntensity = Math.min(5, p.stationaryTime * 2);

            // WIN CHECK
            if (p.stationaryTime >= CHANNEL_DURATION) {
                triggerWin(state);
            }
        } else {
            // Moving resets? Or just pauses?
            // "Hold" usually means defend the spot. 
            // If you drift out or move fast, reset.
            p.stationaryTime = Math.max(0, p.stationaryTime - dt * 2); // Decay
        }
    } else {
        p.stationaryTime = 0;
    }
};

const triggerWin = (state: GameState) => {
    // Game Over - Victory
    console.log("VICTORY!");
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

    // Pause?
    // state.isPaused = true; 
    // Usually let it run for celebration?
};
