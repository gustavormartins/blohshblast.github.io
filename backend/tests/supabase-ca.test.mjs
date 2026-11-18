import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveDatabaseCa, SUPABASE_CA_URL } from '../src/supabase-ca.mjs';

const pooler = 'postgres://postgres.project:password@aws-0-sa-east-1.pooler.supabase.com:6543/postgres';

test('fetches trusted Supabase CA for production shared pooler', async () => {
  let called = false;
  const fake = '-----BEGIN CERTIFICATE-----\nTEST\n-----END CERTIFICATE-----';
  const result = await resolveDatabaseCa(pooler, {
    production: true,
    fetcher: async (url) => {
      assert.equal(url, SUPABASE_CA_URL);
      called = true;
      return { ok: true, text: async () => fake };
    }
  });
  assert.equal(called, true);
  assert.equal(result, fake);
});
test('supports provided CA without network and skips CA for non-Supabase', async () => {
  const fail = async () => { throw Error('network should not be used'); };
  assert.equal(await resolveDatabaseCa(pooler, { production: true, certificateAuthority: 'PEM', fetcher: fail }), 'PEM');
  assert.equal(await resolveDatabaseCa(pooler, { production: false, fetcher: fail }), undefined);
  assert.equal(await resolveDatabaseCa('postgres://user:pass@localhost:5432/postgres', { production: true, fetcher: fail }), undefined);
});
test('fails closed on missing or invalid trusted root', async () => {
  await assert.rejects(resolveDatabaseCa(pooler, {
    production: true, fetcher: async () => ({ ok: false })
  }), { code: 'SUPABASE_CA_UNAVAILABLE' });
  await assert.rejects(resolveDatabaseCa(pooler, {
    production: true, fetcher: async () => ({ ok: true, text: async () => 'not a pem' })
  }), { code: 'SUPABASE_CA_INVALID' });
});
