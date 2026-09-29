import { Container } from './Container';
import { SectionHeading } from './SectionHeading';

const steps = [
  {
    title: 'Add a program',
    body: 'Enter the university, program, degree, deadline, portal link and application fee, then choose where it stands.',
  },
  {
    title: 'Track what it needs',
    body: 'Build a checklist of essays, transcripts, test scores and letters, and keep links to your documents.',
  },
  {
    title: 'Keep letters and funding in view',
    body: 'Record who is writing each recommendation letter, and track scholarships, fellowships and assistantships alongside.',
  },
  {
    title: 'Record the decision',
    body: 'When an answer arrives, set the status to Accepted, Waitlisted, Rejected or Withdrawn and keep the outcome with the program.',
  },
] as const;

export function HowItWorks() {
  return (
    <section aria-labelledby="how-heading" className="border-t border-border py-16 sm:py-24">
      <Container className="grid gap-10 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] lg:gap-16">
        <SectionHeading id="how-heading" title="How it works">
          From the first program on your list to the final decision.
        </SectionHeading>
        <ol role="list" className="max-w-2xl space-y-8">
          {steps.map((step, index) => (
            // The line runs down from this step's number to the next one.
            <li
              key={step.title}
              className="relative pl-12 before:absolute before:-bottom-6 before:left-4 before:top-10 before:w-px before:bg-border-strong last:before:hidden"
            >
              <span
                aria-hidden="true"
                className="absolute left-0 top-0 grid size-8 place-items-center rounded-full border border-border-strong bg-surface text-sm font-semibold tabular-nums"
              >
                {index + 1}
              </span>
              <h3 className="pt-1 text-base font-semibold tracking-tight">{step.title}</h3>
              <p className="mt-1.5 text-base text-fg-muted">{step.body}</p>
            </li>
          ))}
        </ol>
      </Container>
    </section>
  );
}
