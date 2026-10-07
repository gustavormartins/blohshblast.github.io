import { promisify } from 'node:util';
import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';

const scrypt = promisify(scryptCallback);
const N = 32768;
const R = 8;
const P = 1;
const KEYLEN = 64;

export async function hashPassword(password) {
  const salt = randomBytes(16);
  const derived = await scrypt(password, salt, KEYLEN, { N, r: R, p: P, maxmem: 128 * 1024 * 1024 });
  return [
    'scrypt',
    N,
    R,
    P,
    salt.toString('base64url'),
    Buffer.from(derived).toString('base64url')
  ].join('$');
}

export async function verifyPassword(password, encoded) {
  const [algorithm, n, r, p, saltB64, hashB64] = String(encoded).split('$');
  if (algorithm !== 'scrypt' || !n || !r || !p || !saltB64 || !hashB64) return false;

  try {
    const salt = Buffer.from(saltB64, 'base64url');
    const expected = Buffer.from(hashB64, 'base64url');
    const actual = Buffer.from(await scrypt(password, salt, expected.length, {
      N: Number(n),
      r: Number(r),
      p: Number(p),
      maxmem: 128 * 1024 * 1024
    }));
    return actual.length === expected.length && timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}
