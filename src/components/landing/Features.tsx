import { CalendarClock, GraduationCap, HandCoins, ListChecks, type LucideIcon } from 'lucide-react';
import { Container } from './Container';
import { SectionHeading } from './SectionHeading';

type Feature = { icon: LucideIcon; title: string; body: string };

const features: readonly Feature[] = [
  {
    icon: GraduationCap,
    title: 'Track every program',
    body: 'Keep the university, program, degree, deadline, portal link and application fee for each program in one place. Move it through 12 statuses, from Researching to Accepted, Rejected or Withdrawn, and search, filter and sort your list.',
  },
  {
    icon: ListChecks,
    title: 'Requirements and documents',
    body: 'Give every program a checklist for essays, transcripts, test scores and letters, with a completion percentage. Keep a list of your documents with links to where they live, such as Google Drive or Dropbox.',
  },
  {
    icon: CalendarClock,
    title: 'Deadlines and tasks',
    body: 'One deadlines page brings together applications, scholarships, recommendation letters, tests and interviews, with counts like “due in 3 days”. Tie tasks to a program so the next step is written down.',
  },
  {
    icon: HandCoins,
    title: 'Letters, funding and costs',
    body: 'Note who is writing each recommendation letter and whether it has been submitted. Record scholarships, fellowships and assistantships with amounts, deadlines and status. See total application fees, what you have paid, what remains and any fee waivers.',
  },
];

export function Features() {
  return (
    <section aria-labelledby="features-heading" className="border-t border-border py-16 sm:py-24">
      <Container>
        <SectionHeading id="features-heading" title="One place for every part of your applications">
          Programs, requirements, deadlines, letters, funding and costs, kept together.
        </SectionHeading>
        <ul
          role="list"
          className="mt-10 grid gap-px overflow-hidden rounded-xl border border-border bg-border sm:mt-12 md:grid-cols-2"
        >
          {features.map(({ icon: Icon, title, body }) => (
            <li key={title} className="bg-surface p-5 sm:p-8">
              <span
                aria-hidden="true"
                className="grid size-10 place-items-center rounded-lg bg-accent-soft text-accent-soft-fg"
              >
                <Icon className="size-5" />
              </span>
              <h3 className="mt-5 text-lg font-semibold tracking-tight">{title}</h3>
              <p className="mt-2 text-base leading-relaxed text-fg-muted">{body}</p>
            </li>
          ))}
        </ul>
      </Container>
    </section>
  );
}
