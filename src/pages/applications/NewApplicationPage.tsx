import { useNavigate } from 'react-router';
import { PageHeader } from '@/components/ui';
import { ApplicationForm } from '@/features/applications/ApplicationForm';
import { useApplicationSaver, useApplicationsQuery } from '@/features/applications/hooks';
import { knownUniversities, usedCountries } from '@/features/applications/view';

export function NewApplicationPage() {
  const navigate = useNavigate();
  const save = useApplicationSaver();
  // Suggestions are a convenience: the form works the same while (or if) the list is unavailable.
  const { data: records = [] } = useApplicationsQuery();

  return (
    <>
      <PageHeader
        title="Add program"
        description="Start with the essentials. You can fill in the rest as you learn more."
      />
      <ApplicationForm
        universities={knownUniversities(records)}
        countries={usedCountries(records)}
        save={save}
        onSaved={(record) => void navigate(`/app/applications/${record.id}`)}
        cancelTo="/app/applications"
      />
    </>
  );
}
