import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseRateLimiter } from '../src/rate-limit.mjs';

test('serverless limiter hashes keys and rejects excess requests', async () => {
  let hits = 0;
  const calls = [];
  const limiter = new DatabaseRateLimiter({
    query: async (sql, args) => {
      calls.push({ sql, args });
      hits += 1;
      return { rows: [{ hits, reset_at_ms: String(Date.now() + 10000) }] };
    }
  });
  const first = await limiter.consume('login:192.0.2.1:user@example.org', 2, 60000);
  const second = await limiter.consume('login:192.0.2.1:user@example.org', 2, 60000);
  const third = await limiter.consume('login:192.0.2.1:user@example.org', 2, 60000);
  assert.equal(first.allowed, true);
  assert.equal(second.remaining, 0);
  assert.equal(third.allowed, false);
  assert.equal(calls[0].args[0].length, 64);
  assert.ok(!calls[0].args[0].includes('user@example.org'));
  assert.match(calls[0].sql, /ON CONFLICT/);
});
