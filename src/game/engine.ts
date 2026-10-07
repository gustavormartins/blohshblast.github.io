import { canFit } from './board';
import type { GameEvent, GameMode, GameState, LegacyGameRuntimeApi } from './types';

export interface GameRuntime extends LegacyGameRuntimeApi {}

export class LegacyGameRuntime implements GameRuntime {
  public constructor(private readonly api: LegacyGameRuntimeApi) {}
  public getState() { return this.api.getState(); }
  public reset(): void { this.api.reset(); }
  public placeFirstAvailable(index: number): boolean { return this.api.placeFirstAvailable(index); }
  public subscribe(listener: (event: { type: string; detail: unknown }) => void): () => void { return this.api.subscribe(listener); }
}

export function canPlayAny(state: Pick<GameState, 'board' | 'rack'>): boolean {
  return state.rack.some(piece => {
    if (!piece) return false;
    for (let y = 0; y < 8; y += 1) {
      for (let x = 0; x < 8; x += 1) {
        if (canFit(state.board, piece, x, y)) return true;
      }
    }
    return false;
  });
}

export function isGameOver(state: Pick<GameState, 'board' | 'rack'>): boolean {
  return state.rack.some(Boolean) && !canPlayAny(state);
}

export class GameEngine {
  public constructor(private readonly runtime: GameRuntime) {}

  public getState(): GameState {
    const state = this.runtime.getState();
    return {
      ...state,
      mode: this.getMode(),
      drag: {
        active: document.body.classList.contains('is-dragging'),
        pieceIndex: -1,
        pointerId: null,
        matrix: null,
        touchOffsetY: 0
      }
    };
  }

  public getMode(): GameMode {
    const raw = window.BlohshBlastPhase3?.getMode?.() ?? 'classic';
    return ['classic', 'zen', 'hardcore', 'daily', 'campaign', 'dungeon'].includes(raw)
      ? raw as GameMode
      : 'classic';
  }

  public reset(): void { this.runtime.reset(); }
  public placeFirstAvailable(index: number): boolean { return this.runtime.placeFirstAvailable(index); }

  public on<T extends GameEvent['type']>(type: T, listener: (event: Extract<GameEvent, { type: T }>) => void): () => void {
    return this.runtime.subscribe(rawEvent => {
      if (rawEvent.type !== type) return;
      listener(rawEvent as Extract<GameEvent, { type: T }>);
    });
  }
}
