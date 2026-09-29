import { fakeFunding } from '@/test/fakeFundingApi';
import { emptyFundingValues, fundingFormSchema, fundingValuesFromRow } from './form';

/** What the browser submits: text for every control, and "on" for a ticked checkbox. */
/** A copy of `values` without one key, like a browser leaving a field out of the form data. */
const without = (values: Record<string, unknown>, key: string) =>
  Object.fromEntries(Object.entries(values).filter(([name]) => name !== key));

function submitted(overrides: Record<string, string | undefined> = {}) {
  const values = without(emptyFundingValues(), 'application_required');
  return { ...values, name: 'Departmental fellowship', ...overrides };
}

function errorsOf(input: unknown) {
  const result = fundingFormSchema.safeParse(input);
  if (result.success) return {};
  return Object.fromEntries(
    result.error.issues.map((issue) => [String(issue.path[0]), issue.message]),
  );
}

describe('fundingFormSchema', () => {
  it('needs a name and nothing else', () => {
    expect(fundingFormSchema.parse(submitted())).toEqual({
      application_id: null,
      name: 'Departmental fellowship',
      kind: 'university_scholarship',
      amount: null,
      currency: 'USD',
      deadline: null,
      application_required: false,
      status: 'researching',
      url: null,
      notes: null,
    });
    expect(errorsOf(submitted({ name: '' }))).toEqual({
      name: 'Enter a name, like "Departmental fellowship".',
    });
    expect(errorsOf(submitted({ name: '   ' }))).toEqual({
      name: 'Enter a name, like "Departmental fellowship".',
    });
  });

  it('tidies what was typed', () => {
    const result = fundingFormSchema.parse(
      submitted({
        name: '  Knight-Hennessy   Scholars ',
        amount: ' 20,000.50 ',
        url: 'stanford.edu/kh',
        notes: 'Essay due first\r\nInterview in January',
        application_required: 'on',
      }),
    );
    expect(result).toMatchObject({
      name: 'Knight-Hennessy Scholars',
      amount: 20_000.5,
      url: 'https://stanford.edu/kh',
      notes: 'Essay due first\nInterview in January',
      application_required: true,
    });
  });

  it('leaves the program empty for funding that is tied to none, and keeps one that is chosen', () => {
    expect(fundingFormSchema.parse(submitted({ application_id: '' })).application_id).toBeNull();
    expect(fundingFormSchema.parse(submitted({ application_id: ' app-1 ' })).application_id).toBe(
      'app-1',
    );
    // A form that leaves the program out altogether (a fixed one is sent as a hidden field).
    const withoutProgram = without(submitted(), 'application_id');
    expect(fundingFormSchema.parse(withoutProgram).application_id).toBeNull();
  });

  it('refuses a type or status that does not exist', () => {
    expect(errorsOf(submitted({ kind: 'lottery' })).kind).toBe('Choose a type.');
    expect(errorsOf(submitted({ status: 'won' })).status).toBe('Choose a status.');
  });

  it.each(['abc', '-5', '1.234', '1,00', '1,000,001', '$500'])(
    'refuses %j as an amount',
    (amount) => {
      expect(errorsOf(submitted({ amount })).amount).toBe(
        'Enter an amount between 0 and 1,000,000, like 90 or 90.50.',
      );
    },
  );

  it.each([
    ['', null],
    ['0', 0],
    ['500', 500],
    ['1,200.5', 1200.5],
    ['1000000', 1_000_000],
  ])('reads %j as the amount %j', (amount, expected) => {
    expect(fundingFormSchema.parse(submitted({ amount })).amount).toBe(expected);
  });

  it('needs a currency code, and defaults to dollars when the form leaves it out', () => {
    expect(errorsOf(submitted({ currency: 'us' })).currency).toBe('Choose a currency.');
    expect(errorsOf(submitted({ currency: 'usd' })).currency).toBe('Choose a currency.');
    expect(fundingFormSchema.parse(submitted({ currency: 'GBP' })).currency).toBe('GBP');
    const withoutCurrency = without(submitted(), 'currency');
    expect(fundingFormSchema.parse(withoutCurrency).currency).toBe('USD');
  });

  it('reads the deadline as a real calendar date', () => {
    expect(fundingFormSchema.parse(submitted({ deadline: '2026-12-01' })).deadline).toBe(
      '2026-12-01',
    );
    expect(errorsOf(submitted({ deadline: '2026-02-30' })).deadline).toBe(
      'Enter a valid deadline.',
    );
    expect(errorsOf(submitted({ deadline: '0026-12-01' })).deadline).toBe(
      'Enter a date between 2000 and 2100.',
    );
  });

  it('refuses a link that is not a web address', () => {
    expect(errorsOf(submitted({ url: 'javascript:alert(1)' })).url).toBe(
      'Enter a web address, like https://example.edu.',
    );
    expect(errorsOf(submitted({ url: 'two words' })).url).toBe(
      'Enter a web address, like https://example.edu.',
    );
  });

  it('limits the length of the name and the notes', () => {
    expect(errorsOf(submitted({ name: 'x'.repeat(201) })).name).toBe(
      'Name must be 200 characters or fewer.',
    );
    expect(errorsOf(submitted({ name: 'x'.repeat(200) })).name).toBeUndefined();
    expect(errorsOf(submitted({ notes: 'x'.repeat(10_001) })).notes).toBe(
      'Notes must be 10000 characters or fewer.',
    );
  });

  it('reports every problem at once', () => {
    expect(
      Object.keys(errorsOf(submitted({ name: '', amount: 'x', deadline: 'x', url: 'x y' }))).sort(),
    ).toEqual(['amount', 'deadline', 'name', 'url']);
  });
});

describe('form values', () => {
  it('starts a new item as an untouched scholarship being researched', () => {
    expect(emptyFundingValues()).toEqual({
      application_id: '',
      name: '',
      kind: 'university_scholarship',
      amount: '',
      currency: 'USD',
      deadline: '',
      application_required: false,
      status: 'researching',
      url: '',
      notes: '',
    });
  });

  it('starts an item for a program, in its currency', () => {
    expect(emptyFundingValues('app-1', 'CAD')).toMatchObject({
      application_id: 'app-1',
      currency: 'CAD',
    });
  });

  it('shows a saved item as text, and reads back as the same item', () => {
    const row = fakeFunding({
      application_id: 'app-1',
      name: 'Knight-Hennessy',
      kind: 'fellowship',
      amount: 12_345.5,
      currency: 'EUR',
      deadline: '2026-10-08',
      application_required: true,
      status: 'applied',
      url: 'https://example.edu/kh',
      notes: 'Ask about housing',
    });
    const values = fundingValuesFromRow(row);
    expect(values).toEqual({
      application_id: 'app-1',
      name: 'Knight-Hennessy',
      kind: 'fellowship',
      amount: '12345.5',
      currency: 'EUR',
      deadline: '2026-10-08',
      application_required: true,
      status: 'applied',
      url: 'https://example.edu/kh',
      notes: 'Ask about housing',
    });
    expect(
      fundingFormSchema.parse({
        ...values,
        application_required: values.application_required ? 'on' : undefined,
      }),
    ).toEqual({
      application_id: row.application_id,
      name: row.name,
      kind: row.kind,
      amount: row.amount,
      currency: row.currency,
      deadline: row.deadline,
      application_required: row.application_required,
      status: row.status,
      url: row.url,
      notes: row.notes,
    });
  });

  it('shows empty fields of a saved item as empty text', () => {
    expect(fundingValuesFromRow(fakeFunding())).toMatchObject({
      application_id: '',
      amount: '',
      deadline: '',
      url: '',
      notes: '',
    });
  });
});
