import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { query, transaction, closeDb } from './db.mjs';

const root = join(fileURLToPath(new URL('..', import.meta.url)), 'sql');

async function main() {
  await query(
    'CREATE TABLE IF NOT EXISTS schema_migrations (name varchar(255) PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())'
  );

  const names = (await readdir(root))
    .filter(name => name.endsWith('.sql'))
    .sort();

  for (const name of names) {
    const existing = await query('SELECT 1 FROM schema_migrations WHERE name = $1', [name]);
    if (existing.rowCount) continue;

    const sql = await readFile(join(root, name), 'utf8');
    await transaction(async client => {
      await client.query(sql);
      await client.query('INSERT INTO schema_migrations (name) VALUES ($1)', [name]);
    });

    console.log(JSON.stringify({ event: 'migration_applied', name }));
  }
}

main()
  .catch(error => {
    console.error(JSON.stringify({ event: 'migration_failed', message: error.message }));
    process.exitCode = 1;
  })
  .finally(() => closeDb());
