
import { describe, it, expect } from 'vitest';
import { THRESHOLDS } from '../services/cjr/cjrConstants';
import { createInitialState } from '../services/engine';
import { getRushThreshold, isRushWindowActive, resetBossState } from '../services/cjr/bossCjr';

describe('CJR Ring System', () => {
    it('should define strict thresholds', () => {
        expect(THRESHOLDS.INTO_RING2).toBe(0.50);
        expect(THRESHOLDS.INTO_RING3).toBe(0.70);
        expect(THRESHOLDS.WIN_HOLD).toBe(0.90);
    });
});

describe('CJR Boss Rush Mechanic', () => {
    it('should reduce threshold during rush window', () => {
        const state = createInitialState(1);
        resetBossState(state.runtime);

        // Default
        expect(isRushWindowActive(state, 2)).toBe(false);
        expect(getRushThreshold()).toBe(0.8);

        // Simulate Rush
        state.runtime.boss.rushWindowTimer = 5.0;
        state.runtime.boss.rushWindowRing = 2;

        expect(isRushWindowActive(state, 2)).toBe(true);
        expect(isRushWindowActive(state, 3)).toBe(false);
    });
});
