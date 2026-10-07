import type { GameEngine } from '../game/engine';

export function initStatsModal(engine: GameEngine): () => void {
  const modal = document.getElementById('stats-modal');
  if (!modal) return () => {};
  modal.dataset.architecture = 'typed';

  return engine.on('gameOver', event => {
    const score = document.getElementById('final-score');
    if (score) score.textContent = event.detail.score.toLocaleString('pt-BR');
  });
}
