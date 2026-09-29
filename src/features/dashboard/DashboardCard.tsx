import type { ReactNode } from 'react';
import {
  Alert,
  Button,
  Card,
  CardBody,
  CardHeader,
  Skeleton,
  SkeletonRegion,
} from '@/components/ui';
import { toDataError } from '@/lib/dataError';
import type { CardState } from './gather';

type DashboardCardProps = {
  title: string;
  description?: string;
  /** Shown beside the title once there is something to show, such as a link to the full page. */
  action?: ReactNode;
  state: CardState;
  /** What the card says when it cannot load, e.g. "Unable to load deadlines". */
  failedTitle: string;
  /** The card's content; only called once everything it needs has loaded. */
  children: () => ReactNode;
};

/** One panel of the dashboard: a title, and its content, a skeleton, or why it could not load. */
export function DashboardCard({
  title,
  description,
  action,
  state,
  failedTitle,
  children,
}: DashboardCardProps) {
  return (
    <Card>
      <CardHeader
        title={title}
        description={description}
        action={state.status === 'ready' ? action : undefined}
      />
      {state.status === 'loading' ? (
        <CardBody>
          <SkeletonRegion label={`Loading ${title.toLowerCase()}`}>
            <div className="space-y-3">
              <Skeleton className="h-5 w-2/3" />
              <Skeleton className="h-5 w-full" />
              <Skeleton className="h-5 w-4/5" />
            </div>
          </SkeletonRegion>
        </CardBody>
      ) : state.status === 'failed' ? (
        <CardBody>
          <Alert
            kind="danger"
            title={failedTitle}
            action={
              <Button size="sm" onClick={state.retry}>
                Try again
              </Button>
            }
          >
            {toDataError(state.error).message}
          </Alert>
        </CardBody>
      ) : (
        <>
          {state.warning ? (
            <div className="border-b border-border p-4">
              <Alert
                kind="warning"
                title={state.warning.title}
                action={
                  <Button size="sm" onClick={state.warning.retry}>
                    Try again
                  </Button>
                }
              >
                {state.warning.message}
              </Alert>
            </div>
          ) : null}
          {children()}
        </>
      )}
    </Card>
  );
}
