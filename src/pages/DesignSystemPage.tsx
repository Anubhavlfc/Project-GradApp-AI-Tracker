import { useMemo, useState, type ReactNode } from 'react';
import { Ellipsis, FolderOpen, Trash2 } from 'lucide-react';
import {
  Alert,
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  Checkbox,
  EmptyState,
  Field,
  IconButton,
  Input,
  Menu,
  MenuItem,
  Modal,
  PageHeader,
  ProgressBar,
  Select,
  Skeleton,
  SkeletonRegion,
  SkeletonText,
  Stat,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableHeaderCell,
  TableRow,
  Textarea,
  type Tone,
} from '@/components/ui';
import { APPLICATION_STATUSES, type ApplicationStatus } from '@/features/applications/status';
import { StatusBadge } from '@/features/applications/StatusBadge';

// Development-only gallery. The rows below are sample data, not real applications.
type SampleRow = {
  university: string;
  program: string;
  deadline: string;
  status: ApplicationStatus;
  done: number;
  total: number;
};

const sampleRows: SampleRow[] = [
  {
    university: 'Stanford University',
    program: 'MS Computer Science',
    deadline: '2026-12-02',
    status: 'documents_in_progress',
    done: 8,
    total: 11,
  },
  {
    university: 'Carnegie Mellon University',
    program: 'MS Computational Finance',
    deadline: '2026-12-10',
    status: 'application_started',
    done: 4,
    total: 12,
  },
  {
    university: 'University of Washington',
    program: 'MS Data Science',
    deadline: '2027-01-15',
    status: 'shortlisted',
    done: 1,
    total: 10,
  },
  {
    university: 'Columbia University',
    program: 'MS Applied Analytics',
    deadline: '2027-01-05',
    status: 'submitted',
    done: 11,
    total: 11,
  },
  {
    university: 'UC Berkeley',
    program: 'Master of Analytics',
    deadline: '2026-12-15',
    status: 'researching',
    done: 0,
    total: 9,
  },
];

const swatches: { name: string; className: string }[] = [
  { name: 'bg', className: 'bg-bg' },
  { name: 'surface', className: 'bg-surface' },
  { name: 'surface-muted', className: 'bg-surface-muted' },
  { name: 'border-strong', className: 'bg-border-strong' },
  { name: 'fg', className: 'bg-fg' },
  { name: 'fg-muted', className: 'bg-fg-muted' },
  { name: 'accent', className: 'bg-accent' },
  { name: 'accent-soft', className: 'bg-accent-soft' },
  { name: 'danger', className: 'bg-danger' },
];

const tones: Tone[] = [
  'neutral',
  'blue',
  'indigo',
  'teal',
  'violet',
  'amber',
  'orange',
  'green',
  'red',
];

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-4">
      <h2 className="border-b border-border pb-2 text-base font-semibold tracking-tight">
        {title}
      </h2>
      {children}
    </section>
  );
}

export default function DesignSystemPage() {
  const [sortKey, setSortKey] = useState<'university' | 'deadline'>('deadline');
  const [descending, setDescending] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const rows = useMemo(() => {
    const sorted = [...sampleRows].sort((a, b) => a[sortKey].localeCompare(b[sortKey]));
    return descending ? sorted.reverse() : sorted;
  }, [sortKey, descending]);

  const sortBy = (key: 'university' | 'deadline') => {
    if (key === sortKey) setDescending((value) => !value);
    else {
      setSortKey(key);
      setDescending(false);
    }
  };
  const direction = (key: 'university' | 'deadline') =>
    key === sortKey ? (descending ? 'desc' : 'asc') : null;

  return (
    <div className="space-y-10">
      <PageHeader
        title="Design system"
        description="Development-only gallery of the shared components. Sample data only."
      />

      <Section title="Typography">
        <div className="space-y-1">
          <p className="text-3xl font-semibold tracking-tight">Page title 3xl</p>
          <p className="text-xl font-semibold tracking-tight">Section title xl</p>
          <p className="text-base font-semibold">Card title base</p>
          <p>Body text at 14px. Strong typography, calm and readable. 1,234 · $125.00 · Dec 2</p>
          <p className="text-fg-muted">Muted text for supporting details.</p>
          <p className="text-xs text-fg-subtle">Caption and metadata, 12px.</p>
        </div>
      </Section>

      <Section title="Color tokens">
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {swatches.map(({ name, className }) => (
            <li key={name} className="flex items-center gap-2">
              <span className={`size-8 shrink-0 rounded-md border border-border ${className}`} />
              <span className="text-xs text-fg-muted">{name}</span>
            </li>
          ))}
        </ul>
      </Section>

      <Section title="Buttons">
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="primary">Add program</Button>
          <Button>Secondary</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="danger">Delete</Button>
          <Button size="sm">Small</Button>
          <Button variant="primary" disabled>
            Disabled
          </Button>
          <Button
            variant="primary"
            loading={saving}
            onClick={() => {
              setSaving(true);
              window.setTimeout(() => setSaving(false), 1500);
            }}
          >
            {saving ? 'Saving…' : 'Save (loading demo)'}
          </Button>
          <IconButton label="Delete application">
            <Trash2 aria-hidden="true" className="size-4" />
          </IconButton>
        </div>
      </Section>

      <Section title="Forms">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="University name" required hint="As it appears on the application portal.">
            {(control) => <Input placeholder="Stanford University" {...control} />}
          </Field>
          <Field label="Application deadline" error="Enter a valid date.">
            {(control) => <Input type="date" defaultValue="" {...control} />}
          </Field>
          <Field label="Degree type">
            {(control) => (
              <Select defaultValue="ms" {...control}>
                <option value="ms">Master&rsquo;s</option>
                <option value="phd">PhD</option>
              </Select>
            )}
          </Field>
          <Field label="Application fee">
            {(control) => <Input inputMode="decimal" placeholder="125" disabled {...control} />}
          </Field>
          <Field label="Notes" className="sm:col-span-2">
            {(control) => <Textarea placeholder="Anything worth remembering" {...control} />}
          </Field>
          <Checkbox
            label="Fee waiver available"
            description="Check if the program offers a waiver."
          />
        </div>
      </Section>

      <Section title="Status badges">
        <div className="flex flex-wrap gap-2">
          {APPLICATION_STATUSES.map(({ value }) => (
            <StatusBadge key={value} status={value} />
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          {tones.map((tone) => (
            <Badge key={tone} tone={tone}>
              {tone}
            </Badge>
          ))}
        </div>
      </Section>

      <Section title="Cards and stats">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat label="Total programs" value={7} />
          <Stat label="In progress" value={3} />
          <Stat label="Submitted" value={2} />
          <Stat label="Remaining fees" value="$465" hint="of $945 planned" />
        </div>
        <Card>
          <CardHeader
            title="Stanford MS Computer Science"
            description="Requirements completed"
            action={<Button size="sm">Open</Button>}
          />
          <CardBody className="space-y-2">
            <div className="flex items-baseline justify-between tabular-nums">
              <span>8 / 11</span>
              <span className="font-medium">73%</span>
            </div>
            <ProgressBar
              value={8}
              max={11}
              label="Stanford MS Computer Science requirements completed"
            />
          </CardBody>
        </Card>
      </Section>

      <Section title="Table">
        <TableContainer label="Sample applications">
          <Table>
            <TableHead>
              <tr>
                <TableHeaderCell
                  sortDirection={direction('university')}
                  onSort={() => sortBy('university')}
                >
                  University
                </TableHeaderCell>
                <TableHeaderCell>Program</TableHeaderCell>
                <TableHeaderCell
                  sortDirection={direction('deadline')}
                  onSort={() => sortBy('deadline')}
                >
                  Deadline
                </TableHeaderCell>
                <TableHeaderCell>Status</TableHeaderCell>
                <TableHeaderCell className="min-w-36">Completion</TableHeaderCell>
                <TableHeaderCell>
                  <span className="sr-only">Actions</span>
                </TableHeaderCell>
              </tr>
            </TableHead>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.university}>
                  <TableCell className="font-medium">{row.university}</TableCell>
                  <TableCell className="text-fg-muted">{row.program}</TableCell>
                  <TableCell className="whitespace-nowrap tabular-nums">{row.deadline}</TableCell>
                  <TableCell>
                    <StatusBadge status={row.status} />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <ProgressBar
                        className="w-20"
                        value={row.done}
                        max={row.total}
                        label={`${row.university} requirements completed`}
                      />
                      <span className="text-xs tabular-nums text-fg-muted">
                        {row.done}/{row.total}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="w-12 text-right">
                    <Menu
                      label={`Actions for ${row.university}`}
                      trigger={(props) => (
                        <IconButton label={`Actions for ${row.university}`} {...props}>
                          <Ellipsis aria-hidden="true" className="size-4" />
                        </IconButton>
                      )}
                    >
                      <MenuItem>Edit</MenuItem>
                      <MenuItem>Mark as submitted</MenuItem>
                      <MenuItem destructive icon={<Trash2 aria-hidden="true" className="size-4" />}>
                        Delete
                      </MenuItem>
                    </Menu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Section>

      <Section title="Modal, alerts, loading and empty states">
        <div className="space-y-3">
          <Button onClick={() => setModalOpen(true)}>Open modal</Button>
          <Alert kind="info" title="Deadlines are shown in your local time." />
          <Alert kind="success" title="Application saved." />
          <Alert kind="warning" title="Recommendation deadline in 3 days.">
            Professor Smith has not confirmed yet.
          </Alert>
          <Alert
            kind="danger"
            title="Failed to save application."
            action={<Button size="sm">Retry</Button>}
          >
            Check your connection and try again.
          </Alert>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardBody>
              <SkeletonRegion label="Loading applications">
                <div className="space-y-4">
                  <Skeleton className="h-5 w-40" />
                  <SkeletonText lines={3} />
                  <Skeleton className="h-8 w-24" />
                </div>
              </SkeletonRegion>
            </CardBody>
          </Card>
          <EmptyState
            icon={FolderOpen}
            title="No applications yet."
            description="Add your first graduate program to start tracking deadlines, documents, and requirements."
            action={<Button variant="primary">Add program</Button>}
          />
        </div>
      </Section>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Delete application?"
        description="This removes the application, its requirements, and its funding."
        footer={
          <>
            <Button onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button variant="danger" onClick={() => setModalOpen(false)}>
              Delete
            </Button>
          </>
        }
      >
        <p>This cannot be undone.</p>
      </Modal>
    </div>
  );
}
