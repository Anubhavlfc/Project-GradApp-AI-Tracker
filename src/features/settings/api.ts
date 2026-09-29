import type { SupabaseClient } from '@supabase/supabase-js';
import { createGuard } from '@/lib/dataApi';

/** Every table that holds something the person entered or that the app recorded for them. */
export const EXPORT_TABLES = [
  'profiles',
  'universities',
  'applications',
  'documents',
  'requirements',
  'recommenders',
  'recommendation_requests',
  'funding',
  'tasks',
  'activity',
] as const;
export type ExportTable = (typeof EXPORT_TABLES)[number];

export type ExportRow = Record<string, unknown>;
export type AccountData = Record<ExportTable, ExportRow[]>;

/** Supabase answers at most 1,000 rows per request, so a longer table is read a page at a time. */
export const PAGE_SIZE = 1000;

/** What the Settings page needs from the database. */
export interface SettingsApi {
  /** Everything the signed-in person has stored, table by table, as it is in the database. */
  exportData(): Promise<AccountData>;
  /** Deletes the signed-in person's account and everything in it. There is no undo. */
  deleteAccount(): Promise<void>;
}

const guard = createGuard('settings');

export function createSettingsApi(client: SupabaseClient): SettingsApi {
  // Row level security limits every read to the signed-in person's own rows, so nothing needs to
  // be filtered here. Ordering by id as well as time keeps pages from overlapping or skipping rows.
  async function readAll(table: ExportTable): Promise<ExportRow[]> {
    const rows: ExportRow[] = [];
    for (let from = 0; ; from += PAGE_SIZE) {
      const { data, error } = await client
        .from(table)
        .select('*')
        .order('created_at', { ascending: true })
        .order('id', { ascending: true })
        .range(from, from + PAGE_SIZE - 1);
      if (error) throw error;
      const page = (data ?? []) as ExportRow[];
      rows.push(...page);
      if (page.length < PAGE_SIZE) return rows;
    }
  }

  return {
    exportData: () =>
      guard('exportData', async () => {
        const entries = await Promise.all(
          EXPORT_TABLES.map(async (table) => [table, await readAll(table)] as const),
        );
        return Object.fromEntries(entries) as AccountData;
      }),

    // The database function deletes whoever is signed in and nobody else: it takes no argument.
    deleteAccount: () =>
      guard('deleteAccount', async () => {
        const { error } = await client.rpc('delete_my_account');
        if (error) throw error;
      }),
  };
}
