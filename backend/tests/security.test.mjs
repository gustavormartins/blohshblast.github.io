import test from 'node:test';
import assert from 'node:assert/strict';
import { validateScoreEnvelope } from '../src/validation.mjs';

test('rejects impossible line count', () => {
  assert.equal(
    validateScoreEnvelope({ moves: 1, lines: 9, combo: 0, score: 10 }),
    'lines exceed the maximum allowed for the number of moves'
  );
});

test('rejects impossible combo', () => {
  assert.equal(
    validateScoreEnvelope({ moves: 10, lines: 2, combo: 10, score: 10 }),
    'combo exceeds the maximum allowed for the number of clears'
  );
});

test('accepts a bounded score envelope', () => {
  assert.equal(
    validateScoreEnvelope({ moves: 10, lines: 4, combo: 4, score: 10000 }),
    null
  );
});
