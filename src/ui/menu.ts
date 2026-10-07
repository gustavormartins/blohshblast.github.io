import type { GameEngine } from '../game/engine';
import type { Phase3Facade } from '../product/phase3';

export function initMenu(engine: GameEngine, product: Phase3Facade): () => void {
  const menu = document.getElementById('phase3-menu');
  if (!menu) return () => {};
  menu.dataset.architecture = 'typed';

  const onEscape = (event: KeyboardEvent) => {
    if (event.key === 'Escape') product.showMenu();
  };
  document.addEventListener('keydown', onEscape);

  const unsubscribe = engine.on('reset', () => {
    document.body.dataset.lastAction = 'reset';
  });

  return () => {
    document.removeEventListener('keydown', onEscape);
    unsubscribe();
  };
}
