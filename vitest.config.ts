import { defineConfig } from 'vitest/config';
export default defineConfig({ test: { include: ['server/src/**/*.test.ts', 'client/src/**/*.test.tsx'], exclude: ['**/*.db.test.ts'], environment: 'node', restoreMocks: true } });
