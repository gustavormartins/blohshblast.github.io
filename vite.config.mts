import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig } from 'vitest/config';

const legacyFiles = ['phase3.js', 'legacy-game.js', 'manifest.webmanifest', 'icon.svg', 'logo-official-64.png'];

export default defineConfig({
  base: './',
  server: { host: '127.0.0.1', port: 4173 },
  preview: { host: '127.0.0.1', port: 4173 },
  build: {
    sourcemap: false,
    rollupOptions: {
      plugins: [{
        name: 'copy-legacy-root-assets',
        generateBundle(_options, bundle) {
          // Hash both the bundled TypeScript output and copied legacy assets.
          // A new release changes sw.js, so browsers install a fresh offline cache.
          const hash = createHash('sha256');
          for (const [fileName, output] of Object.entries(bundle).sort(([a], [b]) => a.localeCompare(b))) {
            hash.update(fileName);
            hash.update(output.type === 'chunk' ? output.code : output.source);
          }

          for (const fileName of legacyFiles) {
            const source = readFileSync(resolve(process.cwd(), fileName));
            hash.update(fileName);
            hash.update(source);
            this.emitFile({ type: 'asset', fileName, source });
          }

          hash.update(readFileSync(resolve(process.cwd(), 'index.html')));
          const serviceWorkerSource = readFileSync(resolve(process.cwd(), 'sw.js'), 'utf8');
          if (!serviceWorkerSource.includes('blohsh-blast-dev')) {
            throw new Error('Unexpected service worker cache version placeholder');
          }
          hash.update(serviceWorkerSource);
          const version = hash.digest('hex').slice(0, 16);
          const serviceWorker = serviceWorkerSource.replace('blohsh-blast-dev', 'blohsh-blast-' + version);
          this.emitFile({ type: 'asset', fileName: 'sw.js', source: serviceWorker });
        }
      }]
    }
  },
  test: {
    environment: 'node',
    include: ['tests/unit/**/*.test.ts']
  }
});
