import { BOARD_SIZE } from './types';
import type { Board, Piece } from './types';
import { canFit } from './board';
import { SHAPES } from './constants';

export function blockCount(piece: Piece): number {
  return piece.reduce((sum, row) => sum + row.filter(cell => cell === 1).length, 0);
}

export function signature(piece: Piece): string {
  return piece.map(row => row.join('')).join('/');
}

export function canPlaceAnywhere(board: Board, piece: Piece): boolean {
  for (let y = 0; y < BOARD_SIZE; y += 1) {
    for (let x = 0; x < BOARD_SIZE; x += 1) {
      if (canFit(board, piece, x, y)) return true;
    }
  }
  return false;
}

export function playableShapes(board: Board, shapes: readonly Piece[] = SHAPES): Piece[] {
  return shapes.filter(piece => canPlaceAnywhere(board, piece));
}

export function chooseBalancedRack(board: Board, shapes: readonly Piece[] = SHAPES): [Piece, Piece, Piece] {
  const pool = playableShapes(board, shapes);
  const fallback = shapes[0] ?? [[1]];
  if (pool.length === 0) return [fallback, fallback, fallback];

  const ordered = [...pool].sort((a, b) => blockCount(a) - blockCount(b));
  return [
    ordered[0] ?? fallback,
    ordered[Math.floor(ordered.length / 2)] ?? fallback,
    ordered[ordered.length - 1] ?? fallback
  ];
}

export function pieceFitsBoard(board: Board, piece: Piece, x: number, y: number): boolean {
  return canFit(board, piece, x, y);
}
