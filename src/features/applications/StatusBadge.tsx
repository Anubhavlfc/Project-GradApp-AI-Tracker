import { Badge } from '@/components/ui';
import { getStatusMeta, type ApplicationStatus } from './status';

export function StatusBadge({
  status,
  wrap,
  className,
}: {
  status: ApplicationStatus;
  wrap?: boolean;
  className?: string;
}) {
  const { label, tone } = getStatusMeta(status);
  return (
    <Badge tone={tone} dot wrap={wrap} className={className}>
      {label}
    </Badge>
  );
}
