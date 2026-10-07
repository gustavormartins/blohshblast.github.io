export const BOARD_SIZE = 8 as const;

export type Cell = 0 | 1;
export type Board = Cell[][];
export type Piece = Cell[][];
export type Rack = Array<Piece | null>;

export type GameMode =
  | 'classic'
  | 'zen'
  | 'hardcore'
  | 'daily'
  | 'campaign'
  | 'dungeon';

export interface DragState {
  active: boolean;
  pieceIndex: number;
  pointerId: number | null;
  matrix: Piece | null;
  touchOffsetY: number;
}

export interface GameState {
  board: Board;
  score: number;
  combo: number;
  rack: Rack;
  gameOver: boolean;
  mode: GameMode;
  drag: DragState;
}

export type GameEventName =
  | 'piecePlaced'
  | 'linesCleared'
  | 'perfectClear'
  | 'gameOver'
  | 'scoreChanged'
  | 'reset';

export interface GameEventMap {
  piecePlaced: { amount: number };
  linesCleared: { amount: number };
  perfectClear: Record<string, never>;
  gameOver: { score: number };
  scoreChanged: { score: number };
  reset: { score: number };
}

export interface LegacyGameRuntimeApi {
  getState(): Pick<GameState, 'board' | 'score' | 'combo' | 'rack' | 'gameOver'>;
  reset(): void;
  placeFirstAvailable(index: number): boolean;
  subscribe(listener: (event: { type: string; detail: unknown }) => void): () => void;
}
