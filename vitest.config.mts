import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Playwright 用の E2E テストは Vitest から除外する
    exclude: [
      'tests/approvals.spec.ts',
      'node_modules/**',
      'dist/**',
      '.vite/**',
      '.next/**',
    ],
  },
});
