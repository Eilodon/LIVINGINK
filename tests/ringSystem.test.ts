
import { describe, it, expect } from 'vitest';
import { THRESHOLDS } from '../services/cjr/cjrConstants';
import { getRushThreshold, isRushWindowActive, bossState, resetBossState } from '../services/cjr/bossCjr';

describe('CJR Ring System', () => {
    it('should define strict thresholds', () => {
        expect(THRESHOLDS.INTO_RING2).toBe(0.50);
        expect(THRESHOLDS.INTO_RING3).toBe(0.70);
        expect(THRESHOLDS.WIN_HOLD).toBe(0.90);
    });
});

describe('CJR Boss Rush Mechanic', () => {
    it('should reduce threshold during rush window', () => {
        resetBossState();

        // Default
        expect(isRushWindowActive(2)).toBe(false);
        expect(getRushThreshold(THRESHOLDS.INTO_RING2)).toBe(THRESHOLDS.INTO_RING2 * 0.8);

        // Simulate Rush
        bossState.rushWindowTimer = 5.0;
        bossState.rushWindowRing = 2;

        expect(isRushWindowActive(2)).toBe(true);
        expect(isRushWindowActive(3)).toBe(false);
    });
});
