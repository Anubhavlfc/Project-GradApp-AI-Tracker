import { FolderSearch } from 'lucide-react';
import { ButtonLink, EmptyState } from '@/components/ui';

export function ApplicationNotFound() {
  return (
    <EmptyState
      as="h1"
      icon={FolderSearch}
      title="We couldn't find that program."
      description="It may have been deleted, or the link may be wrong."
      action={<ButtonLink to="/app/applications">Back to applications</ButtonLink>}
    />
  );
}
