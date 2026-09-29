import { FolderOpen } from 'lucide-react';
import { EmptyState, PageHeader } from '@/components/ui';

// Placeholder until real data is connected (Phases 5-10).
export function DashboardPage() {
  return (
    <>
      <PageHeader title="Dashboard" description="Your application overview will appear here." />
      <EmptyState
        icon={FolderOpen}
        title="No applications yet."
        description="Add your first graduate program to start tracking deadlines, documents, and requirements."
      />
    </>
  );
}
