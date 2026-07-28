import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';

export default defineConfig({
  // JSX без плагина: esbuild сам соберёт .tsx, в tsconfig jsx стоит preserve — это для Next.js
  esbuild: { jsx: 'automatic' },
  resolve: {
    alias: { '@': resolve(__dirname, '.') },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    // e2e и сверка живут на Playwright, у vitest свой круг
    include: ['tests/unit/**/*.test.{ts,tsx}'],
  },
});
