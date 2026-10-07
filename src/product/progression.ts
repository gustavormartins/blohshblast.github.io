export interface ProgressionState {
  xp: number;
  level: number;
  unlockedSkins: string[];
  selectedSkin: string;
}

export const XP_THRESHOLDS = [0, 300, 800, 1500, 2500, 3800, 5500, 7800, 10800, 14500] as const;

export function getLevel(xp: number): number {
  let level = 1;
  XP_THRESHOLDS.forEach((threshold, index) => {
    if (xp >= threshold) level = index + 1;
  });
  return Math.min(level, XP_THRESHOLDS.length);
}

export function addXp(state: ProgressionState, amount: number): ProgressionState {
  const xp = Math.max(0, state.xp + amount);
  return { ...state, xp, level: getLevel(xp) };
}
