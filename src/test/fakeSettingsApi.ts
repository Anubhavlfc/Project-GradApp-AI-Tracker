import { EXPORT_TABLES, type AccountData, type SettingsApi } from '@/features/settings/api';

/** An account with nothing stored, or with the given rows in some tables. */
export function fakeAccountData(rows: Partial<AccountData> = {}): AccountData {
  return {
    ...(Object.fromEntries(EXPORT_TABLES.map((table) => [table, []])) as unknown as AccountData),
    ...rows,
  };
}

/**
 * An in-memory SettingsApi. Both methods are mocks that succeed, so a test only overrides what it
 * cares about (a failure, a slow answer, particular rows).
 */
export function createFakeSettingsApi(data: AccountData = fakeAccountData()) {
  const api = {
    exportData: vi.fn<SettingsApi['exportData']>(async () => structuredClone(data)),
    deleteAccount: vi.fn<SettingsApi['deleteAccount']>(async () => undefined),
  } satisfies SettingsApi;
  return { api };
}
