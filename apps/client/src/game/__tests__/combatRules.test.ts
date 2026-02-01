import { describe, expect, it } from 'vitest';
import { getSizeInteraction, InteractionType } from './combatRules';

describe('getSizeInteraction', () => {
  it('consumes when ratio meets danger threshold', () => {
    expect(getSizeInteraction(1.1, false, false, false, false)).toBe(InteractionType.CONSUME);
    expect(getSizeInteraction(1.25, false, false, false, false)).toBe(InteractionType.CONSUME);
  });

  it('avoids when ratio is below eat threshold', () => {
    expect(getSizeInteraction(0.9, false, false, false, false)).toBe(InteractionType.AVOID);
    expect(getSizeInteraction(0.75, false, false, false, false)).toBe(InteractionType.AVOID);
  });

  it('returns combat within the neutral range', () => {
    expect(getSizeInteraction(1.0, false, false, false, false)).toBe(InteractionType.COMBAT);
  });

  it('prevents consume when prey is shielded or charging', () => {
    expect(getSizeInteraction(1.2, false, true, false, false)).toBe(InteractionType.COMBAT);
    expect(getSizeInteraction(1.2, false, false, false, true)).toBe(InteractionType.COMBAT);
  });
});
