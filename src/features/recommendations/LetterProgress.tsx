import { CircleCheck } from 'lucide-react';
import { ProgressBar } from '@/components/ui';
import type { LetterSummary } from './logic';

type LetterProgressProps = {
  summary: LetterSummary;
  /** Whose letters these are, for screen readers: "Stanford University, MS Computer Science". */
  name: string;
};

/** The headline for a program's letters: how many have reached the school, and what is left. */
export function LetterProgress({ summary, name }: LetterProgressProps) {
  const { total, submitted, needsFollowUp } = summary;
  if (total === 0) return <p className="text-fg-muted">No letters requested yet.</p>;
  return (
    <div>
      <p>
        <span className="text-2xl font-semibold tabular-nums tracking-tight">
          {submitted} of {total}
        </span>{' '}
        <span className="text-fg-muted">{total === 1 ? 'letter' : 'letters'} submitted</span>
      </p>
      <ProgressBar
        className="mt-2"
        value={submitted}
        max={total}
        label={`Recommendation letters submitted for ${name}`}
      />
      {submitted === total ? (
        <p className="mt-2 flex items-center gap-1.5 text-xs font-medium text-tone-green-fg">
          <CircleCheck aria-hidden="true" className="size-3.5" />
          Every letter is submitted.
        </p>
      ) : needsFollowUp > 0 ? (
        <p className="mt-2 text-xs font-medium text-tone-amber-fg">{needsFollowUp} to follow up</p>
      ) : null}
    </div>
  );
}
