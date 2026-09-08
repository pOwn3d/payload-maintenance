import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    // `scripts/` holds the uninstall binary, which is plain ESM and lives
    // outside `src` (tsconfig's rootDir). Same layout as the other plugins of
    // this family that ship a bin.
    include: ['src/**/*.test.ts', 'scripts/**/*.test.mjs'],
  },
})
