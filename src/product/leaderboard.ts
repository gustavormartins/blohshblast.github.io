export interface LeaderboardEntry {
  nickname: string;
  score: number;
  mode: string;
  createdAt: number;
}

export function sortLeaderboard(entries: readonly LeaderboardEntry[]): LeaderboardEntry[] {
  return [...entries].sort((a, b) => b.score - a.score || b.createdAt - a.createdAt);
}
