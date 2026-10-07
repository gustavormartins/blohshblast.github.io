import logoUrl from '../logo-official-64.png';
import './styles.css';

import { GameEngine, LegacyGameRuntime } from './game/engine';
import type { LegacyGameRuntimeApi } from './game/types';
import { Phase3Facade } from './product/phase3';
import { qs } from './ui/dom';

declare global {
  interface Window {
    BlohshBlastLegacyRuntime?: LegacyGameRuntimeApi;
    BlohshBlastPhase3?: {
      startGame?: (mode?: string) => void;
      showMenu?: () => void;
      openStats?: () => void;
      getMode?: () => string;
      getProgression?: () => {
        xp?: number;
        level?: number;
        selectedSkin?: string;
        unlockedSkins?: string[];
      };
    };
  }
}

const LOGO_SELECTOR = '[data-blohsh-logo], .brand-logo, .phase3-logo';
const LOGO_FALLBACK_URL = './logo-official-64.png';

function bindLogo(image: HTMLImageElement): void {
  image.src = logoUrl;
  image.loading = 'eager';
  image.decoding = 'async';
  image.dataset.logoSource = 'vite-local-asset';
  image.onerror = () => {
    if (!image.src.endsWith('/logo-official-64.png')) {
      image.src = LOGO_FALLBACK_URL;
      image.dataset.logoSource = 'runtime-fallback';
    }
  };
}

function applyLocalLogo(): void {
  document.querySelectorAll<HTMLImageElement>(LOGO_SELECTOR).forEach(bindLogo);
}

function observeLogoNodes(): void {
  if (!document.body) return;

  const observer = new MutationObserver(mutations => {
    for (const mutation of mutations) {
      mutation.addedNodes.forEach(node => {
        if (!(node instanceof Element)) return;
        node.querySelectorAll<HTMLImageElement>(LOGO_SELECTOR).forEach(bindLogo);
        if (node instanceof HTMLImageElement && node.matches(LOGO_SELECTOR)) bindLogo(node);
      });
    }
  });

  observer.observe(document.body, { childList: true, subtree: true });
}

function bootstrap(): void {
  applyLocalLogo();
  observeLogoNodes();

  const runtime = window.BlohshBlastLegacyRuntime;
  const phase3 = window.BlohshBlastPhase3;
  if (!runtime || !phase3) throw new Error('Blohsh Blast runtime seams are unavailable.');

  const engine = new GameEngine(new LegacyGameRuntime(runtime));
  const product = new Phase3Facade(phase3);

  qs<HTMLElement>('#board')?.setAttribute('data-architecture', 'typed');
  qs<HTMLElement>('#rack')?.setAttribute('data-architecture', 'typed');
  qs<HTMLElement>('#phase3-menu')?.setAttribute('data-architecture', 'typed');
  qs<HTMLElement>('#stats-modal')?.setAttribute('data-architecture', 'typed');

  engine.on('scoreChanged', event => {
    document.body.dataset.score = String(event.detail.score);
  });
  engine.on('gameOver', event => {
    document.body.dataset.lastGameEvent = String(event.detail.score);
  });

  document.documentElement.dataset.architecture = 'phase4';
  document.body.dataset.runtime = 'typed-shell';
  void product.getMode();
}

bootstrap();
