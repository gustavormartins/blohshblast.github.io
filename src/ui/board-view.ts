import type { GameEngine } from '../game/engine';

export function mountBoardView(engine: GameEngine): () => void {
  const board = document.getElementById('board');
  if (!board) return () => {};
  board.dataset.architecture = 'typed';
  return engine.on('scoreChanged', event => {
    board.dataset.score = String(event.detail.score);
  });
}
