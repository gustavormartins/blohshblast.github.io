import test from 'node:test';
import assert from 'node:assert/strict';
import { registerSchema, loginSchema } from '../src/validation.mjs';

test('registration accepts a safe nickname without exposing extra attributes', () => {
  const payload = registerSchema.parse({
    email: 'qa@example.com', password: 'valid-long-password',
    nickname: 'JogadorQA'
  });
  assert.equal(payload.nickname, 'JogadorQA');
  assert.throws(() => registerSchema.parse({
    email: 'qa@example.com', password: 'valid-long-password',
    nickname: '<script>'
  }));
});

test('existing email/password logins remain compatible with nickname registrations', () => {
  const payload = loginSchema.parse({
    email: 'qa@example.com',
    password: 'valid-long-password'
  });
  assert.equal(payload.email, 'qa@example.com');
  assert.deepEqual(Object.keys(payload).sort(), ['email', 'password']);
  assert.throws(() => loginSchema.parse({
    email: 'qa@example.com',
    password: 'valid-long-password',
    nickname: 'not accepted on login'
  }));
});
