import type { Board, DragState, GameMode, GameState, Rack } from './types';

export function createEmptyBoard(size = 8): Board {
  return Array.from({ length: size }, () => Array<0 | 1>(size).fill(0));
}

export function createInitialState(mode: GameMode = 'classic'): GameState {
  const drag: DragState = {
    active: false,
    pieceIndex: -1,
    pointerId: null,
    matrix: null,
    touchOffsetY: 0
  };
  const rack: Rack = [null, null, null];
  return {
    board: createEmptyBoard(),
    score: 0,
    combo: 0,
    rack,
    gameOver: false,
    mode,
    drag
  };
}
