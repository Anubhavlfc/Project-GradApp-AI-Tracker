import type { PGlite, Transaction } from '@electric-sql/pglite';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  documentFormSchema,
  documentValuesFromRow,
  emptyDocumentValues,
} from '../../src/features/documents/form';
import { DOCUMENT_KIND_VALUES, DOCUMENT_STATUS_VALUES } from '../../src/features/documents/kinds';
import { documentRowSchema, type DocumentFields } from '../../src/features/documents/types';
import { REQUIREMENT_KIND_VALUES } from '../../src/features/requirements/kinds';
import { asCaller, createDatabase, USER_A, USER_B } from './support/db';

// The document screens and the tables behind them are two halves of one contract: what the form
// produces must be accepted by the table, and what the table returns must be what the screens
// expect. These tests run the real migrations and the real form validation against each other.

let db: PGlite;

beforeAll(async () => {
  db = await createDatabase();
  for (const [id, name] of [
    [USER_A, 'ada'],
    [USER_B, 'bob'],
  ]) {
    await db.query('insert into auth.users (id, email) values ($1, $2)', [
      id,
      `${name}@example.com`,
    ]);
  }
});

afterAll(async () => {
  await db.close();
});

const asUser = { role: 'authenticated', userId: USER_A } as const;

/** What the browser would submit for the form, with some fields filled in. */
function item(overrides: Record<string, string | undefined> = {}): DocumentFields {
  return documentFormSchema.parse({
    ...emptyDocumentValues(),
    name: 'Resume, 2026',
    ...overrides,
  });
}

/** Adds a document the way the API does (no owner sent) and returns it as PostgREST would. */
async function addDocument(tx: Transaction, fields: DocumentFields) {
  const inserted = await tx.query<{ json: string }>(
    `with saved as (
       insert into public.documents (name, kind, status, url, notes)
       values ($1, $2, $3, $4, $5) returning *
     )
     select to_jsonb(saved)::text as json from saved`,
    [fields.name, fields.kind, fields.status, fields.url, fields.notes],
  );
  return documentRowSchema.parse(JSON.parse(inserted.rows[0]!.json));
}

let universities = 0;

/** A program of the signed-in person's, at a university of its own. */
async function newApplication(tx: Transaction): Promise<string> {
  universities += 1;
  const university = await tx.query<{ id: string }>(
    'insert into public.universities (name) values ($1) returning id',
    [`University ${universities}`],
  );
  const application = await tx.query<{ id: string }>(
    "insert into public.applications (university_id, program_name) values ($1, 'CS') returning id",
    [university.rows[0]!.id],
  );
  return application.rows[0]!.id;
}

/** A checklist item on a program, as the checklist API would add it. */
async function newItem(tx: Transaction, applicationId: string, kind = 'transcript') {
  const { rows } = await tx.query<{ id: string }>(
    'insert into public.requirements (application_id, kind) values ($1, $2) returning id',
    [applicationId, kind],
  );
  return rows[0]!.id;
}

describe('what the form produces is accepted by the table and read back correctly', () => {
  it('handles the smallest possible document', async () => {
    const row = await asCaller(db, asUser, (tx) => addDocument(tx, item()));
    expect(row).toMatchObject({
      name: 'Resume, 2026',
      kind: 'resume',
      status: 'not_started',
      url: null,
      notes: null,
    });
  });

  it('handles a document with every field filled in, and returns the same values', async () => {
    const row = await asCaller(db, asUser, (tx) =>
      addDocument(
        tx,
        item({
          name: '  Statement   of   Purpose, draft 3 ',
          kind: 'statement_of_purpose',
          status: 'in_progress',
          url: 'docs.google.com/document/d/abc',
          notes: 'Needs a stronger ending.\nAsk Dr. Lee to read it.',
        }),
      ),
    );
    expect(row).toMatchObject({
      name: 'Statement of Purpose, draft 3',
      kind: 'statement_of_purpose',
      status: 'in_progress',
      url: 'https://docs.google.com/document/d/abc',
      notes: 'Needs a stronger ending.\nAsk Dr. Lee to read it.',
    });
    // Opening it again to edit shows what was typed, tidied.
    expect(documentValuesFromRow(row)).toMatchObject({
      name: 'Statement of Purpose, draft 3',
      status: 'in_progress',
      url: 'https://docs.google.com/document/d/abc',
    });
  });

  it('accepts the longest values the form allows', async () => {
    const row = await asCaller(db, asUser, (tx) =>
      addDocument(
        tx,
        item({
          name: 'n'.repeat(200),
          notes: 'x'.repeat(10_000),
          url: `https://example.edu/${'a'.repeat(2000)}`,
        }),
      ),
    );
    expect(row.name).toHaveLength(200);
    expect(row.notes).toHaveLength(10_000);
  });

  it('accepts every type and every status the app offers', async () => {
    const rows = await asCaller(db, asUser, async (tx) => {
      const saved = [];
      for (const kind of DOCUMENT_KIND_VALUES) saved.push(await addDocument(tx, item({ kind })));
      for (const status of DOCUMENT_STATUS_VALUES) {
        saved.push(await addDocument(tx, item({ status })));
      }
      return saved;
    });
    expect(rows.slice(0, DOCUMENT_KIND_VALUES.length).map((row) => row.kind)).toEqual(
      DOCUMENT_KIND_VALUES,
    );
    expect(rows.slice(DOCUMENT_KIND_VALUES.length).map((row) => row.status)).toEqual(
      DOCUMENT_STATUS_VALUES,
    );
  });

  it('adds several documents in one statement, all or none', async () => {
    const names = await asCaller(db, asUser, async (tx) => {
      await tx.query(
        `insert into public.documents (name, kind, status, url, notes)
         values ('Resume', 'resume', 'not_started', null, null),
                ('Transcript', 'transcript', 'not_started', null, null)`,
      );
      const { rows } = await tx.query<{ name: string }>(
        'select name from public.documents order by name',
      );
      return rows.map((row) => row.name);
    });
    expect(names).toEqual(['Resume', 'Transcript']);

    await expect(
      asCaller(db, asUser, (tx) =>
        tx.query(
          `insert into public.documents (name, kind, status, url, notes)
           values ('Fine', 'resume', 'not_started', null, null),
                  ('', 'cv', 'not_started', null, null)`,
        ),
      ),
    ).rejects.toMatchObject({ code: '23514' });
  });

  it('fills in the owner from the signed-in person', async () => {
    const owners = await asCaller(db, asUser, async (tx) => {
      await addDocument(tx, item());
      return tx.query<{ user_id: string }>('select user_id from public.documents');
    });
    expect(owners.rows.map((row) => row.user_id)).toEqual([USER_A]);
  });
});

describe('the app and the database agree on the allowed values', () => {
  it('document_kind has exactly the types the app knows', async () => {
    const { rows } = await db.query<{ label: string }>(
      'select unnest(enum_range(null::public.document_kind))::text as label',
    );
    expect(rows.map((row) => row.label).sort()).toEqual([...DOCUMENT_KIND_VALUES].sort());
  });

  it('document_status has exactly the statuses the app knows', async () => {
    const { rows } = await db.query<{ label: string }>(
      'select unnest(enum_range(null::public.document_status))::text as label',
    );
    expect(rows.map((row) => row.label).sort()).toEqual([...DOCUMENT_STATUS_VALUES].sort());
  });

  it('every kind of checklist item the app knows is one the database has', async () => {
    const { rows } = await db.query<{ label: string }>(
      'select unnest(enum_range(null::public.requirement_kind))::text as label',
    );
    expect(rows.map((row) => row.label).sort()).toEqual([...REQUIREMENT_KIND_VALUES].sort());
  });
});

describe('the database refuses what the form would also refuse', () => {
  const refuses = (patch: Partial<DocumentFields>, code: string) =>
    expect(
      asCaller(db, asUser, (tx) => addDocument(tx, { ...item(), ...patch })),
    ).rejects.toMatchObject({ code });

  it('a name that is empty, blank or over 200 characters', async () => {
    for (const name of ['', '   ', 'x'.repeat(201)]) await refuses({ name }, '23514');
  });

  it('notes over 10,000 characters', async () => {
    await refuses({ notes: 'x'.repeat(10_001) }, '23514');
  });

  it('a link that is not a web address, or is over 2,048 characters', async () => {
    for (const url of [
      'javascript:alert(1)',
      'ftp://example.edu',
      'file:///etc/passwd',
      'example.edu',
      'https://a b',
      `https://example.edu/${'a'.repeat(2040)}`,
    ]) {
      await refuses({ url }, '23514');
    }
  });

  it('a type or a status it does not know', async () => {
    await refuses({ kind: 'hologram' as DocumentFields['kind'] }, '22P02');
    await refuses({ status: 'on_fire' as DocumentFields['status'] }, '22P02');
  });
});

describe('choosing which document a checklist item uses', () => {
  it('lets an item use one of your documents, and be changed to another or to none', async () => {
    const states = await asCaller(db, asUser, async (tx) => {
      const program = await newApplication(tx);
      const requirement = await newItem(tx, program);
      const resume = await addDocument(tx, item());
      const cv = await addDocument(tx, item({ name: 'CV', kind: 'cv' }));
      const read = async () =>
        (
          await tx.query<{ document_id: string | null }>(
            'select document_id from public.requirements where id = $1',
            [requirement],
          )
        ).rows[0]!.document_id;
      const set = (documentId: string | null) =>
        tx.query('update public.requirements set document_id = $1 where id = $2 returning id', [
          documentId,
          requirement,
        ]);
      const start = await read();
      await set(resume.id);
      const first = await read();
      await set(cv.id);
      const second = await read();
      await set(null);
      const last = await read();
      return { start, first, second, last, resume: resume.id, cv: cv.id };
    });
    expect(states.start).toBeNull();
    expect(states.first).toBe(states.resume);
    expect(states.second).toBe(states.cv);
    expect(states.last).toBeNull();
  });

  it('lets many items, on many programs, use the same document', async () => {
    const usage = await asCaller(db, asUser, async (tx) => {
      const resume = await addDocument(tx, item());
      for (let index = 0; index < 3; index += 1) {
        const requirement = await newItem(tx, await newApplication(tx), 'resume_cv');
        await tx.query('update public.requirements set document_id = $1 where id = $2', [
          resume.id,
          requirement,
        ]);
      }
      const { rows } = await tx.query<{ n: string }>(
        'select count(*) as n from public.requirements where document_id = $1',
        [resume.id],
      );
      return Number(rows[0]!.n);
    });
    expect(usage).toBe(3);
  });

  it('changes nothing else about the item', async () => {
    const after = await asCaller(db, asUser, async (tx) => {
      const requirement = await newItem(tx, await newApplication(tx));
      await tx.query(
        "update public.requirements set status = 'submitted', notes = 'sent by post', due_date = '2026-12-01' where id = $1",
        [requirement],
      );
      const resume = await addDocument(tx, item());
      await tx.query('update public.requirements set document_id = $1 where id = $2', [
        resume.id,
        requirement,
      ]);
      const { rows } = await tx.query<{
        status: string;
        notes: string;
        due_date: string;
      }>('select status, notes, due_date::text from public.requirements where id = $1', [
        requirement,
      ]);
      return rows[0];
    });
    expect(after).toEqual({ status: 'submitted', notes: 'sent by post', due_date: '2026-12-01' });
  });

  it('refuses a document that does not exist', async () => {
    await expect(
      asCaller(db, asUser, async (tx) => {
        const requirement = await newItem(tx, await newApplication(tx));
        await tx.query('update public.requirements set document_id = $1 where id = $2', [
          '99999999-9999-4999-8999-999999999999',
          requirement,
        ]);
      }),
    ).rejects.toMatchObject({ code: '23503' });
  });

  it('keeps the checklist items, and only clears their link, when a document is deleted', async () => {
    const after = await asCaller(db, asUser, async (tx) => {
      const program = await newApplication(tx);
      const doomed = await addDocument(tx, item({ name: 'Doomed' }));
      const kept = await addDocument(tx, item({ name: 'Kept', kind: 'cv' }));
      const one = await newItem(tx, program, 'resume_cv');
      const two = await newItem(tx, program, 'transcript');
      const three = await newItem(tx, program, 'portfolio');
      await tx.query("update public.requirements set status = 'complete' where id = $1", [one]);
      await tx.query('update public.requirements set document_id = $1 where id = ANY($2)', [
        doomed.id,
        [one, two],
      ]);
      await tx.query('update public.requirements set document_id = $1 where id = $2', [
        kept.id,
        three,
      ]);
      await tx.query('delete from public.documents where id = $1', [doomed.id]);
      const { rows } = await tx.query<{ kind: string; status: string; used: string | null }>(
        `select r.kind::text, r.status::text, d.name as used
           from public.requirements r left join public.documents d on d.id = r.document_id
          order by r.kind::text`,
      );
      return rows;
    });
    expect(after).toEqual([
      { kind: 'portfolio', status: 'not_started', used: 'Kept' },
      { kind: 'resume_cv', status: 'complete', used: null },
      { kind: 'transcript', status: 'not_started', used: null },
    ]);
  });

  it('keeps a person’s documents when one of their programs is deleted', async () => {
    const left = await asCaller(db, asUser, async (tx) => {
      const program = await newApplication(tx);
      const resume = await addDocument(tx, item());
      const requirement = await newItem(tx, program, 'resume_cv');
      await tx.query('update public.requirements set document_id = $1 where id = $2', [
        resume.id,
        requirement,
      ]);
      await tx.query('delete from public.applications where id = $1', [program]);
      const documents = await tx.query('select id from public.documents');
      const requirements = await tx.query('select id from public.requirements');
      return { documents: documents.rows.length, requirements: requirements.rows.length };
    });
    expect(left).toEqual({ documents: 1, requirements: 0 });
  });
});

describe('what happens around documents', () => {
  it('changes only the status when the status is changed', async () => {
    const after = await asCaller(db, asUser, async (tx) => {
      const saved = await addDocument(tx, item({ notes: 'keep me', url: 'https://example.com/r' }));
      await tx.query("update public.documents set status = 'complete' where id = $1", [saved.id]);
      const { rows } = await tx.query<{ json: string }>(
        'select to_jsonb(d)::text as json from public.documents d where id = $1',
        [saved.id],
      );
      return documentRowSchema.parse(JSON.parse(rows[0]!.json));
    });
    expect(after).toMatchObject({
      status: 'complete',
      notes: 'keep me',
      url: 'https://example.com/r',
      name: 'Resume, 2026',
    });
  });

  it('notes when a document last changed', async () => {
    const stamp = await asCaller(db, asUser, async (tx) => {
      // The clock stands still inside a transaction, so start the row off in the past.
      const { rows } = await tx.query<{ id: string }>(
        "insert into public.documents (name, kind, updated_at) values ('A', 'other', '2020-01-01') returning id",
      );
      await tx.query("update public.documents set status = 'complete' where id = $1", [
        rows[0]!.id,
      ]);
      const updated = await tx.query<{ updated_at: string }>(
        'select updated_at::text from public.documents where id = $1',
        [rows[0]!.id],
      );
      return updated.rows[0]!.updated_at;
    });
    expect(Date.parse(stamp)).toBeGreaterThan(Date.parse('2026-01-01'));
  });
});

describe('who can see and change what', () => {
  const BOB_DOCUMENT = '00000000-0000-4000-8000-0000000000e1';
  const BOB_UNIVERSITY = '00000000-0000-4000-8000-0000000000e2';
  const BOB_PROGRAM = '00000000-0000-4000-8000-0000000000e3';
  const BOB_ITEM = '00000000-0000-4000-8000-0000000000e4';

  async function seedBob() {
    await db.query(
      "insert into public.documents (id, user_id, name, kind) values ($1, $2, 'Bob’s resume', 'resume')",
      [BOB_DOCUMENT, USER_B],
    );
    await db.query('insert into public.universities (id, user_id, name) values ($1, $2, $3)', [
      BOB_UNIVERSITY,
      USER_B,
      'Bob University',
    ]);
    await db.query(
      `insert into public.applications (id, user_id, university_id, program_name)
       values ($1, $2, $3, 'Bob MS')`,
      [BOB_PROGRAM, USER_B, BOB_UNIVERSITY],
    );
    await db.query(
      `insert into public.requirements (id, user_id, application_id, kind, document_id)
       values ($1, $2, $3, 'resume_cv', $4)`,
      [BOB_ITEM, USER_B, BOB_PROGRAM, BOB_DOCUMENT],
    );
  }
  async function cleanBob() {
    await db.query('delete from public.requirements where user_id = $1', [USER_B]);
    await db.query('delete from public.documents where user_id = $1', [USER_B]);
    await db.query('delete from public.applications where user_id = $1', [USER_B]);
    await db.query('delete from public.universities where user_id = $1', [USER_B]);
  }

  it('shows each person only their own documents', async () => {
    await seedBob();
    try {
      const seenByA = await asCaller(db, asUser, async (tx) => {
        await addDocument(tx, item({ name: 'Ada’s resume' }));
        const { rows } = await tx.query<{ name: string }>('select name from public.documents');
        return rows.map((row) => row.name);
      });
      expect(seenByA).toEqual(['Ada’s resume']);

      const seenByB = await asCaller(db, { role: 'authenticated', userId: USER_B }, async (tx) => {
        const { rows } = await tx.query<{ name: string }>('select name from public.documents');
        return rows.map((row) => row.name);
      });
      expect(seenByB).toEqual(['Bob’s resume']);
    } finally {
      await cleanBob();
    }
  });

  it('will not let someone change or delete another person’s document', async () => {
    await seedBob();
    try {
      const outcome = await asCaller(db, asUser, async (tx) => {
        const renamed = await tx.query(
          "update public.documents set name = 'Hacked' where id = $1 returning id",
          [BOB_DOCUMENT],
        );
        const completed = await tx.query(
          "update public.documents set status = 'complete' where id = $1 returning id",
          [BOB_DOCUMENT],
        );
        const deleted = await tx.query('delete from public.documents where id = $1 returning id', [
          BOB_DOCUMENT,
        ]);
        return [renamed.rows.length, completed.rows.length, deleted.rows.length];
      });
      expect(outcome).toEqual([0, 0, 0]);
      const { rows } = await db.query<{ name: string; status: string }>(
        'select name, status from public.documents where id = $1',
        [BOB_DOCUMENT],
      );
      expect(rows[0]).toEqual({ name: 'Bob’s resume', status: 'not_started' });
    } finally {
      await cleanBob();
    }
  });

  it('will not let someone use another person’s document for their own checklist item', async () => {
    await seedBob();
    try {
      await expect(
        asCaller(db, asUser, async (tx) => {
          const mine = await newItem(tx, await newApplication(tx));
          await tx.query('update public.requirements set document_id = $1 where id = $2', [
            BOB_DOCUMENT,
            mine,
          ]);
        }),
      ).rejects.toMatchObject({ code: '23503' });
    } finally {
      await cleanBob();
    }
  });

  it('will not let someone change what another person’s checklist item uses', async () => {
    await seedBob();
    try {
      const outcome = await asCaller(db, asUser, async (tx) => {
        const mine = await addDocument(tx, item());
        const changed = await tx.query(
          'update public.requirements set document_id = $1 where id = $2 returning id',
          [mine.id, BOB_ITEM],
        );
        return changed.rows.length;
      });
      expect(outcome).toBe(0);
      const { rows } = await db.query<{ document_id: string }>(
        'select document_id from public.requirements where id = $1',
        [BOB_ITEM],
      );
      expect(rows[0]!.document_id).toBe(BOB_DOCUMENT);
    } finally {
      await cleanBob();
    }
  });

  it('will not let someone save a document in another person’s name', async () => {
    await expect(
      asCaller(db, asUser, (tx) =>
        tx.query(
          "insert into public.documents (user_id, name, kind) values ($1, 'Sneaky', 'other')",
          [USER_B],
        ),
      ),
    ).rejects.toMatchObject({ code: '42501' });
    await expect(
      asCaller(db, asUser, async (tx) => {
        const mine = await addDocument(tx, item());
        await tx.query('update public.documents set user_id = $1 where id = $2', [USER_B, mine.id]);
      }),
    ).rejects.toMatchObject({ code: '42501' });
  });

  it('shows nothing at all to someone who is not signed in', async () => {
    await seedBob();
    try {
      await expect(
        asCaller(db, { role: 'anon' }, (tx) => tx.query('select id from public.documents')),
      ).rejects.toMatchObject({ code: '42501' });
    } finally {
      await cleanBob();
    }
  });
});
