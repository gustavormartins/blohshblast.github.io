export const PERFECT_CLEAR_BONUS = 1000;

export function placementScore(blocksPlaced: number): number {
  return Math.max(0, blocksPlaced) * 10;
}

export function comboMultiplier(combo: number): number {
  return Math.min(1 + Math.max(0, combo - 1) * 0.35, 3);
}

export function lineClearScore(lines: number, combo: number): number {
  if (lines <= 0) return 0;
  return Math.round((lines * 100 * lines) * comboMultiplier(combo));
}

export function nextCombo(current: number, linesCleared: number): number {
  return linesCleared > 0 ? current + 1 : 0;
}

export function applyMultiplier(points: number, multiplier: number): number {
  return Math.round(Math.max(0, points) * Math.max(0, multiplier));
}
