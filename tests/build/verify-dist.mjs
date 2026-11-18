import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import { resolve } from 'node:path';

const dist = resolve(process.cwd(), 'dist');
const html = await readFile(resolve(dist, 'index.html'), 'utf8');
const worker = await readFile(resolve(dist, 'sw.js'), 'utf8');

for (const filename of [
  'index.html',
  'sw.js',
  'phase3.js',
  'legacy-game.js',
  'manifest.webmanifest',
  'icon.svg',
  'logo-official-64.png'
]) {
  assert.ok((await stat(resolve(dist, filename))).isFile(), 'Required built asset missing: ' + filename);
}

assert.match(worker, /const CACHE_NAME = 'blohsh-blast-[a-f0-9]{16}';/);
assert.ok(!worker.includes("blohsh-blast-dev"), 'Build must replace the development cache marker');
assert.ok(worker.includes("key.startsWith('blohsh-blast-')"), 'Cache cleanup must be scoped to this app');

assert.match(html, /legacy-game\.js/, 'Legacy runtime must remain available during migration');
assert.match(html, /phase3\.js/, 'Phase 3 runtime must remain available during migration');

const assets = [...html.matchAll(/(?:src|href)=["'](\.?\/assets\/[^"']+)["']/g)]
  .map(match => match[1]);
assert.ok(assets.length > 0, 'Vite must emit a compiled TypeScript entry point');
for (const asset of assets) {
  const relative = new URL(asset, 'https://example.test/').pathname.slice(1);
  assert.ok((await stat(resolve(dist, relative))).isFile(), 'Referenced compiled asset missing: ' + asset);
}

console.log('Production build asset and offline-cache contracts passed.');
