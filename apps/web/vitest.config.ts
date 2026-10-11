import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  // Same "@/…" alias as tsconfig paths, so tested modules can import each other the app's way.
  resolve: { alias: { '@': fileURLToPath(new URL('./', import.meta.url)) } },
  // Automatic JSX runtime so render tests can import the app's .tsx components (no `import React`).
  esbuild: { jsx: 'automatic' },
  test: { environment: 'node', include: ['**/*.test.ts'] },
});
