import { describe, expect, it } from 'vitest';
import { blockCount, SHAPES, canFit } from '../../src/game/board';

describe('pieces', () => {
  it('preserves the current balanced shape catalogue', () => {
    expect(SHAPES.length).toBeGreaterThan(20);
    expect(blockCount([[1, 0], [1, 1]])).toBe(3);
  });

  it('keeps the basic monomino playable', () => {
    const board = Array.from({ length: 8 }, () => Array<0 | 1>(8).fill(0));
    expect(canFit(board, SHAPES[0], 0, 0)).toBe(true);
  });
});
