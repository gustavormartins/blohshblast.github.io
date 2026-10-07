export function nextCombo(current: number, linesCleared: number): number {
  return linesCleared > 0 ? current + 1 : 0;
}

export function comboMultiplier(combo: number): number {
  return Math.min(1 + Math.max(0, combo - 1) * 0.35, 3);
}
