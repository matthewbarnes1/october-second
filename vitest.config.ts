import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';
const r = (p: string) => fileURLToPath(new URL(p, import.meta.url));
export default defineConfig({
  resolve: {
    alias: {
      '@morpheus/core': r('./packages/core/src/index.ts'),
      '@morpheus/adapter-html': r('./packages/adapter-html/src/index.ts'),
    },
  },
  test: { include: ['tests/**/*.test.ts'] },
});
