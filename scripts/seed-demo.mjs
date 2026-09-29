#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import { buildDemoData, isDemoEmail } from './demo-data.mjs';

// Fills a DEMO account with clearly labelled sample programs, so the dashboard has something to
// show while you develop, take screenshots or record a walkthrough.
//
//   1. Sign up for a separate account whose address starts with "demo", e.g. demo@yourdomain.com,
//      and confirm the email. (Do not use your real account.)
//   2. DEMO_EMAIL=demo@yourdomain.com DEMO_PASSWORD='...' npm run seed:demo
//
// It uses the public key and the demo account's own sign-in, so row level security applies just
// as it does in the app; no secret key is involved. It refuses to run for an address that does not
// start with "demo", and for an account that already has anything in it, so sample data can never
// be mixed with real applications. To remove it, delete the demo account (Settings, in the app).

const FILL_ORDER = [
  ['universities', 'universities'],
  ['applications', 'programs'],
  ['documents', 'documents'],
  ['requirements', 'checklist items'],
  ['recommenders', 'recommenders'],
  ['recommendation_requests', 'letter requests'],
  ['funding', 'funding items'],
  ['tasks', 'tasks'],
];
// If any of these already has a row, the account is not empty.
const MUST_BE_EMPTY = [
  'applications',
  'universities',
  'documents',
  'recommenders',
  'funding',
  'tasks',
];

function stop(message) {
  console.error(`\n${message}\n`);
  process.exit(1);
}

/** KEY=value lines from a file, for the variables that are not already set. */
function loadEnvFile(path) {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const match = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/.exec(line);
    if (!match || line.trimStart().startsWith('#')) continue;
    const [, key, raw] = match;
    if (key && process.env[key] === undefined)
      process.env[key] = raw?.replace(/^(['"])(.*)\1$/, '$2');
  }
}

function argument(name) {
  const at = process.argv.indexOf(`--${name}`);
  return at >= 0 ? process.argv[at + 1] : undefined;
}

loadEnvFile('.env.local');
loadEnvFile('.env');

const url = process.env.VITE_SUPABASE_URL;
const key = process.env.VITE_SUPABASE_ANON_KEY;
const email = argument('email') ?? process.env.DEMO_EMAIL;
const password = argument('password') ?? process.env.DEMO_PASSWORD;

if (!url || !key) {
  stop('Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY (in .env.local, as for the app) first.');
}
if (key.startsWith('sb_secret_')) {
  stop('That is a secret key. Use the public anon/publishable key, and rotate the secret one.');
}
if (!email || !password) {
  stop('Give the demo account: DEMO_EMAIL=demo@example.com DEMO_PASSWORD=... npm run seed:demo');
}
if (!isDemoEmail(email)) {
  stop(
    `"${email}" is not a demo address. Sample data is only added to an account whose email starts\n` +
      'with "demo" (for example demo@example.com), so a real account is never filled with samples.',
  );
}

const client = createClient(url, key, { auth: { persistSession: false } });

const { error: signInError } = await client.auth.signInWithPassword({ email, password });
if (signInError) {
  stop(
    `Could not sign in as ${email}: ${signInError.message}\n` +
      'Sign up for the demo account in the app first, and confirm the email address.',
  );
}

for (const table of MUST_BE_EMPTY) {
  const { count, error } = await client.from(table).select('id', { count: 'exact', head: true });
  if (error) stop(`Could not check ${table}: ${error.message}`);
  if (count) {
    stop(
      `${email} already has ${table} in it. Sample data is only added to an empty account, so it\n` +
        'can never be mixed with real applications. Sign up for a fresh demo account instead.',
    );
  }
}

/** Takes back what this run added (the account was empty before it), newest kind of row first. */
async function takeBack(data) {
  for (const [table] of [...FILL_ORDER].reverse()) {
    const ids = data[table].map((row) => row.id);
    const { error } = await client.from(table).delete().in('id', ids);
    if (error) return false;
  }
  return true;
}

const data = buildDemoData();
for (const [table, name] of FILL_ORDER) {
  const rows = data[table];
  // Fields a row leaves out take the database's defaults, instead of being sent as null.
  const { error } = await client.from(table).insert(rows, { defaultToNull: false });
  if (error) {
    const tidy = await takeBack(data);
    stop(
      `Stopped while adding ${name}: ${error.message}\n` +
        (tidy
          ? 'What had been added was taken back, so the account is empty again.'
          : 'Some sample data may still be in the account. Delete the demo account and start again.'),
    );
  }
  console.log(`Added ${rows.length} ${name}`);
}

await client.auth.signOut();
console.log(
  `\nDone. Sign in as ${email} to see the sample programs.\n` +
    'Every row says "Sample data" in its notes. To remove it all, delete the demo account.',
);
