import { Alert, Button, Field, FormFooter, Input, Modal, Select, Textarea } from '@/components/ui';
import { useFormSubmit } from '@/lib/forms';
import { documentFormSchema, documentValuesFromRow, emptyDocumentValues } from './form';
import { documentErrorMessage, useSaveDocument } from './hooks';
import { DOCUMENT_KINDS, DOCUMENT_STATUSES } from './kinds';
import type { DocumentFields, DocumentRow } from './types';

/** What the dialog is for: a new document, or an existing one to edit. */
export type DocumentTarget = { kind: 'new' } | { kind: 'edit'; item: DocumentRow };

type DocumentDialogProps = {
  /** Open while this is set. */
  target: DocumentTarget | null;
  onClose: () => void;
  /** Called after a save, with a sentence for the page to announce. */
  onSaved: (message: string) => void;
};

type FormProps = Omit<DocumentDialogProps, 'target'> & { target: DocumentTarget };

function DocumentForm({ target, onClose, onSaved }: FormProps) {
  const editing = target.kind === 'edit' ? target.item : null;
  const initial = editing ? documentValuesFromRow(editing) : emptyDocumentValues();
  const save = useSaveDocument();

  async function submit(fields: DocumentFields) {
    try {
      await save.mutateAsync({ id: editing?.id, fields });
      return { ok: true as const };
    } catch (error) {
      return { ok: false as const, message: documentErrorMessage(error) };
    }
  }

  const form = useFormSubmit(documentFormSchema, submit, (fields) => {
    onSaved(`${editing ? 'Saved' : 'Added'} ${fields.name}.`);
    onClose();
  });

  return (
    <form {...form.props} className="space-y-4">
      {form.formError ? (
        <Alert kind="danger" title="Failed to save document">
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
        <Field label="Type" required error={form.errors.kind}>
          {(control) => (
            <Select {...control} name="kind" defaultValue={initial.kind}>
              {DOCUMENT_KINDS.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Status" error={form.errors.status}>
          {(control) => (
            <Select {...control} name="status" defaultValue={initial.status}>
              {DOCUMENT_STATUSES.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </Select>
          )}
        </Field>
      </div>

      <Field
        label="Link"
        error={form.errors.url}
        hint="Where the file lives, like a Google Drive or Dropbox link. Files are never uploaded here."
      >
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
          {editing ? 'Save changes' : 'Add document'}
        </Button>
      </FormFooter>
    </form>
  );
}

/** Add a document, or edit one. */
export function DocumentDialog({ target, ...rest }: DocumentDialogProps) {
  const editing = target?.kind === 'edit';
  return (
    <Modal
      open={target !== null}
      onClose={rest.onClose}
      title={editing ? 'Edit document' : 'Add document'}
      description={
        editing
          ? target.item.name
          : 'Something you send with your applications: a resume, a statement, a transcript, a score report.'
      }
    >
      {/* Mounted only while open, so every opening starts from a clean form. */}
      {target !== null ? <DocumentForm target={target} {...rest} /> : null}
    </Modal>
  );
}
