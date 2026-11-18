export type OnlineMode = 'classic' | 'zen' | 'hardcore' | 'daily' | 'campaign' | 'dungeon';

export interface RunMetrics {
  mode: OnlineMode;
  moves: number;
  lines: number;
  combo: number;
  perfectClear: boolean;
}

export function normalizeNickname(value: string): string {
  return String(value || '').replace(/[^A-Za-z0-9 _-]/g, '').slice(0, 16).trim() || 'PLAYER';
}

export function createScorePayload(runId: string, metrics: RunMetrics, value: number) {
  const score = Math.trunc(value);
  const moves = Math.trunc(metrics.moves);
  const lines = Math.trunc(metrics.lines);
  const combo = Math.trunc(metrics.combo);
  if (!/^[a-f0-9-]{36}$/i.test(runId) ||
      !Number.isSafeInteger(score) || score < 1 || score > 5_000_000 ||
      !Number.isSafeInteger(moves) || moves < 1 || moves > 10_000 ||
      !Number.isSafeInteger(lines) || lines < 0 || lines > Math.min(40_000, moves * 8) ||
      !Number.isSafeInteger(combo) || combo < 0 || combo > Math.min(10_000, lines + 1) ||
      score > moves * 10_000) {
    return null;
  }
  return {
    runId,
    mode: metrics.mode,
    score,
    moves,
    lines,
    combo,
    perfectClear: Boolean(metrics.perfectClear),
    rulesVersion: 'phase4'
  };
}
