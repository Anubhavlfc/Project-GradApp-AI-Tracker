import { useNavigate, useParams } from 'react-router';
import { Alert, Button, PageHeader, Skeleton, SkeletonRegion } from '@/components/ui';
import { ApplicationForm } from '@/features/applications/ApplicationForm';
import { toDataError } from '@/lib/dataError';
import {
  useApplication,
  useApplicationSaver,
  useApplicationsQuery,
} from '@/features/applications/hooks';
import { applicationName } from '@/features/applications/labels';
import { knownUniversities, usedCountries } from '@/features/applications/view';
import { ApplicationNotFound } from './ApplicationNotFound';

export function EditApplicationPage() {
  const { applicationId } = useParams();
  const navigate = useNavigate();
  const found = useApplication(applicationId);
  const all = useApplicationsQuery();
  const save = useApplicationSaver(applicationId);

  if (found.data === undefined) {
    return found.isError ? (
      <Alert
        kind="danger"
        title="Unable to load this program"
        action={
          <Button size="sm" onClick={() => void found.refetch()}>
            Try again
          </Button>
        }
      >
        {toDataError(found.error).message}
      </Alert>
    ) : (
      <SkeletonRegion label="Loading program">
        <Skeleton className="mb-6 h-8 w-64" />
        <Skeleton className="h-96 w-full" />
      </SkeletonRegion>
    );
  }
  const record = found.data;
  if (record === null) return <ApplicationNotFound />;

  const detailsPath = `/app/applications/${record.id}`;
  return (
    <>
      <PageHeader title="Edit program" description={applicationName(record)} />
      <ApplicationForm
        // A fresh form for each program, so one program's values never linger in another's.
        key={record.id}
        record={record}
        universities={knownUniversities(all.data ?? [])}
        countries={usedCountries(all.data ?? [])}
        save={save}
        onSaved={() => void navigate(detailsPath)}
        cancelTo={detailsPath}
      />
    </>
  );
}
