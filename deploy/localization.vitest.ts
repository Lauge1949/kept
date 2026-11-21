import { defineConfig } from 'vitest/config';
export default defineConfig({
  test: {
    include: ['deploy/localization.test.ts', 'packages/shared/src/map-shapes.test.ts', 'apps/server/src/setup/recovery-kit-content.test.ts'],
    environment: 'node',
  },
});
