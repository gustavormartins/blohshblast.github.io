export class MemoryRateLimiter {
  #buckets = new Map();
  #maxKeys;

  constructor({ maxKeys = 10_000 } = {}) {
    this.#maxKeys = maxKeys;
  }

  consume(key, limit, windowMs) {
    const now = Date.now();
    const existing = this.#buckets.get(key);

    if (!existing || existing.resetAt <= now) {
      this.#buckets.set(key, { count: 1, resetAt: now + windowMs });
      this.#trim(now);
      return { allowed: true, remaining: Math.max(0, limit - 1), resetAt: now + windowMs };
    }

    if (existing.count >= limit) {
      return { allowed: false, remaining: 0, resetAt: existing.resetAt };
    }

    existing.count += 1;
    return { allowed: true, remaining: Math.max(0, limit - existing.count), resetAt: existing.resetAt };
  }

  #trim(now) {
    if (this.#buckets.size <= this.#maxKeys) return;
    for (const [key, bucket] of this.#buckets) {
      if (bucket.resetAt <= now || this.#buckets.size > this.#maxKeys) this.#buckets.delete(key);
      if (this.#buckets.size <= this.#maxKeys) break;
    }
  }
}

import { createHash } from 'node:crypto';

// PostgreSQL is the shared atomic rate limiter for all serverless instances.
// Raw IP addresses and emails are never persisted.
export class DatabaseRateLimiter {
  constructor({ query }) { this.query = query; }

  async consume(key, limit, windowMs) {
    const keyHash = createHash('sha256').update(key).digest('hex');
    const result = await this.query(`
      INSERT INTO public.api_rate_limits (key_hash, hits, reset_at)
      VALUES ($1, 1, now() + ($2::double precision * interval '1 millisecond'))
      ON CONFLICT (key_hash) DO UPDATE SET
        hits = CASE WHEN api_rate_limits.reset_at <= now()
          THEN 1 ELSE api_rate_limits.hits + 1 END,
        reset_at = CASE WHEN api_rate_limits.reset_at <= now()
          THEN EXCLUDED.reset_at ELSE api_rate_limits.reset_at END
      RETURNING hits, EXTRACT(EPOCH FROM reset_at) * 1000 AS reset_at_ms
    `, [keyHash, windowMs]);
    const state = result.rows[0];
    if (!state) throw new Error('RATE_LIMIT_UNAVAILABLE');
    const hits = Number(state.hits);
    return {
      allowed: hits <= limit,
      remaining: Math.max(0, limit - hits),
      resetAt: Number(state.reset_at_ms)
    };
  }
}
