import { BOARD_SIZE } from './types';
import type { Board, Cell, Piece } from './types';

export interface Position { x: number; y: number; }
export interface CompletedLines { rows: number[]; columns: number[]; }

export const SHAPES: readonly Piece[] = [
  [[1]], [[1, 1]], [[1], [1]], [[1, 1, 1]], [[1], [1], [1]],
  [[1, 1, 1, 1]], [[1], [1], [1], [1]],
  [[1, 0], [1, 0], [1, 1]], [[0, 1], [0, 1], [1, 1]],
  [[1, 1], [1, 0], [1, 0]], [[1, 1], [0, 1], [0, 1]],
  [[1, 0, 0], [1, 1, 1]], [[0, 0, 1], [1, 1, 1]],
  [[1, 1, 1], [1, 0, 0]], [[1, 1, 1], [0, 0, 1]],
  [[1, 1], [1, 1]],
  [[1, 1, 1], [0, 1, 0]], [[0, 1, 0], [1, 1, 1]],
  [[1, 0], [1, 1], [1, 0]], [[0, 1], [1, 1], [0, 1]],
  [[1, 1, 0], [0, 1, 1]], [[0, 1, 1], [1, 1, 0]],
  [[1, 0], [1, 1], [0, 1]], [[0, 1], [1, 1], [1, 0]]
];

export function blockCount(piece: Piece): number {
  return piece.reduce((sum, row) => sum + row.filter(cell => cell === 1).length, 0);
}

export function canFit(board: Board, piece: Piece, anchorX: number, anchorY: number): boolean {
  for (let y = 0; y < piece.length; y += 1) {
    for (let x = 0; x < piece[y]!.length; x += 1) {
      if (piece[y]![x] !== 1) continue;
      const boardX = anchorX + x;
      const boardY = anchorY + y;
      if (boardX < 0 || boardY < 0 || boardX >= BOARD_SIZE || boardY >= BOARD_SIZE) return false;
      if (board[boardY]![boardX] === 1) return false;
    }
  }
  return true;
}

export function findFirstValidPlacement(board: Board, piece: Piece): Position | null {
  for (let y = 0; y < BOARD_SIZE; y += 1) {
    for (let x = 0; x < BOARD_SIZE; x += 1) {
      if (canFit(board, piece, x, y)) return { x, y };
    }
  }
  return null;
}

export function findCompletedLines(board: Board): CompletedLines {
  const rows: number[] = [];
  const columns: number[] = [];

  for (let y = 0; y < BOARD_SIZE; y += 1) {
    if (board[y]!.every(cell => cell === 1)) rows.push(y);
  }

  for (let x = 0; x < BOARD_SIZE; x += 1) {
    let full = true;
    for (let y = 0; y < BOARD_SIZE; y += 1) {
      if (board[y]![x] === 0) full = false;
    }
    if (full) columns.push(x);
  }

  return { rows, columns };
}

export function placePiece(board: Board, piece: Piece, anchorX: number, anchorY: number): Board {
  const next = board.map(row => [...row] as Cell[]);
  for (let y = 0; y < piece.length; y += 1) {
    for (let x = 0; x < piece[y]!.length; x += 1) {
      if (piece[y]![x] === 1) next[anchorY + y]![anchorX + x] = 1;
    }
  }
  return next;
}

export function clearLines(board: Board, lines: CompletedLines): Board {
  const next = board.map(row => [...row] as Cell[]);
  for (const y of lines.rows) next[y]!.fill(0);
  for (const x of lines.columns) for (let y = 0; y < BOARD_SIZE; y += 1) next[y]![x] = 0;
  return next;
}
