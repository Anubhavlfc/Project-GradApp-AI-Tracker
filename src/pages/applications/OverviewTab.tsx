import type { ReactNode } from 'react';
import {
  Card,
  CardBody,
  CardHeader,
  DescriptionItem,
  DescriptionList,
  SafeLink,
} from '@/components/ui';
import { toneText } from '@/components/ui/tone';
import { DeadlineText, FeeText, NotSet } from '@/features/applications/ApplicationCells';
import {
  describeOpenDeadline,
  formatDate,
  formatDateTime,
  toISODate,
} from '@/features/applications/dates';
import { degreeLevelLabel, feeWaiverLabel } from '@/features/applications/labels';
import { formatMoney } from '@/features/applications/money';
import { hasDecision } from '@/features/applications/status';
import { useApplicationRecord } from '@/features/applications/useApplicationRecord';
import { RequirementsOverviewCard } from '@/features/requirements/OverviewCard';
import { cn } from '@/lib/cn';
import { hostnameOf } from '@/lib/url';

function Link({ href, children }: { href: string; children?: ReactNode }) {
  return <SafeLink href={href}>{children ?? hostnameOf(href)}</SafeLink>;
}

const dateOf = (timestamp: string) => formatDate(toISODate(new Date(timestamp)));

export function OverviewTab() {
  const record = useApplicationRecord();
  const today = toISODate();
  const { university } = record;

  const place = [university.city, university.region, university.country].filter(Boolean).join(', ');
  const degree = [degreeLevelLabel(record.degree_level), record.degree_type]
    .filter(Boolean)
    .join(' · ');

  const feeIsRecorded =
    record.application_fee !== null || record.fee_waiver_available || record.fee_paid_on;
  const decisionIsRecorded =
    hasDecision(record.status) ||
    record.decision_received_on ||
    record.decision_deadline ||
    record.enrollment_deposit !== null ||
    record.is_final_choice;
  // "In 5 days" for the reply-by date, until you have made your final choice.
  const replyBy =
    record.decision_deadline && !record.is_final_choice
      ? describeOpenDeadline(record.decision_deadline, today)
      : null;

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Deadlines" />
          <CardBody>
            <DescriptionList>
              <DescriptionItem label="Deadline">
                <DeadlineText record={record} today={today} />
              </DescriptionItem>
              {record.priority_deadline ? (
                <DescriptionItem label="Priority deadline">
                  {formatDate(record.priority_deadline)}
                </DescriptionItem>
              ) : null}
              {record.submitted_on ? (
                <DescriptionItem label="Submitted on">
                  {formatDate(record.submitted_on)}
                </DescriptionItem>
              ) : null}
              {record.interview_at ? (
                <DescriptionItem label="Interview">
                  {formatDateTime(record.interview_at)}
                </DescriptionItem>
              ) : null}
              {record.portal_url ? (
                <DescriptionItem label="Application portal">
                  <Link href={record.portal_url} />
                </DescriptionItem>
              ) : null}
            </DescriptionList>
          </CardBody>
        </Card>

        <RequirementsOverviewCard record={record} />

        <Card>
          <CardHeader title="Program" />
          <CardBody>
            <DescriptionList>
              <DescriptionItem label="University">
                <div>{university.name}</div>
                {place ? <div className="text-fg-muted">{place}</div> : null}
              </DescriptionItem>
              {university.website_url ? (
                <DescriptionItem label="University website">
                  <Link href={university.website_url} />
                </DescriptionItem>
              ) : null}
              <DescriptionItem label="Degree">{degree}</DescriptionItem>
              {record.department ? (
                <DescriptionItem label="Department">{record.department}</DescriptionItem>
              ) : null}
              {record.school_college ? (
                <DescriptionItem label="School or college">{record.school_college}</DescriptionItem>
              ) : null}
              {record.program_length_months ? (
                <DescriptionItem label="Length">
                  {record.program_length_months} months
                </DescriptionItem>
              ) : null}
              {record.is_stem ? <DescriptionItem label="STEM">Designated</DescriptionItem> : null}
              {record.program_url ? (
                <DescriptionItem label="Program website">
                  <Link href={record.program_url} />
                </DescriptionItem>
              ) : null}
            </DescriptionList>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Application fee" />
          <CardBody>
            {feeIsRecorded ? (
              <DescriptionList>
                <DescriptionItem label="Fee">
                  <FeeText record={record} />
                </DescriptionItem>
                {record.fee_waiver_available ? (
                  <DescriptionItem label="Fee waiver">
                    {feeWaiverLabel(record.fee_waiver_status)}
                  </DescriptionItem>
                ) : null}
                <DescriptionItem label="Paid on">
                  {record.fee_paid_on ? formatDate(record.fee_paid_on) : <NotSet />}
                </DescriptionItem>
              </DescriptionList>
            ) : (
              <p className="text-fg-muted">No fee recorded.</p>
            )}
          </CardBody>
        </Card>

        {decisionIsRecorded ? (
          <Card>
            <CardHeader title="Decision" />
            <CardBody>
              <DescriptionList>
                <DescriptionItem label="Decision received">
                  {record.decision_received_on ? (
                    formatDate(record.decision_received_on)
                  ) : (
                    <NotSet />
                  )}
                </DescriptionItem>
                {record.decision_deadline ? (
                  <DescriptionItem label="Reply by">
                    <div className="tabular-nums">{formatDate(record.decision_deadline)}</div>
                    {replyBy?.text ? (
                      <div className={cn('text-xs font-medium', toneText[replyBy.tone])}>
                        {replyBy.text}
                      </div>
                    ) : null}
                  </DescriptionItem>
                ) : null}
                {record.enrollment_deposit !== null ? (
                  <DescriptionItem label="Enrollment deposit">
                    {formatMoney(record.enrollment_deposit, record.fee_currency)}
                  </DescriptionItem>
                ) : null}
                {record.is_final_choice ? (
                  <DescriptionItem label="Final choice">Yes, this is my choice</DescriptionItem>
                ) : null}
              </DescriptionList>
            </CardBody>
          </Card>
        ) : null}
      </div>

      {record.notes ? (
        <Card>
          <CardHeader title="Notes" />
          <CardBody>
            <p className="whitespace-pre-wrap break-words">{record.notes}</p>
          </CardBody>
        </Card>
      ) : null}

      <p className="text-xs text-fg-subtle">
        Added {dateOf(record.created_at)}. Last updated {dateOf(record.updated_at)}.
      </p>
    </div>
  );
}
