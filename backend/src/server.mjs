import { createServer } from 'node:http';
import { randomUUID, randomInt } from 'node:crypto';
import { URL } from 'node:url';
import { authConfigured, getBearerToken, signAccessToken, verifyAccessToken } from './auth.mjs';
import { closeDb, dbConfigured, query, transaction } from './db.mjs';
import { hashPassword, verifyPassword } from './password.mjs';
import { MemoryRateLimiter } from './rate-limit.mjs';
import {
  loginSchema,
  modeSchema,
  registerSchema,
  runSchema,
  scoreSchema,
  validateScoreEnvelope
} from './validation.mjs';

const PORT = Number(process.env.PORT || 10000);
const HOST = '0.0.0.0';
const MAX_BODY_BYTES = 64 * 1024;
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || 'https://blohsh-blast.onrender.com';
const limiter = new MemoryRateLimiter({ maxKeys: 20_000 });

if (process.env.NODE_ENV === 'production') {
  if (!dbConfigured()) throw new Error('DATABASE_URL is required in production');
  if (!authConfigured()) throw new Error('JWT_SECRET with at least 32 bytes is required in production');
}

function clientIp(request) {
  const forwarded = request.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded) return forwarded.split(',')[0].trim();
  return request.socket.remoteAddress || 'unknown';
}

function setSecurityHeaders(response, request) {
  const origin = request.headers.origin;
  response.setHeader('Content-Security-Policy', "default-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'");
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.setHeader('X-Frame-Options', 'DENY');
  response.setHeader('Referrer-Policy', 'no-referrer');
  response.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), serial=(), bluetooth=()');
  response.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  response.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
  response.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');

  if (origin === FRONTEND_ORIGIN) {
    response.setHeader('Access-Control-Allow-Origin', FRONTEND_ORIGIN);
    response.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
    response.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    response.setHeader('Access-Control-Max-Age', '600');
  }
  response.setHeader('Vary', 'Origin');
}

function send(response, request, status, body, extraHeaders = {}) {
  setSecurityHeaders(response, request);
  Object.entries(extraHeaders).forEach(([key, value]) => response.setHeader(key, value));
  response.statusCode = status;
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  response.setHeader('Cache-Control', 'no-store');
  response.end(JSON.stringify(body));
}

async function readJson(request) {
  const length = Number(request.headers['content-length'] || 0);
  if (Number.isFinite(length) && length > MAX_BODY_BYTES) {
    const error = new Error('BODY_TOO_LARGE');
    error.code = 'BODY_TOO_LARGE';
    throw error;
  }

  const chunks = [];
  let total = 0;

  for await (const chunk of request) {
    total += chunk.length;
    if (total > MAX_BODY_BYTES) {
      const error = new Error('BODY_TOO_LARGE');
      error.code = 'BODY_TOO_LARGE';
      throw error;
    }
    chunks.push(chunk);
  }

  if (!chunks.length) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    const error = new Error('INVALID_JSON');
    error.code = 'INVALID_JSON';
    throw error;
  }
}

async function authenticatedUser(request) {
  const token = getBearerToken(request);
  if (!token) return null;
  try {
    return await verifyAccessToken(token);
  } catch {
    return null;
  }
}

async function requireUser(request, response) {
  const user = await authenticatedUser(request);
  if (!user) {
    send(response, request, 401, { error: 'unauthorized' });
    return null;
  }
  return user;
}

function rateLimit(response, request, key, limit, windowMs) {
  const result = limiter.consume(key, limit, windowMs);
  response.setHeader('RateLimit-Limit', String(limit));
  response.setHeader('RateLimit-Remaining', String(result.remaining));
  response.setHeader('RateLimit-Reset', String(Math.ceil(result.resetAt / 1000)));

  if (!result.allowed) {
    send(response, request, 429, { error: 'rate_limited' }, {
      'Retry-After': String(Math.max(1, Math.ceil((result.resetAt - Date.now()) / 1000)))
    });
    return false;
  }
  return true;
}

async function handle(request, response) {
  const requestId = randomUUID();
  response.setHeader('X-Request-ID', requestId);

  if (request.method === 'OPTIONS') {
    if (request.headers.origin && request.headers.origin !== FRONTEND_ORIGIN) {
      send(response, request, 403, { error: 'origin_not_allowed' });
      return;
    }
    setSecurityHeaders(response, request);
    response.statusCode = 204;
    response.end();
    return;
  }

  const url = new URL(request.url || '/', 'http://localhost');
  const ip = clientIp(request);

  if (request.method === 'GET' && url.pathname === '/healthz') {
    send(response, request, 200, {
      ok: true,
      database: dbConfigured() ? 'configured' : 'missing',
      auth: authConfigured() ? 'configured' : 'missing'
    });
    return;
  }

  if (request.method === 'GET' && url.pathname === '/readyz') {
    if (!dbConfigured() || !authConfigured()) {
      send(response, request, 503, { ok: false, error: 'service_not_ready' });
      return;
    }
    try {
      await query('SELECT 1 AS ok');
      send(response, request, 200, { ok: true });
    } catch {
      send(response, request, 503, { ok: false, error: 'database_unavailable' });
    }
    return;
  }

  if (!rateLimit(response, request, 'ip:' + ip, 120, 60_000)) return;

  if (request.method === 'GET' && url.pathname === '/api/v1/leaderboard') {
    const modeParam = url.searchParams.get('mode') || 'classic';
    const parsedMode = modeSchema.safeParse(modeParam);
    if (!parsedMode.success) {
      send(response, request, 400, { error: 'invalid_mode' });
      return;
    }
    if (!dbConfigured()) {
      send(response, request, 503, { error: 'database_unavailable' });
      return;
    }

    const requestedLimit = Number(url.searchParams.get('limit') || 20);
    const limit = Number.isFinite(requestedLimit) ? Math.min(50, Math.max(1, Math.trunc(requestedLimit))) : 20;
    const result = await query(
      'SELECT score, mode, created_at FROM scores WHERE mode = $1 ORDER BY score DESC, created_at ASC LIMIT $2',
      [parsedMode.data, limit]
    );

    send(response, request, 200, {
      data: result.rows.map(row => ({
        score: row.score,
        mode: row.mode,
        createdAt: row.created_at
      }))
    });
    return;
  }

  if (request.method === 'POST' && url.pathname === '/api/v1/auth/register') {
    if (!rateLimit(response, request, 'register:' + ip, 5, 15 * 60_000)) return;

    let payload;
    try {
      payload = registerSchema.parse(await readJson(request));
    } catch (error) {
      send(response, request, 400, { error: error.code === 'BODY_TOO_LARGE' ? 'body_too_large' : 'invalid_request' });
      return;
    }

    if (!dbConfigured()) {
      send(response, request, 503, { error: 'database_unavailable' });
      return;
    }

    const existing = await query('SELECT id FROM users WHERE email = $1', [payload.email]);
    if (existing.rowCount) {
      send(response, request, 409, { error: 'account_already_exists' });
      return;
    }

    const userId = randomUUID();
    const passwordHash = await hashPassword(payload.password);
    await query(
      'INSERT INTO users (id, email, password_hash, role) VALUES ($1, $2, $3, $4)',
      [userId, payload.email, passwordHash, 'user']
    );

    const token = await signAccessToken({ id: userId, role: 'user' });
    send(response, request, 201, { data: { accessToken: token, expiresIn: 900 } });
    return;
  }

  if (request.method === 'POST' && url.pathname === '/api/v1/auth/login') {
    let payload;
    try {
      payload = loginSchema.parse(await readJson(request));
    } catch (error) {
      send(response, request, 400, { error: error.code === 'BODY_TOO_LARGE' ? 'body_too_large' : 'invalid_request' });
      return;
    }

    const rateKey = 'login:' + ip + ':' + payload.email;
    if (!rateLimit(response, request, rateKey, 10, 10 * 60_000)) return;

    if (!dbConfigured()) {
      send(response, request, 503, { error: 'database_unavailable' });
      return;
    }

    const result = await query(
      'SELECT id, password_hash, role FROM users WHERE email = $1',
      [payload.email]
    );
    const user = result.rows[0];
    const valid = user ? await verifyPassword(payload.password, user.password_hash) : false;

    if (!valid) {
      send(response, request, 401, { error: 'invalid_credentials' });
      return;
    }

    const token = await signAccessToken({ id: user.id, role: user.role });
    send(response, request, 200, { data: { accessToken: token, expiresIn: 900 } });
    return;
  }

  if (request.method === 'GET' && url.pathname === '/api/v1/me') {
    const user = await requireUser(request, response);
    if (!user) return;
    if (!rateLimit(response, request, 'me:' + user.id, 60, 60_000)) return;

    const result = await query(
      'SELECT id, email, role, created_at FROM users WHERE id = $1',
      [user.id]
    );
    if (!result.rowCount) {
      send(response, request, 401, { error: 'unauthorized' });
      return;
    }

    send(response, request, 200, {
      data: {
        id: result.rows[0].id,
        email: result.rows[0].email,
        role: result.rows[0].role,
        createdAt: result.rows[0].created_at
      }
    });
    return;
  }

  if (request.method === 'POST' && url.pathname === '/api/v1/runs') {
    const user = await requireUser(request, response);
    if (!user) return;
    if (!rateLimit(response, request, 'run:' + user.id, 20, 60_000)) return;

    let payload;
    try {
      payload = runSchema.parse(await readJson(request));
    } catch (error) {
      send(response, request, 400, { error: error.code === 'BODY_TOO_LARGE' ? 'body_too_large' : 'invalid_request' });
      return;
    }

    const id = randomUUID();
    const seed = randomInt(0, 2 ** 31 - 1);
    await query(
      'INSERT INTO game_runs (id, user_id, mode, seed) VALUES ($1, $2, $3, $4)',
      [id, user.id, payload.mode, seed]
    );

    send(response, request, 201, {
      data: {
        runId: id,
        mode: payload.mode,
        seed,
        rulesVersion: 'phase4'
      }
    });
    return;
  }

  if (request.method === 'POST' && url.pathname === '/api/v1/scores') {
    const user = await requireUser(request, response);
    if (!user) return;
    if (!rateLimit(response, request, 'score:' + user.id, 30, 60_000)) return;

    let payload;
    try {
      payload = scoreSchema.parse(await readJson(request));
    } catch (error) {
      send(response, request, 400, { error: error.code === 'BODY_TOO_LARGE' ? 'body_too_large' : 'invalid_request' });
      return;
    }

    const integrityError = validateScoreEnvelope(payload);
    if (integrityError) {
      send(response, request, 422, { error: 'score_validation_failed', detail: integrityError });
      return;
    }

    try {
      await transaction(async client => {
        const runResult = await client.query(
          'SELECT id, user_id, mode, status FROM game_runs WHERE id = $1 FOR UPDATE',
          [payload.runId]
        );
        const run = runResult.rows[0];

        if (!run || run.user_id !== user.id) {
          const error = new Error('RUN_NOT_FOUND');
          error.code = 'RUN_NOT_FOUND';
          throw error;
        }

        if (run.status !== 'active' || run.mode !== payload.mode) {
          const error = new Error('RUN_NOT_WRITABLE');
          error.code = 'RUN_NOT_WRITABLE';
          throw error;
        }

        await client.query(
          'INSERT INTO scores (run_id, user_id, mode, score, moves, lines, combo, perfect_clear, rules_version) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)',
          [
            payload.runId,
            user.id,
            payload.mode,
            payload.score,
            payload.moves,
            payload.lines,
            payload.combo,
            payload.perfectClear,
            payload.rulesVersion
          ]
        );

        await client.query(
          "UPDATE game_runs SET status = 'finished', finished_at = now() WHERE id = $1",
          [payload.runId]
        );
      });
    } catch (error) {
      if (error.code === 'RUN_NOT_FOUND') {
        send(response, request, 404, { error: 'run_not_found' });
        return;
      }
      if (error.code === 'RUN_NOT_WRITABLE') {
        send(response, request, 409, { error: 'run_not_writable' });
        return;
      }
      if (error.code === '23505') {
        send(response, request, 409, { error: 'run_already_scored' });
        return;
      }
      throw error;
    }

    send(response, request, 201, { data: { accepted: true } });
    return;
  }

  if (request.method === 'GET' && url.pathname === '/api/v1/admin/users') {
    const user = await requireUser(request, response);
    if (!user) return;
    if (user.role !== 'admin') {
      send(response, request, 403, { error: 'forbidden' });
      return;
    }
    if (!rateLimit(response, request, 'admin:' + user.id, 30, 60_000)) return;

    const result = await query(
      'SELECT id, email, role, created_at FROM users ORDER BY created_at DESC LIMIT 100'
    );
    send(response, request, 200, { data: result.rows });
    return;
  }

  send(response, request, 404, { error: 'not_found' });
}

const server = createServer((request, response) => {
  Promise.resolve(handle(request, response)).catch(error => {
    const requestId = response.getHeader('X-Request-ID');
    console.error(JSON.stringify({
      event: 'request_failed',
      requestId,
      code: error.code || 'INTERNAL_ERROR',
      message: error.message
    }));
    if (!response.headersSent) {
      send(response, request, 500, { error: 'internal_error', requestId });
    } else {
      response.destroy();
    }
  });
});

server.requestTimeout = 15_000;
server.headersTimeout = 10_000;
server.keepAliveTimeout = 5_000;

server.listen(PORT, HOST, () => {
  console.log(JSON.stringify({
    event: 'server_started',
    port: PORT,
    host: HOST,
    databaseConfigured: dbConfigured(),
    authConfigured: authConfigured()
  }));
});

const shutdown = async signal => {
  server.close(async () => {
    await closeDb();
    process.exit(0);
  });
  console.log(JSON.stringify({ event: 'shutdown', signal }));
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
