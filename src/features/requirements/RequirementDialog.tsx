import { useState } from 'react';
import {
  Alert,
  Button,
  Checkbox,
  Field,
  FormFooter,
  Input,
  Modal,
  Select,
  Textarea,
} from '@/components/ui';
import { useFormSubmit } from '@/lib/forms';
import { emptyRequirementValues, requirementFormSchema, requirementValuesFromRow } from './form';
import { requirementErrorMessage, useAddRequirements, useSaveRequirement } from './hooks';
import { REQUIREMENT_KINDS, REQUIREMENT_STATUSES } from './kinds';
import { nextLetterLabel, requirementTitle } from './progress';
import type { RequirementFields, RequirementRow } from './types';

/** What the dialog is for: `'new'` to add an item, an item to edit it. */
export type RequirementTarget = 'new' | RequirementRow;

type RequirementDialogProps = {
  /** Open while this is set. */
  target: RequirementTarget | null;
  applicationId: string;
  /** The program's items as they are now, used to suggest the next letter number. */
  items: readonly RequirementRow[];
  onClose: () => void;
  /** Called after a save, with a sentence for the page to announce. */
  onSaved: (message: string) => void;
};

type FormProps = Omit<RequirementDialogProps, 'target'> & { editing: RequirementRow | null };

function RequirementForm({ editing, applicationId, items, onClose, onSaved }: FormProps) {
  const add = useAddRequirements();
  const save = useSaveRequirement();
  const initial = editing ? requirementValuesFromRow(editing) : emptyRequirementValues();

  // Kind and name are watched: picking "Recommendation Letter" suggests "Recommendation Letter 2"
  // (until you type your own), and "Other" needs a name.
  const [kind, setKind] = useState(initial.kind);
  const [label, setLabel] = useState(initial.label);
  const suggestionFor = (value: string) =>
    !editing && value === 'recommendation_letter' ? nextLetterLabel(items) : '';
  function changeKind(next: string) {
    if (label === '' || label === suggestionFor(kind)) setLabel(suggestionFor(next));
    setKind(next);
  }

  async function submit(fields: RequirementFields) {
    try {
      if (editing) await save.mutateAsync({ id: editing.id, fields });
      else await add.mutateAsync({ applicationId, items: [fields] });
      return { ok: true as const };
    } catch (error) {
      return { ok: false as const, message: requirementErrorMessage(error) };
    }
  }

  const form = useFormSubmit(requirementFormSchema, submit, (fields) => {
    onSaved(`${editing ? 'Saved' : 'Added'} ${requirementTitle(fields)}.`);
    onClose();
  });

  return (
    <form {...form.props} className="space-y-4">
      {form.formError ? (
        <Alert kind="danger" title="Failed to save requirement">
          {form.formError}
        </Alert>
      ) : null}

      <Field label="Type" required error={form.errors.kind}>
        {(control) => (
          <Select
            {...control}
            name="kind"
            value={kind}
            onChange={(event) => changeKind(event.target.value)}
            data-autofocus
          >
            {REQUIREMENT_KINDS.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </Select>
        )}
      </Field>

      <Field
        label="Name"
        required={kind === 'other'}
        error={form.errors.label}
        hint={
          kind === 'other'
            ? 'What does the program ask for?'
            : 'Optional. Use it to tell items of the same type apart, like Recommendation Letter 2.'
        }
      >
        {(control) => (
          <Input
            {...control}
            name="label"
            value={label}
            onChange={(event) => setLabel(event.target.value)}
            autoComplete="off"
          />
        )}
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Status" error={form.errors.status}>
          {(control) => (
            <Select {...control} name="status" defaultValue={initial.status}>
              {REQUIREMENT_STATUSES.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Due date" error={form.errors.due_date}>
          {(control) => (
            <Input {...control} name="due_date" type="date" defaultValue={initial.due_date} />
          )}
        </Field>
      </div>

      <Checkbox
        name="is_required"
        label="Required"
        description="Turn this off for items the program only recommends. Optional items don't count towards your progress."
        defaultChecked={initial.is_required}
      />

      <Field label="Notes" error={form.errors.notes}>
        {(control) => <Textarea {...control} name="notes" rows={3} defaultValue={initial.notes} />}
      </Field>

      <FormFooter>
        <Button onClick={onClose}>Cancel</Button>
        <Button type="submit" variant="primary" loading={form.submitting}>
          {editing ? 'Save changes' : 'Add requirement'}
        </Button>
      </FormFooter>
    </form>
  );
}

/** Add one checklist item, or edit one. */
export function RequirementDialog({ target, ...rest }: RequirementDialogProps) {
  const editing = target !== null && target !== 'new' ? target : null;
  return (
    <Modal
      open={target !== null}
      onClose={rest.onClose}
      title={editing ? 'Edit requirement' : 'Add requirement'}
      description={
        editing ? requirementTitle(editing) : 'Something this program asks you to provide.'
      }
    >
      {/* Mounted only while open, so every opening starts from a clean form. */}
      {target !== null ? <RequirementForm editing={editing} {...rest} /> : null}
    </Modal>
  );
}
