import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    // Use happy-dom to avoid jsdom's ESM/CJS dependency conflict in Node18
    environment: 'happy-dom',
    // Add the setup file
    setupFiles: ['./tests/setup.ts'],
    // Use test-specific TypeScript config
    tsconfig: './tsconfig.test.json',
    // Playwright 用の E2E テストは Vitest から除外する
    exclude: [
      'tests/approvals.spec.ts',
      'tests/simple_estimates.spec.ts',
      '**/node_modules/**',
      'dist/**',
      '.vite/**',
      '.next/**',
    ],
  },
});
