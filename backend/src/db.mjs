import pg from 'pg';
import { buildDatabasePoolOptions } from './db-config.mjs';

const { Pool } = pg;

const poolOptions = buildDatabasePoolOptions(process.env.DATABASE_URL, {
  production: process.env.NODE_ENV === 'production',
  certificateAuthority: process.env.PG_SSL_CA
});
const pool = poolOptions ? new Pool(poolOptions) : null;

export function dbConfigured() {
  return Boolean(pool);
}

export async function query(text, values = []) {
  if (!pool) {
    const error = new Error('DATABASE_NOT_CONFIGURED');
    error.code = 'DATABASE_NOT_CONFIGURED';
    throw error;
  }
  return pool.query(text, values);
}

export async function transaction(callback) {
  if (!pool) {
    const error = new Error('DATABASE_NOT_CONFIGURED');
    error.code = 'DATABASE_NOT_CONFIGURED';
    throw error;
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function closeDb() {
  if (pool) await pool.end();
}
