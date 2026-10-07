import { describe, expect, it } from 'vitest';
import { isGameOver } from '../../src/game/engine';
import type { Board, Rack } from '../../src/game/types';

const fullBoard = (): Board => Array.from({ length: 8 }, () => Array<0 | 1>(8).fill(1));

describe('game over', () => {
  it('allows a move when the rack can still fit', () => {
    const board = fullBoard();
    board[0][0] = 0;
    const rack: Rack = [[[1]], null, null];
    expect(isGameOver({ board, rack })).toBe(false);
  });

  it('ends when every rack piece is blocked', () => {
    const board = fullBoard();
    expect(isGameOver({ board, rack: [[[1]], null, null] })).toBe(true);
  });
});
