import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig } from 'vitest/config';

const legacyFiles = ['phase3.js', 'legacy-game.js', 'sw.js', 'manifest.webmanifest', 'icon.svg', 'logo-official-64.png'];

export default defineConfig({
  base: './',
  server: { host: '127.0.0.1', port: 4173 },
  preview: { host: '127.0.0.1', port: 4173 },
  build: {
    sourcemap: false,
    rollupOptions: {
      plugins: [{
        name: 'copy-legacy-root-assets',
        generateBundle() {
          for (const fileName of legacyFiles) {
            const source = readFileSync(resolve(process.cwd(), fileName));
            this.emitFile({ type: 'asset', fileName, source });
          }
        }
      }]
    }
  },
  test: {
    environment: 'node',
    include: ['tests/unit/**/*.test.ts']
  }
});
