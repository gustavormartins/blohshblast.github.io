const base = process.env.LIVE_URL || 'https://blohsh-blast.onrender.com/';
const strictHeaders = process.env.LIVE_SECURITY_STRICT === '1';
const payload = '<script>alert(\"BLOHSH_XSS\")</script>';
const url = new URL(base);
if (url.protocol !== 'https:') throw new Error('Live security test requires HTTPS.');

const response = await fetch(url, { redirect: 'follow' });
const body = await response.text();
if (!response.ok) throw new Error('Live site returned HTTP ' + response.status);
if (body.includes(payload) || body.includes('BLOHSH_XSS')) {
  throw new Error('Reflected XSS payload detected in live HTML response.');
}

const requiredHeaders = {
  'content-security-policy': 'Content-Security-Policy',
  'x-content-type-options': 'X-Content-Type-Options',
  'x-frame-options': 'X-Frame-Options',
  'referrer-policy': 'Referrer-Policy',
  'permissions-policy': 'Permissions-Policy',
  'strict-transport-security': 'Strict-Transport-Security'
};

const missing = Object.entries(requiredHeaders)
  .filter(([key]) => !response.headers.get(key))
  .map(([, label]) => label);

console.log('Live status:', response.status);
console.log('Security headers:', missing.length ? 'missing ' + missing.join(', ') : 'all present');

if (strictHeaders && missing.length) {
  throw new Error('Missing live security headers: ' + missing.join(', '));
}
