import test from 'node:test';
import assert from 'node:assert/strict';
import { buildDatabasePoolOptions } from '../src/db-config.mjs';

const uri = 'postgresql://postgres.project:sample-password@aws-0-sa-east-1.pooler.supabase.com:6543/postgres';

test('unconfigured database returns null for local/offline mode', () => {
  assert.equal(buildDatabasePoolOptions(undefined), null);
});

test('production requires verified TLS and keeps serverless pool small', () => {
  const options = buildDatabasePoolOptions(uri, { production: true });
  assert.equal(options.ssl.rejectUnauthorized, true);
  assert.equal(options.max, 2);
  assert.equal(new URL(options.connectionString).port, '6543');
});

test('connection-string SSL flags cannot override safe TLS settings', () => {
  const options = buildDatabasePoolOptions(uri + '?sslmode=no-verify&ssl=0&uselibpqcompat=true', { production: true });
  const parsed = new URL(options.connectionString);
  assert.equal(parsed.searchParams.has('sslmode'), false);
  assert.equal(parsed.searchParams.has('ssl'), false);
  assert.equal(options.ssl.rejectUnauthorized, true);
});

test('custom CA is supported without disabling certificate verification', () => {
  const options = buildDatabasePoolOptions(uri, {
    production: true,
    certificateAuthority: '-----BEGIN CERTIFICATE-----\\nABC\\n-----END CERTIFICATE-----'
  });
  assert.ok(options.ssl.ca.includes('\n'));
  assert.equal(options.ssl.rejectUnauthorized, true);
});

test('rejects malformed and non-PostgreSQL connection strings', () => {
  for (const invalid of ['not-a-url', 'https://example.com']) {
    assert.throws(() => buildDatabasePoolOptions(invalid, { production: true }), /DATABASE_URL/);
  }
});
