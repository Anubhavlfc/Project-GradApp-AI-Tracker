import { randomUUID } from 'node:crypto';

// Sample data for development and demos: five graduate programs with a checklist, recommenders,
// funding, documents and tasks around them, dated relative to today so the dashboard always has
// something due soon, something late and something already sent.
//
// It is NOT real information about these universities, and it is only ever written to a demo
// account (see scripts/seed-demo.mjs). Every row says so in its notes.

export const SAMPLE_NOTE = 'Sample data for testing and demos. Not a real application.';

/** 'YYYY-MM-DD' for the day `offset` days from `today`, on the calendar of the machine's clock. */
export function dayOffset(today, offset) {
  const day = new Date(today.getFullYear(), today.getMonth(), today.getDate() + offset);
  const pad = (value) => String(value).padStart(2, '0');
  return `${day.getFullYear()}-${pad(day.getMonth() + 1)}-${pad(day.getDate())}`;
}

/**
 * Demo accounts are the only ones sample data is written to: the address must begin with "demo"
 * (demo@example.com, demo+portfolio@example.com), so a real account that happens to be empty is
 * never filled with sample programs by mistake.
 */
export function isDemoEmail(email) {
  return /^demo([+._-].*)?@/i.test(email.trim());
}

/**
 * Every row of the sample data, keyed by table and in the order the tables must be filled.
 * Rows carry their own ids so they can point at each other without reading anything back.
 *
 * @param {Date} [today]
 * @param {() => string} [newId]
 */
export function buildDemoData(today = new Date(), newId = randomUUID) {
  const day = (offset) => dayOffset(today, offset);

  const university = (name, city, region, website) => ({
    id: newId(),
    name,
    city,
    region,
    country: 'United States',
    website_url: website,
  });
  const stanfordU = university('Stanford University', 'Stanford', 'CA', 'https://www.stanford.edu');
  const cmuU = university('Carnegie Mellon University', 'Pittsburgh', 'PA', 'https://www.cmu.edu');
  const uwU = university('University of Washington', 'Seattle', 'WA', 'https://www.washington.edu');
  const columbiaU = university('Columbia University', 'New York', 'NY', 'https://www.columbia.edu');
  const berkeleyU = university('UC Berkeley', 'Berkeley', 'CA', 'https://www.berkeley.edu');

  const program = (u, fields) => ({
    id: newId(),
    university_id: u.id,
    degree_level: 'masters',
    notes: SAMPLE_NOTE,
    ...fields,
  });
  const stanford = program(stanfordU, {
    program_name: 'Computer Science',
    degree_type: 'MS',
    department: 'Computer Science',
    program_length_months: 24,
    is_stem: true,
    status: 'documents_in_progress',
    priority: 'dream',
    is_favorite: true,
    deadline: day(21),
    priority_deadline: day(14),
    portal_url: 'https://apply.example.edu/stanford-cs',
    application_fee: 125,
    fee_waiver_available: true,
    fee_waiver_status: 'requested',
  });
  const cmu = program(cmuU, {
    program_name: 'Computational Finance',
    degree_type: 'MS',
    is_stem: true,
    status: 'application_started',
    priority: 'target',
    deadline: day(35),
    application_fee: 100,
  });
  const uw = program(uwU, {
    program_name: 'Data Science',
    degree_type: 'MS',
    is_stem: true,
    status: 'shortlisted',
    priority: 'target',
    deadline: day(60),
    application_fee: 85,
  });
  const columbia = program(columbiaU, {
    program_name: 'Applied Analytics',
    degree_type: 'MS',
    is_stem: true,
    status: 'submitted',
    priority: 'target',
    deadline: day(-4),
    submitted_on: day(-6),
    application_fee: 120,
    fee_paid_on: day(-6),
  });
  const berkeley = program(berkeleyU, {
    program_name: 'Master of Analytics',
    status: 'researching',
    priority: 'target',
    deadline: day(90),
    application_fee: 145,
  });

  const documents = [
    {
      id: newId(),
      name: 'Resume 2026',
      kind: 'resume',
      status: 'complete',
      url: 'https://example.com/sample-resume.pdf',
      notes: SAMPLE_NOTE,
    },
    {
      id: newId(),
      name: 'Statement of purpose, second draft',
      kind: 'statement_of_purpose',
      status: 'in_progress',
      notes: SAMPLE_NOTE,
    },
    {
      id: newId(),
      name: 'Official transcript',
      kind: 'transcript',
      status: 'not_started',
      notes: SAMPLE_NOTE,
    },
  ];
  const [resume, statement, transcriptDoc] = documents;

  const requirement = (application, kind, fields = {}) => ({
    id: newId(),
    application_id: application.id,
    kind,
    ...fields,
  });
  const letter = (application, number, fields = {}) =>
    requirement(application, 'recommendation_letter', {
      label: `Recommendation Letter ${number}`,
      ...fields,
    });
  const requirements = [
    requirement(stanford, 'resume_cv', { status: 'complete', document_id: resume?.id }),
    requirement(stanford, 'statement_of_purpose', {
      status: 'in_progress',
      due_date: day(10),
      document_id: statement?.id,
    }),
    requirement(stanford, 'transcript', {
      status: 'not_started',
      due_date: day(12),
      document_id: transcriptDoc?.id,
    }),
    requirement(stanford, 'gre', { status: 'in_progress', due_date: day(7) }),
    letter(stanford, 1, { status: 'in_progress' }),
    letter(stanford, 2, { status: 'not_started' }),
    requirement(stanford, 'application_fee', { status: 'not_started' }),
    requirement(cmu, 'resume_cv', { status: 'complete', document_id: resume?.id }),
    requirement(cmu, 'statement_of_purpose', { status: 'not_started', due_date: day(25) }),
    requirement(cmu, 'transcript', { status: 'not_started' }),
    letter(cmu, 1, { status: 'not_started' }),
    requirement(columbia, 'resume_cv', { status: 'submitted' }),
    requirement(columbia, 'statement_of_purpose', { status: 'submitted' }),
    requirement(columbia, 'transcript', { status: 'submitted' }),
    letter(columbia, 1, { status: 'submitted' }),
  ];

  const recommenders = [
    {
      id: newId(),
      name: 'Prof. Dana Whitfield',
      title: 'Professor',
      institution: 'State University',
      email: 'dana.whitfield@example.edu',
      notes: SAMPLE_NOTE,
    },
    {
      id: newId(),
      name: 'Dr. Miguel Alvarez',
      title: 'Research Manager',
      institution: 'Acme Analytics',
      email: 'miguel.alvarez@example.com',
      notes: SAMPLE_NOTE,
    },
    {
      id: newId(),
      name: 'Prof. Priya Nair',
      title: 'Associate Professor',
      institution: 'Lakeside Institute',
      email: 'priya.nair@example.edu',
      notes: SAMPLE_NOTE,
    },
  ];
  const [whitfield, alvarez, nair] = recommenders;
  const request = (person, application, fields) => ({
    id: newId(),
    recommender_id: person?.id,
    application_id: application.id,
    ...fields,
  });
  const recommendationRequests = [
    request(whitfield, stanford, {
      status: 'requested',
      requested_on: day(-10),
      deadline: day(21),
    }),
    request(whitfield, cmu, { status: 'requested', requested_on: day(-3), deadline: day(35) }),
    request(alvarez, stanford, { status: 'confirmed', requested_on: day(-12), deadline: day(21) }),
    request(alvarez, columbia, { status: 'submitted', requested_on: day(-30), deadline: day(-4) }),
    request(nair, stanford, {
      status: 'needs_follow_up',
      requested_on: day(-20),
      deadline: day(21),
    }),
    request(nair, cmu, { status: 'not_requested', deadline: day(35) }),
  ];

  const funding = [
    {
      id: newId(),
      application_id: stanford.id,
      name: 'Knight-Hennessy Scholars',
      kind: 'fellowship',
      amount: 90000,
      status: 'applying',
      deadline: day(14),
      application_required: true,
      url: 'https://example.com/sample-fellowship',
      notes: SAMPLE_NOTE,
    },
    {
      id: newId(),
      application_id: cmu.id,
      name: 'Departmental merit scholarship',
      kind: 'university_scholarship',
      amount: 15000,
      status: 'researching',
      notes: SAMPLE_NOTE,
    },
    {
      id: newId(),
      application_id: uw.id,
      name: 'Research assistantship',
      kind: 'research_assistantship',
      status: 'researching',
      notes: SAMPLE_NOTE,
    },
    {
      id: newId(),
      application_id: null,
      name: 'External fellowship (not tied to one program)',
      kind: 'external_scholarship',
      amount: 25000,
      status: 'researching',
      deadline: day(75),
      application_required: true,
      notes: SAMPLE_NOTE,
    },
  ];

  const task = (application, title, fields) => ({
    id: newId(),
    application_id: application?.id ?? null,
    title,
    notes: SAMPLE_NOTE,
    ...fields,
  });
  const tasks = [
    task(stanford, 'Remind Prof. Whitfield about the letter', {
      status: 'todo',
      priority: 'high',
      due_date: day(2),
    }),
    task(stanford, 'Request official transcripts', {
      status: 'todo',
      priority: 'high',
      due_date: day(-1),
    }),
    task(null, 'Book the GRE', { status: 'todo', priority: 'medium', due_date: day(7) }),
    task(stanford, 'Second pass on the statement of purpose', {
      status: 'in_progress',
      priority: 'high',
      due_date: day(10),
    }),
    task(cmu, 'Pay the CMU application fee', {
      status: 'todo',
      priority: 'medium',
      due_date: day(12),
    }),
    task(columbia, 'Send a thank-you note to Dr. Alvarez', {
      status: 'complete',
      priority: 'low',
      due_date: day(-2),
    }),
  ];

  return {
    universities: [stanfordU, cmuU, uwU, columbiaU, berkeleyU],
    applications: [stanford, cmu, uw, columbia, berkeley],
    documents,
    requirements,
    recommenders,
    recommendation_requests: recommendationRequests,
    funding,
    tasks,
  };
}
