import type { GameEngine } from '../game/engine';

export function mountRackView(engine: GameEngine): () => void {
  const rack = document.getElementById('rack');
  if (!rack) return () => {};
  rack.dataset.architecture = 'typed';
  return engine.on('piecePlaced', event => {
    rack.dataset.lastPlacement = String(event.detail.amount);
  });
}
