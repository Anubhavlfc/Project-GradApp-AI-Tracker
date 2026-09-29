import { useState } from 'react';
import { Link } from 'react-router';
import { Alert, Button, Field, FormFooter, Input, Modal, Select, Textarea } from '@/components/ui';
import { useApplicationsQuery } from '@/features/applications/hooks';
import { applicationName } from '@/features/applications/labels';
import { useFormSubmit } from '@/lib/forms';
import {
  emptyRequestValues,
  NEW_RECOMMENDER,
  requestFormSchema,
  requestValuesFromRow,
  type RequestFormData,
} from './form';
import {
  requestErrorMessage,
  useRecommendationData,
  useSaveRecommender,
  useSaveRequest,
} from './hooks';
import { recommenderSubtitle } from './logic';
import { RECOMMENDATION_STATUSES } from './statuses';
import type { RequestRow } from './types';

/**
 * What the dialog is for: a new request (optionally with the recommender or the program already
 * decided, when it is opened from their page), or an existing request to edit.
 */
export type RequestTarget =
  | { kind: 'new'; recommenderId?: string; applicationId?: string }
  | { kind: 'edit'; request: RequestRow };

type RequestDialogProps = {
  /** Open while this is set. */
  target: RequestTarget | null;
  onClose: () => void;
  /** Called after a save, with a sentence for the page to announce. */
  onSaved: (message: string) => void;
};

type FormProps = Omit<RequestDialogProps, 'target'> & { target: RequestTarget };

/** A value that is decided already: shown as text, and still sent with the form. */
function Fixed({
  label,
  name,
  value,
  text,
}: {
  label: string;
  name: string;
  value: string;
  text: string;
}) {
  return (
    <div className="space-y-1.5">
      <p className="font-medium">{label}</p>
      <p className="break-words">{text}</p>
      <input type="hidden" name={name} value={value} />
    </div>
  );
}

function RequestForm({ target, onClose, onSaved }: FormProps) {
  const editing = target.kind === 'edit' ? target.request : null;
  const { recommenders = [], requests = [] } = useRecommendationData();
  const applications = useApplicationsQuery().data ?? [];
  const saveRecommender = useSaveRecommender();
  const saveRequest = useSaveRequest();
  const initial = editing ? requestValuesFromRow(editing) : emptyRequestValues();

  const fixedRecommender = editing
    ? editing.recommender_id
    : target.kind === 'new'
      ? target.recommenderId
      : undefined;
  const fixedApplication = editing
    ? editing.application_id
    : target.kind === 'new'
      ? target.applicationId
      : undefined;

  const [recommenderChoice, setRecommenderChoice] = useState(
    fixedRecommender ?? (recommenders.length === 0 ? NEW_RECOMMENDER : ''),
  );
  const [applicationChoice, setApplicationChoice] = useState(fixedApplication ?? '');
  // The letter is usually due with the application, so the deadline starts as the program's, until
  // you type your own.
  const deadlineOf = (applicationId: string) =>
    applications.find((application) => application.id === applicationId)?.deadline ?? '';
  const [deadline, setDeadline] = useState(
    editing ? initial.deadline : deadlineOf(fixedApplication ?? ''),
  );
  const [deadlineTouched, setDeadlineTouched] = useState(false);

  function changeApplication(next: string) {
    setApplicationChoice(next);
    if (!deadlineTouched) setDeadline(deadlineOf(next));
  }

  const recommender = recommenders.find((person) => person.id === recommenderChoice);
  const application = applications.find((item) => item.id === applicationChoice);
  // One letter per person and program: whoever is already asked about the chosen program, and the
  // programs the chosen person is already asked about, are greyed out.
  const askedAbout = new Set(
    requests
      .filter((request) => request.application_id === applicationChoice)
      .map((request) => request.recommender_id),
  );
  const askedOf = new Set(
    requests
      .filter((request) => request.recommender_id === recommenderChoice)
      .map((request) => request.application_id),
  );

  async function submit(data: RequestFormData) {
    try {
      if (editing) {
        await saveRequest.mutateAsync({ id: editing.id, fields: data.fields });
        return { ok: true as const };
      }

      let recommenderId: string;
      let created: string | null = null;
      if (data.writer.kind === 'new') {
        const person = await saveRecommender.mutateAsync({ fields: data.writer.fields });
        recommenderId = person.id;
        created = person.name;
      } else {
        // A second request for the same person and program is refused by the database, and
        // requestErrorMessage says so.
        recommenderId = data.writer.recommenderId;
      }

      try {
        await saveRequest.mutateAsync({
          request: {
            ...data.fields,
            recommender_id: recommenderId,
            application_id: data.applicationId,
          },
        });
      } catch (error) {
        if (created !== null) {
          // The person was saved, so a second try must use them rather than add them again.
          setRecommenderChoice(recommenderId);
          return {
            ok: false as const,
            message: `Saved ${created}, but couldn't add the request. ${requestErrorMessage(error)}`,
          };
        }
        throw error;
      }
      return { ok: true as const };
    } catch (error) {
      return { ok: false as const, message: requestErrorMessage(error) };
    }
  }

  const form = useFormSubmit(requestFormSchema, submit, (data) => {
    const { writer } = data;
    const who =
      writer.kind === 'new'
        ? writer.fields.name
        : (recommenders.find((person) => person.id === writer.recommenderId)?.name ??
          'the recommender');
    const program = applications.find((item) => item.id === data.applicationId);
    onSaved(
      editing
        ? `Saved the request to ${who}.`
        : `Requested a letter from ${who}${program ? ` for ${applicationName(program)}` : ''}.`,
    );
    onClose();
  });

  const sortedApplications = [...applications].sort((a, b) =>
    applicationName(a).localeCompare(applicationName(b)),
  );

  return (
    <form {...form.props} className="space-y-4">
      {form.formError ? (
        <Alert kind="danger" title="Failed to save request">
          {form.formError}
        </Alert>
      ) : null}

      {applications.length === 0 && !editing ? (
        <Alert kind="info" title="Add a program first">
          A letter is for one program.{' '}
          <Link to="/app/applications/new" className="focus-ring rounded-sm text-accent underline">
            Add a program
          </Link>
          , then come back to request a letter.
        </Alert>
      ) : null}

      {fixedRecommender ? (
        <Fixed
          label="Recommender"
          name="recommender_id"
          value={fixedRecommender}
          text={recommenders.find((person) => person.id === fixedRecommender)?.name ?? 'Unknown'}
        />
      ) : (
        <Field
          label="Recommender"
          required
          error={form.errors.recommender_id}
          hint={
            askedAbout.size > 0 && applicationChoice
              ? 'People already asked for this program are greyed out.'
              : undefined
          }
        >
          {(control) => (
            <Select
              {...control}
              name="recommender_id"
              value={recommenderChoice}
              onChange={(event) => setRecommenderChoice(event.target.value)}
              data-autofocus
            >
              <option value="">Choose a recommender…</option>
              {recommenders.map((person) => {
                const subtitle = recommenderSubtitle(person);
                const asked = askedAbout.has(person.id);
                return (
                  <option key={person.id} value={person.id} disabled={asked}>
                    {subtitle ? `${person.name} (${subtitle})` : person.name}
                    {asked ? ' (already asked)' : ''}
                  </option>
                );
              })}
              <option value={NEW_RECOMMENDER}>New recommender…</option>
            </Select>
          )}
        </Field>
      )}

      {recommenderChoice === NEW_RECOMMENDER && !fixedRecommender ? (
        <fieldset className="rounded-md border border-border p-3">
          <legend className="px-1 text-xs font-medium text-fg-muted">New recommender</legend>
          <div className="space-y-4">
            <Field label="Name" required error={form.errors.new_name}>
              {(control) => <Input {...control} name="new_name" autoComplete="off" />}
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Title" error={form.errors.new_title}>
                {(control) => <Input {...control} name="new_title" autoComplete="off" />}
              </Field>
              <Field label="Institution" error={form.errors.new_institution}>
                {(control) => <Input {...control} name="new_institution" autoComplete="off" />}
              </Field>
            </div>
            <Field label="Email" error={form.errors.new_email}>
              {(control) => <Input {...control} name="new_email" type="email" autoComplete="off" />}
            </Field>
          </div>
        </fieldset>
      ) : null}

      {fixedApplication ? (
        <Fixed
          label="Program"
          name="application_id"
          value={fixedApplication}
          text={application ? applicationName(application) : 'Unknown program'}
        />
      ) : (
        <Field
          label="Program"
          required
          error={form.errors.application_id}
          hint={
            recommender && askedOf.size > 0
              ? `${recommender.name} is already asked about the programs that are greyed out.`
              : undefined
          }
        >
          {(control) => (
            <Select
              {...control}
              name="application_id"
              value={applicationChoice}
              onChange={(event) => changeApplication(event.target.value)}
              data-autofocus={fixedRecommender ? true : undefined}
            >
              <option value="">Choose a program…</option>
              {sortedApplications.map((item) => (
                <option key={item.id} value={item.id} disabled={askedOf.has(item.id)}>
                  {applicationName(item)}
                  {askedOf.has(item.id) ? ' (already asked)' : ''}
                </option>
              ))}
            </Select>
          )}
        </Field>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Status" error={form.errors.status}>
          {(control) => (
            <Select {...control} name="status" defaultValue={initial.status}>
              {RECOMMENDATION_STATUSES.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Date requested" error={form.errors.requested_on}>
          {(control) => (
            <Input
              {...control}
              name="requested_on"
              type="date"
              defaultValue={initial.requested_on}
            />
          )}
        </Field>
      </div>

      <Field
        label="Deadline"
        error={form.errors.deadline}
        hint={editing ? undefined : "Starts as the program's deadline."}
      >
        {(control) => (
          <Input
            {...control}
            name="deadline"
            type="date"
            value={deadline}
            onChange={(event) => {
              setDeadline(event.target.value);
              setDeadlineTouched(true);
            }}
          />
        )}
      </Field>

      <Field label="Notes" error={form.errors.notes}>
        {(control) => <Textarea {...control} name="notes" rows={3} defaultValue={initial.notes} />}
      </Field>

      <FormFooter>
        <Button onClick={onClose}>Cancel</Button>
        <Button
          type="submit"
          variant="primary"
          loading={form.submitting}
          disabled={applications.length === 0 && !editing}
        >
          {editing ? 'Save changes' : 'Add request'}
        </Button>
      </FormFooter>
    </form>
  );
}

/** Ask someone for a letter, or edit a request. */
export function RequestDialog({ target, ...rest }: RequestDialogProps) {
  const editing = target?.kind === 'edit';
  return (
    <Modal
      open={target !== null}
      onClose={rest.onClose}
      title={editing ? 'Edit letter request' : 'Request a letter'}
      description={
        editing
          ? 'Change when the letter was asked for, when it is due, or where it stands.'
          : 'Record who is writing a letter for which program.'
      }
    >
      {/* Mounted only while open, so every opening starts from a clean form. */}
      {target !== null ? <RequestForm target={target} {...rest} /> : null}
    </Modal>
  );
}
