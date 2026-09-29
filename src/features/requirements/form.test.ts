import { fakeRequirement } from '@/test/fakeRequirementsApi';
import {
  emptyRequirementValues,
  requirementFormSchema,
  requirementValuesFromRow,
  type RequirementFormValues,
} from './form';

// What a browser sends for the form: unticked checkboxes are simply absent.
function submitted(overrides: Record<string, string | boolean> = {}) {
  const values: Record<string, string> = {};
  for (const [key, value] of Object.entries({ ...emptyRequirementValues(), ...overrides })) {
    if (value === true) values[key] = 'on';
    else if (value !== false) values[key] = value;
  }
  return values;
}

function errorsFor(overrides: Record<string, string | boolean>) {
  const result = requirementFormSchema.safeParse(submitted(overrides));
  if (result.success) return {};
  return Object.fromEntries(
    result.error.issues.map((issue) => [String(issue.path[0]), issue.message]),
  );
}

describe('requirementFormSchema', () => {
  it('accepts an untouched form: a required, not-started item of the first kind', () => {
    expect(requirementFormSchema.parse(submitted())).toEqual({
      kind: 'resume_cv',
      label: null,
      is_required: true,
      status: 'not_started',
      due_date: null,
      notes: null,
    });
  });

  it('turns a filled-in form into typed values', () => {
    const result = requirementFormSchema.parse(
      submitted({
        kind: 'supplemental_essay',
        label: '  Why   Stanford  ',
        status: 'in_progress',
        is_required: false,
        due_date: '2026-12-01',
        notes: 'Draft 2\r\nAsk Prof. Chen to read it',
      }),
    );
    expect(result).toEqual({
      kind: 'supplemental_essay',
      label: 'Why Stanford',
      is_required: false,
      status: 'in_progress',
      due_date: '2026-12-01',
      notes: 'Draft 2\nAsk Prof. Chen to read it',
    });
  });

  it('treats a missing tick as "not required"', () => {
    const data = submitted();
    delete data.is_required;
    expect(requirementFormSchema.parse(data).is_required).toBe(false);
  });

  it('asks for a name when the type is "Other", and only then', () => {
    expect(errorsFor({ kind: 'other', label: '' })).toEqual({
      label: 'Give this requirement a name.',
    });
    expect(errorsFor({ kind: 'other', label: '   ' })).toEqual({
      label: 'Give this requirement a name.',
    });
    expect(errorsFor({ kind: 'other', label: 'Video introduction' })).toEqual({});
    expect(errorsFor({ kind: 'transcript', label: '' })).toEqual({});
  });

  it('reports the missing name together with other mistakes, not one round later', () => {
    expect(errorsFor({ kind: 'other', label: '', due_date: 'tomorrow' })).toEqual({
      label: 'Give this requirement a name.',
      due_date: 'Enter a valid due date.',
    });
  });

  it.each([
    ['kind', 'passport', 'Choose a type.'],
    ['status', 'done', 'Choose a status.'],
    ['due_date', '2026-02-30', 'Enter a valid due date.'],
    ['due_date', '12/15/2026', 'Enter a valid due date.'],
    ['due_date', '0026-12-15', 'Enter a date between 2000 and 2100.'],
  ])('rejects %s = %j with "%s"', (field, value, message) => {
    expect(errorsFor({ [field]: value })).toEqual({ [field]: message });
  });

  it('enforces the same length limits as the database', () => {
    expect(errorsFor({ label: 'x'.repeat(201) })).toEqual({
      label: 'Name must be 200 characters or fewer.',
    });
    expect(errorsFor({ label: 'x'.repeat(200) })).toEqual({});
    expect(errorsFor({ notes: 'x'.repeat(10_001) })).toEqual({
      notes: 'Notes must be 10000 characters or fewer.',
    });
  });
});

describe('requirementValuesFromRow', () => {
  it('shows everything an item holds, as text the form controls understand', () => {
    expect(
      requirementValuesFromRow(
        fakeRequirement({
          kind: 'recommendation_letter',
          label: 'Recommendation Letter 2',
          status: 'submitted',
          is_required: false,
          due_date: '2026-12-01',
          notes: 'Prof. Chen',
        }),
      ),
    ).toEqual({
      kind: 'recommendation_letter',
      label: 'Recommendation Letter 2',
      status: 'submitted',
      is_required: false,
      due_date: '2026-12-01',
      notes: 'Prof. Chen',
    });
    expect(requirementValuesFromRow(fakeRequirement())).toMatchObject({
      label: '',
      due_date: '',
      notes: '',
    });
  });

  it('round-trips: saving an item unchanged gives back the same data', () => {
    const row = fakeRequirement({
      kind: 'writing_sample',
      label: 'Sample 1',
      status: 'complete',
      is_required: false,
      due_date: '2026-11-15',
      notes: 'line one\nline two',
    });
    const formData: Record<string, string> = {};
    for (const [key, value] of Object.entries(
      requirementValuesFromRow(row) as RequirementFormValues,
    )) {
      if (value === true) formData[key] = 'on';
      else if (value !== false) formData[key] = value;
    }
    expect(requirementFormSchema.parse(formData)).toEqual({
      kind: row.kind,
      label: row.label,
      is_required: row.is_required,
      status: row.status,
      due_date: row.due_date,
      notes: row.notes,
    });
  });
});
