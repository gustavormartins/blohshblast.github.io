import { describe, expect, it } from 'vitest';
import { SHAPES as boardShapes } from '../../src/game/board';
import { SHAPES as catalogShapes } from '../../src/game/constants';
import { comboMultiplier as scoringMultiplier, nextCombo as scoringNextCombo } from '../../src/game/scoring';
import { comboMultiplier as sharedMultiplier, nextCombo as sharedNextCombo } from '../../src/game/combo';
import { isGameOver as engineGameOver } from '../../src/game/engine';
import { isGameOver as boardGameOver } from '../../src/game/game-over';
import type { Board, Rack } from '../../src/game/types';

describe('Phase 4 rules stay synchronized during the TypeScript migration', () => {
  it('exposes one shared shape catalogue', () => {
    expect(boardShapes).toBe(catalogShapes);
    expect(boardShapes.length).toBeGreaterThan(20);
  });

  it('uses the same combo functions for all typed modules', () => {
    expect(scoringMultiplier).toBe(sharedMultiplier);
    expect(scoringNextCombo).toBe(sharedNextCombo);
  });

  it('delegates game over to the canonical board rule', () => {
    const board: Board = Array.from({ length: 8 }, () => Array<0 | 1>(8).fill(1));
    const rack: Rack = [[[1]], null, null];
    expect(engineGameOver({ board, rack })).toBe(boardGameOver(board, rack));
    board[0]![0] = 0;
    expect(engineGameOver({ board, rack })).toBe(boardGameOver(board, rack));
  });
});
