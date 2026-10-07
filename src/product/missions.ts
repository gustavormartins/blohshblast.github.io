export type MissionType = 'score' | 'lines' | 'pieces' | 'combo' | 'perfect';

export interface MissionDefinition {
  type: MissionType;
  target: number;
  reward: number;
  label: string;
}

export const DEFAULT_MISSIONS: readonly MissionDefinition[] = [
  { type: 'score', target: 1200, reward: 100, label: 'Faça 1.200 pontos' },
  { type: 'score', target: 3000, reward: 180, label: 'Faça 3.000 pontos' },
  { type: 'lines', target: 8, reward: 120, label: 'Limpe 8 linhas' },
  { type: 'lines', target: 20, reward: 220, label: 'Limpe 20 linhas' },
  { type: 'pieces', target: 18, reward: 100, label: 'Coloque 18 peças' },
  { type: 'combo', target: 3, reward: 160, label: 'Alcance COMBO 3x' },
  { type: 'perfect', target: 1, reward: 260, label: 'Faça 1 Perfect Clear' }
];
