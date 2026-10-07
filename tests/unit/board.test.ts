import { describe, expect, it } from 'vitest';
import { canFit, clearLines, findCompletedLines, placePiece } from '../../src/game/board';

const empty = () => Array.from({ length: 8 }, () => Array<0 | 1>(8).fill(0));

describe('board', () => {
  it('fits a piece into an empty board', () => {
    expect(canFit(empty(), [[1, 1]], 0, 0)).toBe(true);
  });

  it('rejects collisions and out-of-bounds pieces', () => {
    const board = empty();
    board[0][0] = 1;
    expect(canFit(board, [[1]], 0, 0)).toBe(false);
    expect(canFit(board, [[1, 1]], 7, 0)).toBe(false);
  });

  it('places without mutating the original board', () => {
    const board = empty();
    const next = placePiece(board, [[1]], 3, 4);
    expect(board[4][3]).toBe(0);
    expect(next[4][3]).toBe(1);
  });

  it('detects and clears a complete line', () => {
    const board = empty();
    board[0].fill(1);
    const lines = findCompletedLines(board);
    const next = clearLines(board, lines);
    expect(lines.rows).toEqual([0]);
    expect(next[0]).toEqual(Array(8).fill(0));
  });
});
