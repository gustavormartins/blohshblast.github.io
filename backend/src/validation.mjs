import * as z from 'zod';

export const MODE_VALUES = ['classic', 'zen', 'hardcore', 'daily', 'campaign', 'dungeon'];

export const registerSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  password: z.string().min(12).max(128)
}).strict();

export const loginSchema = registerSchema;

export const modeSchema = z.enum(MODE_VALUES);

export const scoreSchema = z.object({
  runId: z.uuid(),
  mode: modeSchema,
  score: z.number().int().min(0).max(5_000_000),
  moves: z.number().int().min(1).max(10_000),
  lines: z.number().int().min(0).max(40_000),
  combo: z.number().int().min(0).max(10_000),
  perfectClear: z.boolean().default(false),
  rulesVersion: z.string().trim().regex(/^phase\d+$/).max(16).default('phase4')
}).strict();

export const runSchema = z.object({
  mode: modeSchema
}).strict();

export function validateScoreEnvelope(score) {
  const maxLines = score.moves * 8;
  const maxCombo = score.lines + 1;
  const maxScoreByMoves = score.moves * 10_000;

  if (score.lines > maxLines) {
    return 'lines exceed the maximum allowed for the number of moves';
  }
  if (score.combo > maxCombo) {
    return 'combo exceeds the maximum allowed for the number of clears';
  }
  if (score.score > maxScoreByMoves) {
    return 'score exceeds the server-side integrity envelope';
  }
  return null;
}
