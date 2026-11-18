import test from 'node:test';
import assert from 'node:assert/strict';
import { getBearerToken } from '../src/auth.mjs';

test('accepts authorization from IncomingMessage plain headers', () => {
  assert.equal(getBearerToken({ headers: { authorization: 'Bearer abc' } }), 'abc');
  assert.equal(getBearerToken({ headers: { authorization: 'Basic abc' } }), null);
});
test('accepts authorization from Fetch headers', () => {
  assert.equal(getBearerToken({ headers: new Headers({ authorization: 'Bearer def' }) }), 'def');
});
