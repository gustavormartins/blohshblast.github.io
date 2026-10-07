import { readFile } from 'node:fs/promises';

const index = await readFile(new URL('../../index.html', import.meta.url), 'utf8');
const render = await readFile(new URL('../../render.yaml', import.meta.url), 'utf8');

const forbidden = [
  /<script\\s*>[\\s\\S]*<\\/script>/i,
  /\\son[a-z]+\\s*=/i,
  /javascript:/i,
  /https?:\\/\\/(?!localhost)/i,
];

for (const pattern of forbidden) {
  if (pattern.test(index)) {
    throw new Error('Security regression in index.html: ' + pattern);
  }
}

for (const required of [
  'Content-Security-Policy',
  'X-Content-Type-Options',
  'X-Frame-Options',
  'Referrer-Policy',
  'Permissions-Policy',
  'Strict-Transport-Security'
 ]) {
  if (!render.includes(required)) {
    throw new Error('Missing Render security header: ' + required);
  }
}

console.log('Static security policy checks passed.');
