import {
  applicationFormSchema,
  emptyFormValues,
  formValuesFromRecord,
  type ApplicationFormValues,
} from './form';
import { fakeRecord } from '@/test/fakeApplicationsApi';

// What a browser sends for the untouched "add program" form, less the two required fields.
function submitted(overrides: Record<string, string | boolean> = {}) {
  const values: Record<string, string> = {};
  for (const [key, value] of Object.entries({ ...emptyFormValues(), ...overrides })) {
    // Unchecked checkboxes are simply absent from a submitted form.
    if (value === true) values[key] = 'on';
    else if (value !== false) values[key] = value;
  }
  return values;
}

const valid = { university_name: 'Stanford University', program_name: 'Computer Science' };

function errorsFor(overrides: Record<string, string | boolean>) {
  const result = applicationFormSchema.safeParse(submitted({ ...valid, ...overrides }));
  if (result.success) return {};
  return Object.fromEntries(
    result.error.issues.map((issue) => [String(issue.path[0]), issue.message]),
  );
}

describe('applicationFormSchema', () => {
  it('accepts the two required fields and fills in sensible defaults', () => {
    const result = applicationFormSchema.parse(submitted(valid));
    expect(result.university).toEqual({
      name: 'Stanford University',
      city: null,
      region: null,
      country: null,
      website_url: null,
    });
    expect(result.application).toMatchObject({
      program_name: 'Computer Science',
      degree_level: 'masters',
      status: 'researching',
      priority: null,
      deadline: null,
      application_fee: null,
      fee_currency: 'USD',
      fee_waiver_available: false,
      fee_waiver_status: 'not_requested',
      is_stem: false,
      is_final_choice: false,
      notes: null,
    });
  });

  it('turns a fully filled-in form into typed values', () => {
    const { university, application } = applicationFormSchema.parse(
      submitted({
        university_name: '  MIT  ',
        university_city: 'Cambridge',
        university_region: 'MA',
        university_country: 'United States',
        university_website_url: 'mit.edu',
        school_college: 'School of Engineering',
        department: 'EECS',
        program_name: 'Electrical Engineering and Computer Science',
        degree_level: 'phd',
        degree_type: 'PhD',
        program_url: 'https://www.eecs.mit.edu/',
        program_length_months: '60',
        is_stem: true,
        status: 'submitted',
        priority: 'dream',
        deadline: '2026-12-15',
        priority_deadline: '2026-12-01',
        portal_url: 'apply.mit.edu',
        application_fee: '1,075.50',
        fee_currency: 'USD',
        fee_waiver_available: true,
        fee_waiver_status: 'requested',
        fee_paid_on: '2026-11-20',
        submitted_on: '2026-11-21',
        interview_at: '2027-02-10T14:30',
        decision_received_on: '2027-03-15',
        decision_deadline: '2027-04-15',
        enrollment_deposit: '500',
        is_final_choice: true,
        notes: 'Talk to Prof. Chen.\r\nAsk about funding.',
      }),
    );
    expect(university).toEqual({
      name: 'MIT',
      city: 'Cambridge',
      region: 'MA',
      country: 'United States',
      website_url: 'https://mit.edu',
    });
    expect(application).toMatchObject({
      school_college: 'School of Engineering',
      department: 'EECS',
      degree_level: 'phd',
      degree_type: 'PhD',
      program_url: 'https://www.eecs.mit.edu/',
      program_length_months: 60,
      is_stem: true,
      status: 'submitted',
      priority: 'dream',
      deadline: '2026-12-15',
      priority_deadline: '2026-12-01',
      portal_url: 'https://apply.mit.edu',
      application_fee: 1075.5,
      fee_waiver_available: true,
      fee_waiver_status: 'requested',
      fee_paid_on: '2026-11-20',
      submitted_on: '2026-11-21',
      decision_received_on: '2027-03-15',
      decision_deadline: '2027-04-15',
      enrollment_deposit: 500,
      is_final_choice: true,
      notes: 'Talk to Prof. Chen.\nAsk about funding.',
    });
    // The interview is entered in local time and stored as a moment in time.
    expect(new Date(application.interview_at!).getTime()).toBe(
      new Date(2027, 1, 10, 14, 30).getTime(),
    );
  });

  it('says what is missing in plain words', () => {
    const result = applicationFormSchema.safeParse(submitted());
    expect(result.success).toBe(false);
    expect(errorsFor({ university_name: '   ', program_name: '' })).toEqual({
      university_name: 'Enter the university name.',
      program_name: 'Enter the program name.',
    });
  });

  it('does not let a waiver be "granted" if none is on offer', () => {
    const { application } = applicationFormSchema.parse(
      submitted({ ...valid, fee_waiver_available: false, fee_waiver_status: 'granted' }),
    );
    expect(application.fee_waiver_status).toBe('not_requested');
  });

  it('squeezes runs of spaces inside the university and program names', () => {
    const { university, application } = applicationFormSchema.parse(
      submitted({
        university_name: '  Stanford \u00a0 University ',
        program_name: 'Computer\t  Science',
      }),
    );
    expect(university.name).toBe('Stanford University');
    expect(application.program_name).toBe('Computer Science');
  });

  it('checks the priority deadline against the final deadline', () => {
    expect(errorsFor({ deadline: '2026-12-01', priority_deadline: '2026-12-15' })).toEqual({
      priority_deadline: 'The priority deadline must be on or before the final deadline.',
    });
    expect(errorsFor({ deadline: '2026-12-15', priority_deadline: '2026-12-15' })).toEqual({});
    expect(errorsFor({ deadline: '', priority_deadline: '2026-12-15' })).toEqual({});
  });

  it('reports the date order together with other mistakes, not one round later', () => {
    expect(
      errorsFor({
        portal_url: 'javascript:alert(1)',
        deadline: '2026-12-01',
        priority_deadline: '2026-12-15',
      }),
    ).toEqual({
      portal_url: 'Enter a web address, like https://example.edu.',
      priority_deadline: 'The priority deadline must be on or before the final deadline.',
    });
  });

  it('does not compare dates when one of them is unreadable', () => {
    expect(errorsFor({ deadline: 'tomorrow', priority_deadline: '2026-12-15' })).toEqual({
      deadline: 'Enter a valid deadline.',
    });
  });

  it.each([
    ['deadline', '2026-02-30', 'Enter a valid deadline.'],
    ['deadline', 'tomorrow', 'Enter a valid deadline.'],
    ['deadline', '0026-12-15', 'Enter a date between 2000 and 2100.'],
    ['deadline', '2126-12-15', 'Enter a date between 2000 and 2100.'],
    ['fee_paid_on', '12/15/2026', 'Enter a valid date.'],
    ['interview_at', 'later', 'Enter a valid date and time.'],
    ['application_fee', '$90', 'Enter an amount between 0 and 1,000,000, like 90 or 90.50.'],
    ['application_fee', '90,50', 'Enter an amount between 0 and 1,000,000, like 90 or 90.50.'],
    ['enrollment_deposit', '-1', 'Enter an amount between 0 and 1,000,000, like 90 or 90.50.'],
    ['program_length_months', '0', 'Enter a whole number of months, from 1 to 120.'],
    ['program_length_months', '18.5', 'Enter a whole number of months, from 1 to 120.'],
    ['program_length_months', '121', 'Enter a whole number of months, from 1 to 120.'],
    ['program_url', 'javascript:alert(1)', 'Enter a web address, like https://example.edu.'],
    ['portal_url', 'not a website', 'Enter a web address, like https://example.edu.'],
    [
      'university_website_url',
      'data:text/html,hi',
      'Enter a web address, like https://example.edu.',
    ],
    ['status', 'maybe', 'Choose a status.'],
    ['degree_level', 'bachelors', 'Choose a degree level.'],
    ['priority', 'whatever', 'Choose a priority.'],
    ['fee_currency', 'usd', 'Choose a currency.'],
  ])('rejects %s = %j with "%s"', (field, value, message) => {
    expect(errorsFor({ [field]: value })).toEqual({ [field]: message });
  });

  it('enforces the same length limits as the database', () => {
    expect(errorsFor({ program_name: 'x'.repeat(201) })).toEqual({
      program_name: 'Program name must be 200 characters or fewer.',
    });
    expect(errorsFor({ degree_type: 'x'.repeat(51) })).toEqual({
      degree_type: 'Degree must be 50 characters or fewer.',
    });
    expect(errorsFor({ notes: 'x'.repeat(10_001) })).toEqual({
      notes: 'Notes must be 10000 characters or fewer.',
    });
    expect(errorsFor({ notes: 'x'.repeat(10_000) })).toEqual({});
  });
});

describe('formValuesFromRecord', () => {
  it('shows everything a record holds, as text the form controls understand', () => {
    const values = formValuesFromRecord(
      fakeRecord({
        program_name: 'Data Science',
        application_fee: 90.5,
        program_length_months: 24,
        deadline: '2026-12-15',
        interview_at: null,
        priority: 'target',
        is_stem: true,
        university: { name: 'Columbia University', city: 'New York', country: 'United States' },
      }),
    );
    expect(values).toMatchObject({
      university_name: 'Columbia University',
      university_city: 'New York',
      university_region: '',
      university_country: 'United States',
      program_name: 'Data Science',
      application_fee: '90.5',
      program_length_months: '24',
      deadline: '2026-12-15',
      interview_at: '',
      priority: 'target',
      is_stem: true,
    });
  });

  it('round-trips: editing a record without changes gives back the same data', () => {
    const record = fakeRecord({
      application_fee: 1075.5,
      deadline: '2026-12-15',
      priority_deadline: '2026-12-01',
      interview_at: new Date(2027, 1, 10, 14, 30).toISOString(),
      fee_waiver_available: true,
      fee_waiver_status: 'granted',
      notes: 'line one\nline two',
      program_url: 'https://example.edu/program',
      university: { website_url: 'https://example.edu' },
    });
    const values = formValuesFromRecord(record);
    const formData: Record<string, string> = {};
    for (const [key, value] of Object.entries(values as ApplicationFormValues)) {
      if (value === true) formData[key] = 'on';
      else if (value !== false) formData[key] = value;
    }
    const { university, application } = applicationFormSchema.parse(formData);
    expect(university).toMatchObject({
      name: record.university.name,
      website_url: 'https://example.edu',
    });
    expect(application).toMatchObject({
      program_name: record.program_name,
      application_fee: 1075.5,
      deadline: '2026-12-15',
      priority_deadline: '2026-12-01',
      interview_at: record.interview_at,
      fee_waiver_available: true,
      fee_waiver_status: 'granted',
      notes: 'line one\nline two',
      program_url: 'https://example.edu/program',
    });
  });
});
