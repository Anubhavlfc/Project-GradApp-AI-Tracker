import { fileURLToPath, URL } from 'node:url';
import react from '@vitejs/plugin-react';
import { loadEnv, type Plugin } from 'vite';
import { defineConfig } from 'vitest/config';
import { brand } from './src/config/brand.ts';
import { assertPublicKey } from './src/lib/publicKey.ts';
import { fillSiteMeta, parseSiteUrl, siteUrlTags } from './src/lib/siteMeta.ts';

/** Fills the title and link-preview tags in index.html from src/config/brand.ts. */
function siteMeta(siteUrl: string | undefined): Plugin {
  return {
    name: 'site-meta',
    transformIndexHtml: (html) => ({
      html: fillSiteMeta(html, brand),
      tags: siteUrlTags(siteUrl),
    }),
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  // Stop the build, not just the page, when a private key is configured: VITE_* values are
  // copied into the public JavaScript bundle.
  if (env.VITE_SUPABASE_ANON_KEY) assertPublicKey(env.VITE_SUPABASE_ANON_KEY);
  // Optional: the canonical address, known only once the site is deployed. A typo fails here.
  const siteUrl = parseSiteUrl(env.VITE_SITE_URL);

  return {
    plugins: [react(), siteMeta(siteUrl)],
    resolve: {
      alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
    },
    server: { port: 3000 },
    build: {
      rolldownOptions: {
        output: {
          // Libraries change far less often than the app. Kept in their own files they stay in
          // the browser's cache across releases, and they download alongside the app's code.
          codeSplitting: {
            groups: [
              {
                name: 'react',
                test: /node_modules[\\/](react|react-dom|scheduler)[\\/]/,
                priority: 3,
              },
              {
                name: 'supabase',
                test: /node_modules[\\/](@supabase|iceberg-js|tslib)[\\/]/,
                priority: 2,
              },
              { name: 'vendor', test: /node_modules[\\/]/, priority: 1 },
            ],
          },
        },
      },
    },
    test: {
      globals: true,
      css: false,
      // Not UTC, so a date worked out in UTC where it should be the person's own day fails a test
      // instead of showing the wrong day to someone in the evening, west of Greenwich.
      env: { TZ: 'America/Los_Angeles' },
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
