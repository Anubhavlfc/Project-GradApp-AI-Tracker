import type { ApplicationStatus } from '@/features/applications/status';

// Made-up programs for the product preview. Deadlines are plain text on purpose: they must not
// change with today's date, and no year keeps the example from looking out of date.
export type PreviewProgram = {
  university: string;
  program: string;
  deadline: string;
  status: ApplicationStatus;
  /** Requirements ticked off, out of `total`. */
  done: number;
  total: number;
};

export const previewPrograms: readonly PreviewProgram[] = [
  {
    university: 'Stanford University',
    program: 'MS Computer Science',
    deadline: 'Dec 2',
    status: 'documents_in_progress',
    done: 8,
    total: 11,
  },
  {
    university: 'Carnegie Mellon University',
    program: 'MS Computational Finance',
    deadline: 'Dec 10',
    status: 'application_started',
    done: 4,
    total: 12,
  },
  {
    university: 'UC Berkeley',
    program: 'Master of Analytics',
    deadline: 'Dec 15',
    status: 'researching',
    done: 0,
    total: 9,
  },
  {
    university: 'Columbia University',
    program: 'MS Applied Analytics',
    deadline: 'Jan 5',
    status: 'submitted',
    done: 11,
    total: 11,
  },
  {
    university: 'University of Washington',
    program: 'MS Data Science',
    deadline: 'Jan 15',
    status: 'shortlisted',
    done: 1,
    total: 10,
  },
];
