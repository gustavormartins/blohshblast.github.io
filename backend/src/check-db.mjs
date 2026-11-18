import { dbConfigured, query, closeDb } from './db.mjs';

if (!dbConfigured()) {
  console.error('Database check aborted: DATABASE_URL is missing.');
  process.exitCode = 1;
} else {
  try {
    const health = await query(`SELECT
      current_database() AS database_name,
      to_regclass('public.users') IS NOT NULL AS users_ready,
      to_regclass('public.game_runs') IS NOT NULL AS runs_ready,
      to_regclass('public.scores') IS NOT NULL AS scores_ready`);
    const state = health.rows[0];
    if (!state?.users_ready || !state?.runs_ready || !state?.scores_ready) {
      throw new Error('Required game tables were not found.');
    }
    console.log(JSON.stringify({ status: 'ready', database: state.database_name, schemaReady: true }));
  } catch (error) {
    // Do not print connection strings, credentials or full driver diagnostics.
    console.error(JSON.stringify({ status: 'not_ready', code: error.code || 'CONNECTION_FAILED' }));
    process.exitCode = 1;
  } finally {
    await closeDb();
  }
}
