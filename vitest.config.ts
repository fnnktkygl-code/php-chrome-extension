import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'happy-dom',
    globals: true,
    include: ['tests/**/*.test.ts'],
    testTimeout: 5000,
    watch: false,
    coverage: {
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.d.ts']
    }
  }
});
