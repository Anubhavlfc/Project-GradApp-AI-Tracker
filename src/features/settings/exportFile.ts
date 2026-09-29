import { brand } from '@/config/brand';
import { toISODate } from '@/features/applications/dates';
import type { AccountData } from './api';

/** The downloaded file: the account's rows, plus when and by whom they were taken. */
export type AccountExport = {
  app: string;
  exportedAt: string;
  account: { email: string | null };
  data: AccountData;
};

export function buildExport(input: {
  email: string | null;
  data: AccountData;
  now: Date;
}): AccountExport {
  return {
    app: brand.name,
    exportedAt: input.now.toISOString(),
    account: { email: input.email },
    data: input.data,
  };
}

/** E.g. "application-command-center-data-2026-09-30.json", dated by the person's own calendar. */
export function exportFileName(now: Date): string {
  const slug = brand.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return `${slug}-data-${toISODate(now)}.json`;
}

/** Offers `value` to the browser as a file download. Nothing is sent anywhere. */
export function saveJson(fileName: string, value: unknown): void {
  const blob = new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.append(link);
  link.click();
  link.remove();
  // Some browsers start the download after the click returns; let them finish before freeing it.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
