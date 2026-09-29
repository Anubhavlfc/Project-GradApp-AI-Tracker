import { Badge } from '@/components/ui';
import { getStatusMeta, type ApplicationStatus } from './status';

export function StatusBadge({
  status,
  className,
}: {
  status: ApplicationStatus;
  className?: string;
}) {
  const { label, tone } = getStatusMeta(status);
  return (
    <Badge tone={tone} dot className={className}>
      {label}
    </Badge>
  );
}
