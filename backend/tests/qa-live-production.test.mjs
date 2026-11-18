import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID, randomBytes } from 'node:crypto';

const BASE = 'https://blohsh-blast.vercel.app';
const email = 'qa-blohshblast-20261118-' + randomUUID().slice(0, 12) + '@example.com';
const password = 'Qa!-' + randomBytes(24).toString('base64url');
const score = 147;

async function send(path, { method = 'GET', token, data } = {}) {
  const response = await fetch(BASE + path, {
    method,
    headers: {
      ...(data === undefined ? {} : {'Content-Type': 'application/json'}),
      ...(token ? {Authorization: 'Bearer ' + token} : {})
    },
    ...(data === undefined ? {} : {body: JSON.stringify(data)}),
    signal: AbortSignal.timeout(15000)
  });
  const payload = await response.json();
  return {status: response.status, payload};
}

function check(label, response, status) {
  assert.equal(response.status, status, label + ': expected HTTP ' + status + '; received ' + response.status + ': ' + JSON.stringify(response.payload).slice(0, 240));
  console.log('PASS ' + label + ' HTTP ' + status);
}

test('BlohshBlast production lifecycle smoke (temporary QA user)', { timeout: 180000 }, async () => {
  console.log('QA_TEST_EMAIL=' + email); // synthetic identifier for post-test database cleanup; never print secrets
  check('healthz', await send('/healthz'), 200);
  check('readyz', await send('/readyz'), 200);
  check('reject anonymous profile', await send('/api/v1/me'), 401);
  check('reject invalid registration', await send('/api/v1/auth/register', {
    method: 'POST', data: { email, password: 'short' }
  }), 400);

  const register = await send('/api/v1/auth/register', {
    method: 'POST', data: {email, password}
  });
  check('register', register, 201);
  assert.ok(register.payload?.data?.accessToken, 'register must issue accessToken');
  check('reject duplicate registration', await send('/api/v1/auth/register', {
    method: 'POST', data: {email, password}
  }), 409);
  check('reject wrong password', await send('/api/v1/auth/login', {
    method: 'POST', data: {email, password: 'NotTheRealQaPassword!'}
  }), 401);

  const login = await send('/api/v1/auth/login', {method: 'POST', data: {email, password}});
  check('login', login, 200);
  const token = login.payload?.data?.accessToken;
  assert.ok(token, 'login must issue accessToken');
  const me = await send('/api/v1/me', {token});
  check('authenticated profile', me, 200);
  assert.equal(me.payload?.data?.email, email);

  const run = await send('/api/v1/runs', {method: 'POST', token, data: {mode: 'classic'}});
  check('create run', run, 201);
  const runId = run.payload?.data?.runId;
  assert.match(runId || '', /^[0-9a-f-]{36}$/i);
  const scorePayload = {
    runId, mode: 'classic', score, moves: 5, lines: 1,
    combo: 1, perfectClear: false, rulesVersion: 'phase4'
  };
  check('submit score', await send('/api/v1/scores', {method: 'POST', token, data: scorePayload}), 201);
  check('reject duplicate score', await send('/api/v1/scores', {method: 'POST', token, data: scorePayload}), 409);
  const leaderboard = await send('/api/v1/leaderboard?mode=classic&limit=50');
  check('online leaderboard', leaderboard, 200);
  assert.ok(Array.isArray(leaderboard.payload?.data));
  assert.ok(leaderboard.payload.data.some(item => item.score === score && item.mode === 'classic'),
    'the synthetic score must be visible on leaderboard');
  check('reject invalid leaderboard mode', await send('/api/v1/leaderboard?mode=not-a-mode'), 400);
  console.log('LIFECYCLE_TEST_COMPLETE: synthetic account should be cleaned via project-scoped SQL.');
});
