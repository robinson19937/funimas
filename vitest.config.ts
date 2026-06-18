import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: false,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: [
        'src/runtime/**/*.ts',
        'src/history/**/*.ts',
        'src/report/**/*.ts',
        'src/generator/functions/**/*.ts',
        'src/validation/**/*.ts',
        'src/rollback/**/*.ts',
      ],
      thresholds: {
        lines: 90,
        functions: 90,
        branches: 90,
        statements: 90,
      },
    },
  },
});
