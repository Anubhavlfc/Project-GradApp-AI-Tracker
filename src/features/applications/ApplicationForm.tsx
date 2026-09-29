import { useId, useMemo, useState, type ChangeEvent, type ReactNode } from 'react';
import {
  Alert,
  Button,
  ButtonLink,
  Card,
  CardBody,
  CardHeader,
  Checkbox,
  Field,
  Input,
  Select,
  Textarea,
} from '@/components/ui';
import { useFormSubmit } from '@/lib/forms';
import { universityKey } from './api';
import { applicationFormSchema, emptyFormValues, formValuesFromRecord } from './form';
import type { SaveOutcome } from './hooks';
import {
  COMMON_COUNTRIES,
  CURRENCIES,
  DEGREE_LEVELS,
  DEGREE_TYPE_SUGGESTIONS,
  FEE_WAIVER_STATUSES,
  PRIORITIES,
} from './labels';
import { APPLICATION_STATUSES, wasSubmitted } from './status';
import type { ApplicationInput, ApplicationRecord, UniversityRow } from './types';

type FormSectionProps = {
  title: string;
  description?: string;
  /** Hidden sections keep their values, so switching status back and forth loses nothing. */
  hidden?: boolean;
  children: ReactNode;
};

function FormSection({ title, description, hidden, children }: FormSectionProps) {
  return (
    <section hidden={hidden}>
      <Card>
        <CardHeader title={title} description={description} />
        <CardBody className="grid gap-4 sm:grid-cols-2">{children}</CardBody>
      </Card>
    </section>
  );
}

// Form fields that only appear once an application has been sent.
const AFTER_SUBMISSION_FIELDS = [
  'submitted_on',
  'interview_at',
  'decision_received_on',
  'decision_deadline',
  'enrollment_deposit',
];

type ApplicationFormProps = {
  /** The program being edited; leave out to add a new one. */
  record?: ApplicationRecord;
  /** Universities already in the list, offered as suggestions and used to fill in details. */
  universities: readonly UniversityRow[];
  /** Countries already in use, offered as suggestions. */
  countries: readonly string[];
  save: (input: ApplicationInput) => Promise<SaveOutcome>;
  onSaved: (record: ApplicationRecord) => void;
  cancelTo: string;
};

export function ApplicationForm({
  record,
  universities,
  countries,
  save,
  onSaved,
  cancelTo,
}: ApplicationFormProps) {
  const initial = record ? formValuesFromRecord(record) : emptyFormValues();
  const [status, setStatus] = useState(initial.status);
  const [waiverAvailable, setWaiverAvailable] = useState(initial.fee_waiver_available);
  const form = useFormSubmit(applicationFormSchema, save, (_input, result) =>
    onSaved(result.record),
  );

  const universityListId = useId();
  const countryListId = useId();
  const degreeListId = useId();
  const countrySuggestions = useMemo(
    () => [...new Set([...countries, ...COMMON_COUNTRIES])].sort((a, b) => a.localeCompare(b)),
    [countries],
  );
  const currencies = CURRENCIES.includes(initial.fee_currency as (typeof CURRENCIES)[number])
    ? CURRENCIES
    : [initial.fee_currency, ...CURRENCIES];

  // Typing (or picking) a university you already track fills in its city, country and website,
  // so the same school is never entered twice with slightly different details.
  function fillKnownUniversity(event: ChangeEvent<HTMLInputElement>) {
    const key = universityKey(event.target.value);
    const known = universities.find((university) => universityKey(university.name) === key);
    const formElement = event.target.form;
    if (!known || !formElement) return;
    const fill = (name: string, value: string | null) => {
      const control = formElement.elements.namedItem(name);
      if (control instanceof HTMLInputElement && control.value === '' && value) {
        control.value = value;
      }
    };
    fill('university_city', known.city);
    fill('university_region', known.region);
    fill('university_country', known.country);
    fill('university_website_url', known.website_url);
  }

  const errors = form.errors;
  const showAfterSubmission =
    wasSubmitted(status) || AFTER_SUBMISSION_FIELDS.some((field) => errors[field]);

  return (
    <form {...form.props} className="space-y-6">
      {form.formError ? (
        <Alert kind="danger" title="Failed to save application">
          {form.formError}
        </Alert>
      ) : Object.keys(errors).length > 0 ? (
        <Alert kind="danger" title="Some fields need attention.">
          Fix the highlighted fields and save again.
        </Alert>
      ) : null}

      <FormSection
        title="University"
        description="These details are shared by every program at this university."
      >
        <Field
          label="University name"
          required
          error={errors.university_name}
          className="sm:col-span-2"
        >
          {(control) => (
            <Input
              name="university_name"
              list={universityListId}
              autoComplete="off"
              defaultValue={initial.university_name}
              onChange={fillKnownUniversity}
              {...control}
            />
          )}
        </Field>
        <datalist id={universityListId}>
          {universities.map((university) => (
            <option key={university.id} value={university.name} />
          ))}
        </datalist>
        <Field label="City" error={errors.university_city}>
          {(control) => (
            <Input name="university_city" defaultValue={initial.university_city} {...control} />
          )}
        </Field>
        <Field label="State or region" error={errors.university_region}>
          {(control) => (
            <Input name="university_region" defaultValue={initial.university_region} {...control} />
          )}
        </Field>
        <Field label="Country" error={errors.university_country}>
          {(control) => (
            <Input
              name="university_country"
              list={countryListId}
              autoComplete="off"
              defaultValue={initial.university_country}
              {...control}
            />
          )}
        </Field>
        <datalist id={countryListId}>
          {countrySuggestions.map((country) => (
            <option key={country} value={country} />
          ))}
        </datalist>
        <Field label="University website" error={errors.university_website_url}>
          {(control) => (
            <Input
              name="university_website_url"
              type="url"
              inputMode="url"
              placeholder="https://"
              defaultValue={initial.university_website_url}
              {...control}
            />
          )}
        </Field>
      </FormSection>

      <FormSection title="Program">
        <Field
          label="Program name"
          required
          error={errors.program_name}
          hint="For example, Computer Science."
          className="sm:col-span-2"
        >
          {(control) => (
            <Input name="program_name" defaultValue={initial.program_name} {...control} />
          )}
        </Field>
        <Field label="Degree level" required error={errors.degree_level}>
          {(control) => (
            <Select name="degree_level" defaultValue={initial.degree_level} {...control}>
              {DEGREE_LEVELS.map((level) => (
                <option key={level.value} value={level.value}>
                  {level.label}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Degree" error={errors.degree_type} hint="For example, MS, MA or PhD.">
          {(control) => (
            <Input
              name="degree_type"
              list={degreeListId}
              autoComplete="off"
              defaultValue={initial.degree_type}
              {...control}
            />
          )}
        </Field>
        <datalist id={degreeListId}>
          {DEGREE_TYPE_SUGGESTIONS.map((degree) => (
            <option key={degree} value={degree} />
          ))}
        </datalist>
        <Field label="Department" error={errors.department}>
          {(control) => <Input name="department" defaultValue={initial.department} {...control} />}
        </Field>
        <Field label="School or college" error={errors.school_college}>
          {(control) => (
            <Input name="school_college" defaultValue={initial.school_college} {...control} />
          )}
        </Field>
        <Field label="Program website" error={errors.program_url}>
          {(control) => (
            <Input
              name="program_url"
              type="url"
              inputMode="url"
              placeholder="https://"
              defaultValue={initial.program_url}
              {...control}
            />
          )}
        </Field>
        <Field
          label="Length in months"
          error={errors.program_length_months}
          hint="For example, 24 for a two-year program."
        >
          {(control) => (
            <Input
              name="program_length_months"
              inputMode="numeric"
              defaultValue={initial.program_length_months}
              {...control}
            />
          )}
        </Field>
        <Checkbox
          name="is_stem"
          label="STEM-designated program"
          defaultChecked={initial.is_stem}
          className="sm:col-span-2"
        />
      </FormSection>

      <FormSection title="Application">
        <Field label="Status" required error={errors.status}>
          {(control) => (
            <Select
              name="status"
              value={status}
              onChange={(event) => setStatus(event.target.value)}
              {...control}
            >
              {APPLICATION_STATUSES.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Priority" error={errors.priority}>
          {(control) => (
            <Select name="priority" defaultValue={initial.priority} {...control}>
              <option value="">Not set</option>
              {PRIORITIES.map((priority) => (
                <option key={priority.value} value={priority.value}>
                  {priority.label}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Deadline" error={errors.deadline}>
          {(control) => (
            <Input name="deadline" type="date" defaultValue={initial.deadline} {...control} />
          )}
        </Field>
        <Field
          label="Priority deadline"
          error={errors.priority_deadline}
          hint="An earlier date, for example for funding consideration."
        >
          {(control) => (
            <Input
              name="priority_deadline"
              type="date"
              defaultValue={initial.priority_deadline}
              {...control}
            />
          )}
        </Field>
        <Field label="Application portal" error={errors.portal_url} className="sm:col-span-2">
          {(control) => (
            <Input
              name="portal_url"
              type="url"
              inputMode="url"
              placeholder="https://"
              defaultValue={initial.portal_url}
              {...control}
            />
          )}
        </Field>
      </FormSection>

      <FormSection title="Application fee">
        <Field label="Fee" error={errors.application_fee}>
          {(control) => (
            <Input
              name="application_fee"
              inputMode="decimal"
              placeholder="For example, 90"
              defaultValue={initial.application_fee}
              {...control}
            />
          )}
        </Field>
        <Field label="Currency" error={errors.fee_currency}>
          {(control) => (
            <Select name="fee_currency" defaultValue={initial.fee_currency} {...control}>
              {currencies.map((currency) => (
                <option key={currency} value={currency}>
                  {currency}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Fee paid on" error={errors.fee_paid_on}>
          {(control) => (
            <Input name="fee_paid_on" type="date" defaultValue={initial.fee_paid_on} {...control} />
          )}
        </Field>
        <div className="sm:col-span-2">
          <Checkbox
            name="fee_waiver_available"
            label="A fee waiver is available"
            checked={waiverAvailable}
            onChange={(event) => setWaiverAvailable(event.target.checked)}
          />
        </div>
        {/* Kept in the form (only hidden) so unticking and re-ticking loses nothing. */}
        <div hidden={!waiverAvailable}>
          <Field label="Waiver status" error={errors.fee_waiver_status}>
            {(control) => (
              <Select
                name="fee_waiver_status"
                defaultValue={initial.fee_waiver_status}
                {...control}
              >
                {FEE_WAIVER_STATUSES.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        </div>
      </FormSection>

      <FormSection
        title="After you apply"
        description="Submission, interview and decision details."
        hidden={!showAfterSubmission}
      >
        <Field label="Submitted on" error={errors.submitted_on}>
          {(control) => (
            <Input
              name="submitted_on"
              type="date"
              defaultValue={initial.submitted_on}
              {...control}
            />
          )}
        </Field>
        <Field label="Interview" error={errors.interview_at}>
          {(control) => (
            <Input
              name="interview_at"
              type="datetime-local"
              defaultValue={initial.interview_at}
              {...control}
            />
          )}
        </Field>
        <Field label="Decision received on" error={errors.decision_received_on}>
          {(control) => (
            <Input
              name="decision_received_on"
              type="date"
              defaultValue={initial.decision_received_on}
              {...control}
            />
          )}
        </Field>
        <Field
          label="Reply by"
          error={errors.decision_deadline}
          hint="The date you must accept or decline an offer."
        >
          {(control) => (
            <Input
              name="decision_deadline"
              type="date"
              defaultValue={initial.decision_deadline}
              {...control}
            />
          )}
        </Field>
        <Field label="Enrollment deposit" error={errors.enrollment_deposit}>
          {(control) => (
            <Input
              name="enrollment_deposit"
              inputMode="decimal"
              defaultValue={initial.enrollment_deposit}
              {...control}
            />
          )}
        </Field>
        <div className="self-end pb-2">
          <Checkbox
            name="is_final_choice"
            label="This is my final choice"
            defaultChecked={initial.is_final_choice}
          />
        </div>
      </FormSection>

      <FormSection title="Notes">
        <Field label="Notes" error={errors.notes} className="sm:col-span-2">
          {(control) => (
            <Textarea name="notes" rows={5} defaultValue={initial.notes} {...control} />
          )}
        </Field>
      </FormSection>

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <ButtonLink to={cancelTo}>Cancel</ButtonLink>
        <Button type="submit" variant="primary" loading={form.submitting}>
          {form.submitting ? 'Saving…' : record ? 'Save changes' : 'Add program'}
        </Button>
      </div>
    </form>
  );
}
