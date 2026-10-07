import { canFit } from './board';
import type { Board, Rack } from './types';

export function canPlayAny(board: Board, rack: Rack): boolean {
  return rack.some(piece => {
    if (!piece) return false;
    for (let y = 0; y < 8; y += 1) {
      for (let x = 0; x < 8; x += 1) {
        if (canFit(board, piece, x, y)) return true;
      }
    }
    return false;
  });
}

export function isGameOver(board: Board, rack: Rack): boolean {
  return rack.some(Boolean) && !canPlayAny(board, rack);
}
