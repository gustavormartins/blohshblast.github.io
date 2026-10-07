import { BOARD_SIZE } from './types';

export interface GridRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface GridPosition {
  x: number;
  y: number;
}

export function gridPositionFromPointer(
  rect: GridRect,
  clientX: number,
  clientY: number
): GridPosition | null {
  if (rect.width <= 0 || rect.height <= 0) return null;
  const x = Math.floor(((clientX - rect.left) / rect.width) * BOARD_SIZE);
  const y = Math.floor(((clientY - rect.top) / rect.height) * BOARD_SIZE);
  return x >= 0 && y >= 0 && x < BOARD_SIZE && y < BOARD_SIZE ? { x, y } : null;
}
