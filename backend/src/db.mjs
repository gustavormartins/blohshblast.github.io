import pg from 'pg';
import { buildDatabasePoolOptions } from './db-config.mjs';
import { resolveDatabaseCa } from './supabase-ca.mjs';

const { Pool } = pg;
const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL;
let poolPromise = null;

export function dbConfigured() {
  return Boolean(connectionString);
}

async function getPool() {
  if (!connectionString) {
    const error = new Error('DATABASE_NOT_CONFIGURED');
    error.code = 'DATABASE_NOT_CONFIGURED';
    throw error;
  }

  if (!poolPromise) {
    poolPromise = (async () => {
      const production = process.env.NODE_ENV === 'production';
      const certificateAuthority = await resolveDatabaseCa(connectionString, {
        production,
        certificateAuthority: process.env.PG_SSL_CA
      });
      const options = buildDatabasePoolOptions(connectionString, {
        production,
        certificateAuthority
      });
      return new Pool(options);
    })().catch(error => {
      poolPromise = null; // Allow another cold-start attempt after transient fetch failure.
      throw error;
    });
  }
  return poolPromise;
}

export async function query(text, values = []) {
  const pool = await getPool();
  return pool.query(text, values);
}

export async function transaction(callback) {
  const pool = await getPool();
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
  if (poolPromise) {
    const pool = await poolPromise;
    await pool.end();
    poolPromise = null;
  }
}
