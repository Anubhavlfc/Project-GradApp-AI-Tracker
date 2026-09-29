import { useState } from 'react';
import {
  Alert,
  Button,
  Field,
  FixedField,
  FormFooter,
  Input,
  Modal,
  Select,
  Textarea,
} from '@/components/ui';
import { useApplicationsQuery } from '@/features/applications/hooks';
import { applicationName } from '@/features/applications/labels';
import { useFormSubmit } from '@/lib/forms';
import { emptyTaskValues, taskFormSchema, taskValuesFromRow } from './form';
import { taskErrorMessage, useSaveTask } from './hooks';
import { TASK_PRIORITIES, TASK_STATUSES } from './kinds';
import type { TaskFields, TaskRow } from './types';

/**
 * What the dialog is for: a new task (for one program when opened from its page, starting on a
 * program when the list is filtered to one, otherwise for whichever program is chosen, or none),
 * or an existing task to edit.
 */
export type TaskTarget =
  | {
      kind: 'new';
      /** The program the task is for, decided: it cannot be changed. */
      applicationId?: string;
      /** The program the task starts on: it can be changed. */
      initialApplicationId?: string;
    }
  | { kind: 'edit'; item: TaskRow };

type TaskDialogProps = {
  /** Open while this is set. */
  target: TaskTarget | null;
  onClose: () => void;
  /** Called after a save, with a sentence for the page to announce. */
  onSaved: (message: string) => void;
};

type FormProps = Omit<TaskDialogProps, 'target'> & { target: TaskTarget };

function TaskForm({ target, onClose, onSaved }: FormProps) {
  const editing = target.kind === 'edit' ? target.item : null;
  const fixedApplication = target.kind === 'new' ? target.applicationId : undefined;
  const applications = useApplicationsQuery().data ?? [];
  const save = useSaveTask();

  const startsOn = target.kind === 'new' ? target.initialApplicationId : undefined;
  const initial = editing
    ? taskValuesFromRow(editing)
    : emptyTaskValues(fixedApplication ?? startsOn ?? '');

  const application = applications.find((item) => item.id === fixedApplication);
  const sortedApplications = [...applications].sort((a, b) =>
    applicationName(a).localeCompare(applicationName(b)),
  );

  async function submit(fields: TaskFields) {
    try {
      await save.mutateAsync({ id: editing?.id, fields });
      return { ok: true as const };
    } catch (error) {
      return { ok: false as const, message: taskErrorMessage(error) };
    }
  }

  const form = useFormSubmit(taskFormSchema, submit, (fields) => {
    onSaved(`${editing ? 'Saved' : 'Added'} ${fields.title}.`);
    onClose();
  });

  const [applicationChoice, setApplicationChoice] = useState(initial.application_id);

  return (
    <form {...form.props} className="space-y-4">
      {form.formError ? (
        <Alert kind="danger" title="Failed to save task">
          {form.formError}
        </Alert>
      ) : null}

      <Field label="Title" required error={form.errors.title}>
        {(control) => (
          <Input
            {...control}
            name="title"
            defaultValue={initial.title}
            autoComplete="off"
            data-autofocus
          />
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
          hint="Leave this empty for a task that isn't about one program, like renewing a passport."
        >
          {(control) => (
            <Select
              {...control}
              name="application_id"
              value={applicationChoice}
              onChange={(event) => setApplicationChoice(event.target.value)}
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
        <Field label="Due date" error={form.errors.due_date}>
          {(control) => (
            <Input {...control} name="due_date" type="date" defaultValue={initial.due_date} />
          )}
        </Field>
        <Field label="Priority" error={form.errors.priority}>
          {(control) => (
            <Select {...control} name="priority" defaultValue={initial.priority}>
              {TASK_PRIORITIES.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </Select>
          )}
        </Field>
      </div>

      <Field label="Status" error={form.errors.status}>
        {(control) => (
          <Select {...control} name="status" defaultValue={initial.status}>
            {TASK_STATUSES.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </Select>
        )}
      </Field>

      <Field label="Notes" error={form.errors.notes}>
        {(control) => <Textarea {...control} name="notes" rows={3} defaultValue={initial.notes} />}
      </Field>

      <FormFooter>
        <Button onClick={onClose}>Cancel</Button>
        <Button type="submit" variant="primary" loading={form.submitting}>
          {editing ? 'Save changes' : 'Add task'}
        </Button>
      </FormFooter>
    </form>
  );
}

/** Add a task, or edit one. */
export function TaskDialog({ target, ...rest }: TaskDialogProps) {
  const editing = target?.kind === 'edit';
  return (
    <Modal
      open={target !== null}
      onClose={rest.onClose}
      title={editing ? 'Edit task' : 'Add task'}
      description={
        editing
          ? target.item.title
          : 'Something to do for your applications: an email to send, a form to fill in, a test to book.'
      }
    >
      {/* Mounted only while open, so every opening starts from a clean form. */}
      {target !== null ? <TaskForm target={target} {...rest} /> : null}
    </Modal>
  );
}
