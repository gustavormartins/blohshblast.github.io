import { describe, expect, it } from 'vitest';
import { comboMultiplier, nextCombo } from '../../src/game/scoring';

describe('combo', () => {
  it('increments only after a clear', () => {
    expect(nextCombo(0, 1)).toBe(1);
    expect(nextCombo(2, 1)).toBe(3);
    expect(nextCombo(3, 0)).toBe(0);
  });

  it('uses the intended multiplier curve', () => {
    expect(comboMultiplier(4)).toBeCloseTo(2.05);
  });
});
