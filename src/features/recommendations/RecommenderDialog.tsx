import { Alert, Button, Field, FormFooter, Input, Modal, Textarea } from '@/components/ui';
import { useFormSubmit } from '@/lib/forms';
import { emptyRecommenderValues, recommenderFormSchema, recommenderValuesFromRow } from './form';
import { recommenderErrorMessage, useSaveRecommender } from './hooks';
import type { RecommenderFields, RecommenderRow } from './types';

/** What the dialog is for: `'new'` to add a person, a person to edit them. */
export type RecommenderTarget = 'new' | RecommenderRow;

type RecommenderDialogProps = {
  /** Open while this is set. */
  target: RecommenderTarget | null;
  onClose: () => void;
  /** Called after a save, with a sentence for the page to announce. */
  onSaved: (message: string) => void;
};

type FormProps = Omit<RecommenderDialogProps, 'target'> & { editing: RecommenderRow | null };

function RecommenderForm({ editing, onClose, onSaved }: FormProps) {
  const save = useSaveRecommender();
  const initial = editing ? recommenderValuesFromRow(editing) : emptyRecommenderValues();

  async function submit(fields: RecommenderFields) {
    try {
      await save.mutateAsync({ id: editing?.id, fields });
      return { ok: true as const };
    } catch (error) {
      return { ok: false as const, message: recommenderErrorMessage(error) };
    }
  }

  const form = useFormSubmit(recommenderFormSchema, submit, (fields) => {
    onSaved(`${editing ? 'Saved' : 'Added'} ${fields.name}.`);
    onClose();
  });

  return (
    <form {...form.props} className="space-y-4">
      {form.formError ? (
        <Alert kind="danger" title="Failed to save recommender">
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

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Title" error={form.errors.title} hint="Like Associate Professor.">
          {(control) => (
            <Input {...control} name="title" defaultValue={initial.title} autoComplete="off" />
          )}
        </Field>
        <Field label="Institution" error={form.errors.institution}>
          {(control) => (
            <Input
              {...control}
              name="institution"
              defaultValue={initial.institution}
              autoComplete="off"
            />
          )}
        </Field>
      </div>

      <Field label="Email" error={form.errors.email}>
        {(control) => (
          <Input
            {...control}
            name="email"
            type="email"
            defaultValue={initial.email}
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
          {editing ? 'Save changes' : 'Add recommender'}
        </Button>
      </FormFooter>
    </form>
  );
}

/** Add a recommender, or edit one. */
export function RecommenderDialog({ target, ...rest }: RecommenderDialogProps) {
  const editing = target !== null && target !== 'new' ? target : null;
  return (
    <Modal
      open={target !== null}
      onClose={rest.onClose}
      title={editing ? 'Edit recommender' : 'Add recommender'}
      description={editing ? editing.name : 'Someone who will write a letter for you.'}
    >
      {/* Mounted only while open, so every opening starts from a clean form. */}
      {target !== null ? <RecommenderForm editing={editing} {...rest} /> : null}
    </Modal>
  );
}
