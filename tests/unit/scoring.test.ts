import { describe, expect, it } from 'vitest';
import { comboMultiplier, lineClearScore, placementScore, applyMultiplier, PERFECT_CLEAR_BONUS } from '../../src/game/scoring';

describe('scoring', () => {
  it('scores placed blocks and multipliers', () => {
    expect(placementScore(4)).toBe(40);
    expect(applyMultiplier(10, 1.5)).toBe(15);
    expect(PERFECT_CLEAR_BONUS).toBe(1000);
  });

  it('caps combo multiplier at 3x', () => {
    expect(comboMultiplier(1)).toBe(1);
    expect(comboMultiplier(3)).toBeCloseTo(1.7);
    expect(comboMultiplier(20)).toBe(3);
  });

  it('scores line clears using the current combo curve', () => {
    expect(lineClearScore(1, 1)).toBe(100);
    expect(lineClearScore(2, 2)).toBe(460);
  });
});
