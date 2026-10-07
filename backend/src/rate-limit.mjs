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
