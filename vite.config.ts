import { fileURLToPath, URL } from 'node:url';
import react from '@vitejs/plugin-react';
import { loadEnv } from 'vite';
import { defineConfig } from 'vitest/config';
import { assertPublicKey } from './src/lib/publicKey.ts';

export default defineConfig(({ mode }) => {
  // Stop the build, not just the page, when a private key is configured: VITE_* values are
  // copied into the public JavaScript bundle.
  const anonKey = loadEnv(mode, process.cwd(), 'VITE_').VITE_SUPABASE_ANON_KEY;
  if (anonKey) assertPublicKey(anonKey);

  return {
    plugins: [react()],
    resolve: {
      alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
    },
    server: { port: 3000 },
    test: {
      globals: true,
      css: false,
      projects: [
        {
          extends: true,
          test: {
            name: 'app',
            environment: 'jsdom',
            include: ['src/**/*.test.{ts,tsx}'],
            setupFiles: ['./src/test/setup.ts'],
          },
        },
        {
          // Database tests: real migrations on an in-process Postgres (PGlite), no Docker needed.
          extends: true,
          test: {
            name: 'db',
            environment: 'node',
            include: ['supabase/tests/**/*.test.ts'],
            testTimeout: 30_000,
            hookTimeout: 120_000,
          },
        },
      ],
    },
  };
});
