import { readFile } from 'node:fs/promises';

const index = await readFile(new URL('../../index.html', import.meta.url), 'utf8');
const render = await readFile(new URL('../../render.yaml', import.meta.url), 'utf8');

const forbidden = [
  { label: 'inline script', re: new RegExp('<script\\\\s*>[\\\\s\\\\S]*<\\\\/script>', 'i') },
  { label: 'inline event handler', re: new RegExp('\\\\son[a-z]+\\\\s*=', 'i') },
  { label: 'javascript URI', re: new RegExp('javascript:', 'i') },
  { label: 'external HTTP URL', re: new RegExp('https?:\\\\/\\\\/(?!localhost)', 'i') },
];

for (const check of forbidden) {
  if (check.re.test(index)) {
    throw new Error('Security regression in index.html: ' + check.label);
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
