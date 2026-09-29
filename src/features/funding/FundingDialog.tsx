import { useState } from 'react';
import {
  Alert,
  Button,
  Checkbox,
  Field,
  FixedField,
  FormFooter,
  Input,
  Modal,
  Select,
  Textarea,
} from '@/components/ui';
import { useApplicationsQuery } from '@/features/applications/hooks';
import { applicationName, CURRENCIES } from '@/features/applications/labels';
import { useFormSubmit } from '@/lib/forms';
import { emptyFundingValues, fundingFormSchema, fundingValuesFromRow } from './form';
import { fundingErrorMessage, useSaveFunding } from './hooks';
import { FUNDING_KINDS, FUNDING_STATUSES } from './kinds';
import type { FundingFields, FundingRow } from './types';

/**
 * What the dialog is for: a new item (for one program when opened from its page, otherwise for
 * whichever program is chosen, or none), or an existing item to edit.
 */
export type FundingTarget =
  { kind: 'new'; applicationId?: string } | { kind: 'edit'; item: FundingRow };

type FundingDialogProps = {
  /** Open while this is set. */
  target: FundingTarget | null;
  onClose: () => void;
  /** Called after a save, with a sentence for the page to announce. */
  onSaved: (message: string) => void;
};

type FormProps = Omit<FundingDialogProps, 'target'> & { target: FundingTarget };

function FundingForm({ target, onClose, onSaved }: FormProps) {
  const editing = target.kind === 'edit' ? target.item : null;
  const fixedApplication = target.kind === 'new' ? target.applicationId : undefined;
  const applications = useApplicationsQuery().data ?? [];
  const save = useSaveFunding();

  // Money is usually in the currency of the program's country, which the fee already tells us.
  // The currency follows the program until you pick one yourself.
  const currencyOf = (applicationId: string) =>
    applications.find((application) => application.id === applicationId)?.fee_currency ?? 'USD';
  const initial = editing
    ? fundingValuesFromRow(editing)
    : emptyFundingValues(fixedApplication ?? '', currencyOf(fixedApplication ?? ''));

  const [applicationChoice, setApplicationChoice] = useState(initial.application_id);
  const [currency, setCurrency] = useState(initial.currency);
  const [currencyTouched, setCurrencyTouched] = useState(false);

  function changeApplication(next: string) {
    setApplicationChoice(next);
    if (!currencyTouched && !editing) setCurrency(currencyOf(next));
  }

  const application = applications.find((item) => item.id === applicationChoice);
  const sortedApplications = [...applications].sort((a, b) =>
    applicationName(a).localeCompare(applicationName(b)),
  );

  async function submit(fields: FundingFields) {
    try {
      await save.mutateAsync({ id: editing?.id, fields });
      return { ok: true as const };
    } catch (error) {
      return { ok: false as const, message: fundingErrorMessage(error) };
    }
  }

  const form = useFormSubmit(fundingFormSchema, submit, (fields) => {
    onSaved(`${editing ? 'Saved' : 'Added'} ${fields.name}.`);
    onClose();
  });

  return (
    <form {...form.props} className="space-y-4">
      {form.formError ? (
        <Alert kind="danger" title="Failed to save funding">
          {form.formError}
        </Alert>
      ) : null}

      <Field label="Name" required error={form.errors.name}>
        {(control) => (
          <Input
            {...control}
            name="name"
            defaultValue={initial.name}
            autoComplete="off"
            data-autofocus
          />
        )}
      </Field>

      <Field label="Type" required error={form.errors.kind}>
        {(control) => (
          <Select {...control} name="kind" defaultValue={initial.kind}>
            {FUNDING_KINDS.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </Select>
        )}
      </Field>

      {fixedApplication ? (
        <FixedField
          label="Program"
          name="application_id"
          value={fixedApplication}
          text={application ? applicationName(application) : 'Unknown program'}
        />
      ) : (
        <Field
          label="Program"
          error={form.errors.application_id}
          hint="Leave this empty for funding that isn't tied to one program, like an outside scholarship."
        >
          {(control) => (
            <Select
              {...control}
              name="application_id"
              value={applicationChoice}
              onChange={(event) => changeApplication(event.target.value)}
            >
              <option value="">Not tied to a program</option>
              {sortedApplications.map((item) => (
                <option key={item.id} value={item.id}>
                  {applicationName(item)}
                </option>
              ))}
            </Select>
          )}
        </Field>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Amount" error={form.errors.amount} hint="Leave empty if you don't know yet.">
          {(control) => (
            <Input
              {...control}
              name="amount"
              inputMode="decimal"
              defaultValue={initial.amount}
              autoComplete="off"
            />
          )}
        </Field>
        <Field label="Currency" error={form.errors.currency}>
          {(control) => (
            <Select
              {...control}
              name="currency"
              value={currency}
              onChange={(event) => {
                setCurrency(event.target.value);
                setCurrencyTouched(true);
              }}
            >
              {/* A saved currency that is not in the usual list must stay selectable. */}
              {[...new Set([...CURRENCIES, currency])].map((code) => (
                <option key={code} value={code}>
                  {code}
                </option>
              ))}
            </Select>
          )}
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Status" error={form.errors.status}>
          {(control) => (
            <Select {...control} name="status" defaultValue={initial.status}>
              {FUNDING_STATUSES.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Deadline" error={form.errors.deadline} hint="The date to apply by.">
          {(control) => (
            <Input {...control} name="deadline" type="date" defaultValue={initial.deadline} />
          )}
        </Field>
      </div>

      <Checkbox
        name="application_required"
        label="Application required"
        description="Turn this on when you have to apply for it separately from the program."
        defaultChecked={initial.application_required}
      />

      <Field label="Link" error={form.errors.url} hint="Where to read about it or apply.">
        {(control) => (
          <Input
            {...control}
            name="url"
            inputMode="url"
            defaultValue={initial.url}
            autoComplete="off"
          />
        )}
      </Field>

      <Field label="Notes" error={form.errors.notes}>
        {(control) => <Textarea {...control} name="notes" rows={3} defaultValue={initial.notes} />}
      </Field>

      <FormFooter>
        <Button onClick={onClose}>Cancel</Button>
        <Button type="submit" variant="primary" loading={form.submitting}>
          {editing ? 'Save changes' : 'Add funding'}
        </Button>
      </FormFooter>
    </form>
  );
}

/** Add a funding item, or edit one. */
export function FundingDialog({ target, ...rest }: FundingDialogProps) {
  const editing = target?.kind === 'edit';
  return (
    <Modal
      open={target !== null}
      onClose={rest.onClose}
      title={editing ? 'Edit funding' : 'Add funding'}
      description={
        editing
          ? target.item.name
          : 'A scholarship, fellowship, assistantship or waiver you are pursuing or have been offered.'
      }
    >
      {/* Mounted only while open, so every opening starts from a clean form. */}
      {target !== null ? <FundingForm target={target} {...rest} /> : null}
    </Modal>
  );
}
