import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EXPORT_TABLES } from './api';
import { fakeAccountData } from '@/test/fakeSettingsApi';
import { buildExport, exportFileName, saveJson } from './exportFile';

const emptyData = fakeAccountData();

describe('buildExport', () => {
  it('says what it is, when it was taken, and whose it is', () => {
    const now = new Date('2026-09-30T18:30:00Z');
    const exported = buildExport({ email: 'ada@example.com', data: emptyData, now });
    expect(exported).toEqual({
      app: 'Application Command Center',
      exportedAt: '2026-09-30T18:30:00.000Z',
      account: { email: 'ada@example.com' },
      data: emptyData,
    });
  });

  it('keeps every table, even the empty ones', () => {
    const exported = buildExport({ email: null, data: emptyData, now: new Date() });
    expect(Object.keys(exported.data)).toEqual([...EXPORT_TABLES]);
  });
});

describe('exportFileName', () => {
  it('names the file after the product and the day, on the person’s own calendar', () => {
    // Late evening in Los Angeles is already the next day in UTC; the file carries the local day.
    expect(exportFileName(new Date(2026, 8, 30, 21, 0))).toBe(
      'application-command-center-data-2026-09-30.json',
    );
  });

  it('is safe as a file name', () => {
    expect(exportFileName(new Date(2026, 0, 5))).toMatch(/^[a-z0-9-]+\.json$/);
  });
});

describe('saveJson', () => {
  const created: Blob[] = [];
  let clicked: { download: string; href: string } | null = null;

  beforeEach(() => {
    created.length = 0;
    clicked = null;
    vi.useFakeTimers();
    URL.createObjectURL = vi.fn((blob: Blob | MediaSource) => {
      created.push(blob as Blob);
      return 'blob:fake-url';
    });
    URL.revokeObjectURL = vi.fn();
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      clicked = { download: this.download, href: this.href };
    });
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('offers the JSON as a download with the given name, and leaves nothing on the page', async () => {
    saveJson('mine.json', { hello: 'world' });
    expect(clicked).toEqual({ download: 'mine.json', href: 'blob:fake-url' });
    expect(document.querySelector('a[download]')).toBeNull();
    expect(created).toHaveLength(1);
    expect(created[0]?.type).toBe('application/json');
    expect(await created[0]?.text()).toBe(JSON.stringify({ hello: 'world' }, null, 2));
  });

  it('frees the temporary address once the browser has had time to start the download', () => {
    saveJson('mine.json', {});
    expect(URL.revokeObjectURL).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1000);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:fake-url');
  });
});
