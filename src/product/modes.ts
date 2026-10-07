import type { GameMode } from '../game/types';

export interface ModeDefinition {
  label: string;
  description: string;
  scoreMultiplier: number;
  xpMultiplier: number;
}

export const MODES: Record<GameMode, ModeDefinition> = {
  classic: { label: 'CLASSIC', description: 'Padrão', scoreMultiplier: 1, xpMultiplier: 1 },
  zen: { label: 'ZEN', description: 'Relax', scoreMultiplier: 1, xpMultiplier: 1.08 },
  hardcore: { label: 'HARDCORE', description: 'Sem ajuda', scoreMultiplier: 1.5, xpMultiplier: 1.2 },
  daily: { label: 'DAILY', description: 'Desafio diário', scoreMultiplier: 1, xpMultiplier: 1.05 },
  campaign: { label: 'CAMPAIGN', description: 'Aventura com chefes', scoreMultiplier: 1, xpMultiplier: 1.1 },
  dungeon: { label: 'DUNGEON', description: 'Run roguelike', scoreMultiplier: 1, xpMultiplier: 1.15 }
};
