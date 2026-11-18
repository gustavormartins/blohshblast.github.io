// Supabase's shared PostgreSQL pooler uses the Supabase Root 2021 CA.
// Fetch it over verified HTTPS instead of weakening TLS verification.
export const SUPABASE_CA_URL = 'https://supabase-downloads.s3-ap-southeast-1.amazonaws.com/prod/ssl/prod-ca-2021.crt';

export async function resolveDatabaseCa(connectionString, {
  production = false,
  certificateAuthority,
  fetcher = fetch
} = {}) {
  if (!production || certificateAuthority) return certificateAuthority;

  const host = new URL(connectionString).hostname;
  if (!/(^|\.)pooler\.supabase\.com$/i.test(host) &&
      !/^db\.[a-z0-9]+\.supabase\.co$/i.test(host)) return undefined;

  let response;
  try {
    response = await fetcher(SUPABASE_CA_URL, { signal: AbortSignal.timeout(8000) });
  } catch {
    const error = new Error('Unable to fetch trusted Supabase CA');
    error.code = 'SUPABASE_CA_UNAVAILABLE';
    throw error;
  }
  if (!response.ok) {
    const error = new Error('Unable to fetch trusted Supabase CA');
    error.code = 'SUPABASE_CA_UNAVAILABLE';
    throw error;
  }
  const ca = await response.text();
  if (!/^-----BEGIN CERTIFICATE-----\r?\n[\s\S]+-----END CERTIFICATE-----\s*$/.test(ca)) {
    const error = new Error('Invalid Supabase CA certificate format');
    error.code = 'SUPABASE_CA_INVALID';
    throw error;
  }
  return ca;
}
