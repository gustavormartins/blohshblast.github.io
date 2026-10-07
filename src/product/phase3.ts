import type { GameMode } from '../game/types';

export interface Phase3Api {
  startGame?: (mode?: string) => void;
  showMenu?: () => void;
  openStats?: () => void;
  getMode?: () => string;
  getProgression?: () => { xp?: number; level?: number; selectedSkin?: string; unlockedSkins?: string[] };
}

export const MODES = {
  classic: { label: 'CLASSIC', description: 'Padrão', scoreMultiplier: 1, xpMultiplier: 1 },
  zen: { label: 'ZEN', description: 'Relax', scoreMultiplier: 1, xpMultiplier: 1.08 },
  hardcore: { label: 'HARDCORE', description: 'Sem ajuda', scoreMultiplier: 1.5, xpMultiplier: 1.2 },
  daily: { label: 'DAILY', description: 'Desafio diário', scoreMultiplier: 1, xpMultiplier: 1.05 },
  campaign: { label: 'CAMPAIGN', description: 'Aventura com chefes', scoreMultiplier: 1, xpMultiplier: 1.1 },
  dungeon: { label: 'DUNGEON', description: 'Run roguelike', scoreMultiplier: 1, xpMultiplier: 1.15 }
} as const satisfies Record<GameMode, object>;

export class Phase3Facade {
  public constructor(private readonly api: Phase3Api) {}
  public getMode(): GameMode {
    const raw = this.api.getMode?.() ?? 'classic';
    return raw in MODES ? raw as GameMode : 'classic';
  }
  public start(mode: GameMode = 'classic'): void { this.api.startGame?.(mode); }
  public showMenu(): void { this.api.showMenu?.(); }
  public openStats(): void { this.api.openStats?.(); }
}
