/// <reference types="vite/client" />

import type { LegacyGameRuntimeApi } from './game/types';

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

export {};
