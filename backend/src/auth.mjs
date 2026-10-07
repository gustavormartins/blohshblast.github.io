import { SignJWT, jwtVerify } from 'jose';

const secret = process.env.JWT_SECRET
  ? new TextEncoder().encode(process.env.JWT_SECRET)
  : null;

const issuer = process.env.JWT_ISSUER || 'blohsh-blast-api';
const audience = process.env.JWT_AUDIENCE || 'blohsh-blast-web';

export function authConfigured() {
  return Boolean(secret && secret.length >= 32);
}

export async function signAccessToken(user) {
  if (!secret) throw new Error('JWT_SECRET_NOT_CONFIGURED');

  return new SignJWT({ role: user.role })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setSubject(user.id)
    .setIssuedAt()
    .setIssuer(issuer)
    .setAudience(audience)
    .setExpirationTime('15m')
    .sign(secret);
}

export async function verifyAccessToken(token) {
  if (!secret) {
    const error = new Error('JWT_SECRET_NOT_CONFIGURED');
    error.code = 'AUTH_NOT_CONFIGURED';
    throw error;
  }

  const result = await jwtVerify(token, secret, {
    algorithms: ['HS256'],
    issuer,
    audience
  });

  const role = result.payload.role;
  const sub = result.payload.sub;
  if (typeof sub !== 'string' || (role !== 'user' && role !== 'admin')) {
    const error = new Error('INVALID_TOKEN_CLAIMS');
    error.code = 'INVALID_TOKEN_CLAIMS';
    throw error;
  }

  return { id: sub, role };
}

export function getBearerToken(request) {
  const header = request.headers.get('authorization') || '';
  if (!header.startsWith('Bearer ')) return null;
  return header.slice(7).trim() || null;
}
