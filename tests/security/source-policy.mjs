import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const index = await readFile(new URL('../../index.html', import.meta.url), 'utf8');
const render = await readFile(new URL('../../render.yaml', import.meta.url), 'utf8');
const API_ORIGIN = 'https://blohsh-blast-api.onrender.com';

// Keep the HTML meta CSP for local preview aligned with the Render header.
const meta = index.match(/<meta\s+http-equiv="Content-Security-Policy"\s+content="([^"]+)"/i);
const header = render.match(/name:\s*Content-Security-Policy\s*\n\s*value:\s*"([^"]+)"/i);
assert.ok(meta, 'Missing HTML Content-Security-Policy');
assert.ok(header, 'Missing Render Content-Security-Policy');

const expectedConnectSrc = "connect-src 'self' " + API_ORIGIN;
for (const [name, policy] of [['HTML', meta[1]], ['Render', header[1]]]) {
  const directives = policy.split(';').map(part => part.trim());
  assert.ok(directives.includes(expectedConnectSrc), name + ' CSP must allow only self + the Blohsh API');
  assert.ok(directives.includes("script-src 'self'"), name + ' CSP must require local scripts');
  assert.ok(directives.includes("object-src 'none'"), name + ' CSP must disable plugins');
}

const htmlWithoutCsp = index.replace(meta[0], '');
const forbidden = [
  { label: 'inline script', re: /<script\b(?![^>]*\bsrc\s*=)[^>]*>[\s\S]*?<\/script>/i },
  { label: 'inline event handler', re: /\son[a-z]+\s*=/i },
  { label: 'javascript URI', re: /javascript:/i },
  { label: 'remote script', re: /<script\b[^>]*\bsrc\s*=\s*["']https?:\/\//i },
  { label: 'remote media or stylesheet', re: /<(?:link|img|iframe)\b[^>]*(?:src|href)\s*=\s*["']https?:\/\//i }
];

for (const check of forbidden) {
  assert.ok(!check.re.test(htmlWithoutCsp), 'Security regression in index.html: ' + check.label);
}

for (const required of [
  'Content-Security-Policy',
  'X-Content-Type-Options',
  'X-Frame-Options',
  'Referrer-Policy',
  'Permissions-Policy',
  'Strict-Transport-Security'
]) {
  assert.ok(render.includes(required), 'Missing Render security header: ' + required);
}

console.log('Static security policy checks passed.');
