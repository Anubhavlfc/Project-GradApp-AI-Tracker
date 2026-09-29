import { ArrowUp } from 'lucide-react';
import {
  Badge,
  ProgressBar,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
} from '@/components/ui';
import { StatusBadge } from '@/features/applications/StatusBadge';
import { Container } from './Container';
import { previewPrograms, type PreviewProgram } from './previewData';

const percent = ({ done, total }: PreviewProgram) => Math.round((done / total) * 100);

function Completion({ program, className }: { program: PreviewProgram; className?: string }) {
  return (
    <ProgressBar
      className={className}
      value={program.done}
      max={program.total}
      label={`${program.university} requirements completed`}
    />
  );
}

/** From `md` up: a table in the style of the applications page. */
function PreviewTable() {
  return (
    <div className="hidden md:block">
      <Table>
        <TableHead>
          <tr>
            <TableHeaderCell>University and program</TableHeaderCell>
            <TableHeaderCell>
              <span className="inline-flex items-center gap-1">
                Deadline
                <ArrowUp aria-hidden="true" className="size-3.5" />
              </span>
            </TableHeaderCell>
            <TableHeaderCell>Status</TableHeaderCell>
            <TableHeaderCell>Requirements</TableHeaderCell>
          </tr>
        </TableHead>
        <TableBody>
          {previewPrograms.map((program) => (
            <TableRow key={program.university}>
              <TableCell>
                <div className="font-medium">{program.university}</div>
                <div className="text-fg-muted">{program.program}</div>
              </TableCell>
              <TableCell className="whitespace-nowrap tabular-nums">{program.deadline}</TableCell>
              <TableCell>
                <StatusBadge status={program.status} />
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-2.5">
                  <Completion program={program} className="w-24" />
                  <span className="w-9 shrink-0 text-right text-xs tabular-nums text-fg-muted">
                    {percent(program)}%
                  </span>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

/** Below `md`: one block per program, so nothing needs to scroll sideways. */
function PreviewList() {
  return (
    <ul role="list" className="divide-y divide-border md:hidden">
      {previewPrograms.map((program) => (
        <li key={program.university} className="px-4 py-3.5">
          <p className="font-medium">{program.university}</p>
          <p className="text-fg-muted">{program.program}</p>
          <div className="mt-2.5 flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5">
            <StatusBadge status={program.status} />
            <span className="text-xs tabular-nums text-fg-muted">Due {program.deadline}</span>
          </div>
          <div className="mt-3 flex items-baseline justify-between text-xs text-fg-muted">
            <span>Requirements</span>
            <span className="tabular-nums">{percent(program)}%</span>
          </div>
          <Completion program={program} className="mt-1.5" />
        </li>
      ))}
    </ul>
  );
}

/**
 * What the applications list looks like, drawn with the app's own components. It is a picture,
 * not a working screen: hidden from assistive technology (a short description stands in for it),
 * unclickable, and captioned as example data.
 */
export function ProductPreview() {
  return (
    <Container className="mt-14 sm:mt-20">
      <figure aria-labelledby="preview-caption">
        <p className="sr-only">
          A preview of the applications list: five sample programs, each with its deadline, its
          status, and how many of its requirements are complete.
        </p>
        <div
          aria-hidden="true"
          className="pointer-events-none overflow-hidden rounded-xl border border-border bg-surface shadow-sm"
        >
          <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
            <p className="text-sm font-semibold">Applications</p>
            <Badge>Sample data</Badge>
          </div>
          <PreviewTable />
          <PreviewList />
        </div>
        <figcaption id="preview-caption" className="mt-4 text-center text-sm text-fg-muted">
          Example with sample programs. Not real applications.
        </figcaption>
      </figure>
    </Container>
  );
}
