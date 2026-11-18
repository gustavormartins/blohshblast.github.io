// Create a safe node-postgres configuration for a server-only API.
// Supabase Transaction Pooler (port 6543) is recommended for serverless hosts.
export function buildDatabasePoolOptions(connectionString, { production = false, certificateAuthority } = {}) {
  if (!connectionString) return null;

  let url;
  try {
    url = new URL(connectionString);
  } catch {
    throw new Error('DATABASE_URL must be a valid PostgreSQL connection string');
  }
  if (!['postgres:', 'postgresql:'].includes(url.protocol) || !url.hostname) {
    throw new Error('DATABASE_URL must use a postgres:// or postgresql:// URI');
  }

  if (production) {
    // node-postgres gives URI SSL parameters precedence over its ssl option.
    // Remove query flags that could silently disable hostname verification.
    for (const key of ['sslmode', 'ssl', 'sslcert', 'sslkey', 'sslrootcert', 'uselibpqcompat']) {
      url.searchParams.delete(key);
    }
  }

  return {
    connectionString: url.toString(),
    max: production ? 2 : 5,
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 5_000,
    ssl: production
      ? {
          rejectUnauthorized: true,
          ...(certificateAuthority ? { ca: certificateAuthority.replace(/\\n/g, '\n') } : {})
        }
      : undefined
  };
}
