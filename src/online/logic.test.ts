import { describe, expect, it } from 'vitest';
import { createScorePayload, normalizeNickname } from './logic';

const id = 'ca3f8259-c57b-4d56-a160-4992a39834b2';
const metrics = { mode: 'classic' as const, moves: 10, lines: 2, combo: 2, perfectClear: false };

describe('online score submission envelope', () => {
  it('preserves bounded game statistics for the API', () => {
    expect(createScorePayload(id, metrics, 1200)).toEqual({
      runId: id, mode: 'classic', score: 1200, moves: 10,
      lines: 2, combo: 2, perfectClear: false, rulesVersion: 'phase4'
    });
  });

  it('never submits incomplete or impossible local sessions', () => {
    expect(createScorePayload(id, { ...metrics, moves: 0 }, 100)).toBeNull();
    expect(createScorePayload(id, { ...metrics, lines: 90 }, 100)).toBeNull();
    expect(createScorePayload(id, metrics, 200_000)).toBeNull();
    expect(createScorePayload(id, metrics, 0)).toBeNull();
  });

  it('normalizes nicknames without allowing markup or oversized strings', () => {
    expect(normalizeNickname('<Bia & Gustavo>')).toBe('Bia  Gustavo');
    expect(normalizeNickname('')).toBe('PLAYER');
    expect(normalizeNickname('abcdefghijklmnopqrst')).toBe('abcdefghijklmnop');
  });
});
