import { fakeDocument } from '@/test/fakeDocumentsApi';
import { documentFormSchema, documentValuesFromRow, emptyDocumentValues } from './form';

function submitted(overrides: Record<string, string | undefined> = {}) {
  return { ...emptyDocumentValues(), name: 'Resume, 2026', ...overrides };
}

function errorsOf(input: unknown) {
  const result = documentFormSchema.safeParse(input);
  if (result.success) return {};
  return Object.fromEntries(
    result.error.issues.map((issue) => [String(issue.path[0]), issue.message]),
  );
}

describe('documentFormSchema', () => {
  it('needs a name and nothing else', () => {
    expect(documentFormSchema.parse(submitted())).toEqual({
      name: 'Resume, 2026',
      kind: 'resume',
      status: 'not_started',
      url: null,
      notes: null,
    });
    const message = 'Enter a name, like "Resume, 2026".';
    expect(errorsOf(submitted({ name: '' }))).toEqual({ name: message });
    expect(errorsOf(submitted({ name: '   ' }))).toEqual({ name: message });
  });

  it('tidies what was typed', () => {
    expect(
      documentFormSchema.parse(
        submitted({
          name: '  Statement   of   Purpose  ',
          url: 'drive.google.com/file/d/abc',
          notes: 'Draft 3\r\nAsk Dr. Lee to read it',
        }),
      ),
    ).toMatchObject({
      name: 'Statement of Purpose',
      url: 'https://drive.google.com/file/d/abc',
      notes: 'Draft 3\nAsk Dr. Lee to read it',
    });
  });

  it('treats a blank link and blank notes as nothing', () => {
    expect(documentFormSchema.parse(submitted({ url: '   ', notes: '  ' }))).toMatchObject({
      url: null,
      notes: null,
    });
  });

  it('refuses a type or status that does not exist', () => {
    expect(errorsOf(submitted({ kind: 'hologram' })).kind).toBe('Choose a type.');
    expect(errorsOf(submitted({ status: 'lost' })).status).toBe('Choose a status.');
  });

  it.each(['javascript:alert(1)', 'file:///etc/passwd', 'not a link', 'data:text/html,x'])(
    'refuses %j as a link, so a document can never point at anything but a website',
    (url) => {
      expect(errorsOf(submitted({ url })).url).toEqual(expect.any(String));
    },
  );

  it('accepts a name of 200 characters and refuses 201', () => {
    expect(errorsOf(submitted({ name: 'x'.repeat(200) }))).toEqual({});
    expect(errorsOf(submitted({ name: 'x'.repeat(201) })).name).toEqual(expect.any(String));
  });

  it('accepts notes of 10,000 characters and refuses more', () => {
    expect(errorsOf(submitted({ notes: 'x'.repeat(10_000) }))).toEqual({});
    expect(errorsOf(submitted({ notes: 'x'.repeat(10_001) })).notes).toEqual(expect.any(String));
  });
});

describe('documentValuesFromRow', () => {
  it('gives the form a string for every control, with blanks for nothing', () => {
    expect(documentValuesFromRow(fakeDocument({ name: 'CV', kind: 'cv' }))).toEqual({
      name: 'CV',
      kind: 'cv',
      status: 'not_started',
      url: '',
      notes: '',
    });
  });

  it('round-trips through the form unchanged', () => {
    const row = fakeDocument({
      name: 'Portfolio',
      kind: 'portfolio',
      status: 'complete',
      url: 'https://example.com/work',
      notes: 'Updated in September',
    });
    expect(documentFormSchema.parse(documentValuesFromRow(row))).toEqual({
      name: row.name,
      kind: row.kind,
      status: row.status,
      url: row.url,
      notes: row.notes,
    });
  });
});
