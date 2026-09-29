import { fakeRequirement } from '@/test/fakeRequirementsApi';
import { fakeDocument } from '@/test/fakeDocumentsApi';
import { permutations } from '@/test/permutations';
import {
  documentItems,
  documentUsage,
  linkOptions,
  sortDocuments,
  summarizeDocuments,
} from './logic';
import type { DocumentRow } from './types';

const documents = (...statuses: DocumentRow['status'][]) =>
  statuses.map((status) => fakeDocument({ status }));

describe('summarizeDocuments', () => {
  it('counts each status and gives the share that is complete', () => {
    expect(
      summarizeDocuments(documents('complete', 'complete', 'in_progress', 'not_started')),
    ).toEqual({ total: 4, complete: 2, inProgress: 1, notStarted: 1, percent: 50 });
  });

  it('has no percentage while there is nothing to count', () => {
    expect(summarizeDocuments([])).toEqual({
      total: 0,
      complete: 0,
      inProgress: 0,
      notStarted: 0,
      percent: null,
    });
  });

  it('is 100% only when every document is complete', () => {
    expect(summarizeDocuments(documents('complete', 'complete')).percent).toBe(100);
    expect(summarizeDocuments(documents('complete', 'in_progress')).percent).not.toBe(100);
  });

  it('never rounds up to 100%, or down to 0% once one is done', () => {
    const many = (complete: number, total: number) =>
      summarizeDocuments(
        Array.from({ length: total }, (_, index) =>
          fakeDocument({ status: index < complete ? 'complete' : 'not_started' }),
        ),
      ).percent;
    expect(many(199, 200)).toBe(99);
    expect(many(1, 300)).toBe(1);
    expect(many(0, 300)).toBe(0);
  });
});

describe('sortDocuments', () => {
  it('goes by type, then by name, with numbers read as numbers', () => {
    const rows = [
      fakeDocument({ name: 'Transcript', kind: 'transcript' }),
      fakeDocument({ name: 'Statement draft 10', kind: 'statement_of_purpose' }),
      fakeDocument({ name: 'Resume, 2026', kind: 'resume' }),
      fakeDocument({ name: 'Statement draft 2', kind: 'statement_of_purpose' }),
      fakeDocument({ name: 'Other thing', kind: 'other' }),
    ];
    expect(sortDocuments(rows).map((row) => row.name)).toEqual([
      'Resume, 2026',
      'Statement draft 2',
      'Statement draft 10',
      'Transcript',
      'Other thing',
    ]);
  });

  it('ignores capital letters when comparing names', () => {
    const rows = [fakeDocument({ name: 'b resume' }), fakeDocument({ name: 'A resume' })];
    expect(sortDocuments(rows).map((row) => row.name)).toEqual(['A resume', 'b resume']);
  });

  it('gives one answer whatever order the documents arrive in, even for equal names', () => {
    const rows = [
      fakeDocument({ id: 'a', name: 'Resume', kind: 'resume', created_at: '2026-09-02T00:00:00Z' }),
      fakeDocument({ id: 'b', name: 'Resume', kind: 'resume', created_at: '2026-09-01T00:00:00Z' }),
      fakeDocument({ id: 'c', name: 'Resume', kind: 'resume', created_at: '2026-09-01T00:00:00Z' }),
      fakeDocument({ id: 'd', name: 'CV', kind: 'cv' }),
    ];
    const expected = ['b', 'c', 'a', 'd'];
    for (const order of permutations(rows)) {
      expect(sortDocuments(order).map((row) => row.id)).toEqual(expected);
    }
  });

  it('does not change the list it was given', () => {
    const rows = [fakeDocument({ name: 'B' }), fakeDocument({ name: 'A' })];
    const before = rows.map((row) => row.name);
    sortDocuments(rows);
    expect(rows.map((row) => row.name)).toEqual(before);
  });
});

describe('documentUsage', () => {
  it('counts the checklist items that use each document', () => {
    const usage = documentUsage([
      { document_id: 'a' },
      { document_id: 'a' },
      { document_id: 'b' },
      { document_id: null },
    ]);
    expect(usage.get('a')).toBe(2);
    expect(usage.get('b')).toBe(1);
    expect(usage.has('c')).toBe(false);
    expect(usage.size).toBe(2);
  });
});

describe('documentItems', () => {
  it('keeps only the items a document can be used for, in checklist order', () => {
    const rows = [
      fakeRequirement({ kind: 'transcript', id: 't' }),
      fakeRequirement({ kind: 'recommendation_letter', label: 'Recommendation Letter 1' }),
      fakeRequirement({ kind: 'application_fee' }),
      fakeRequirement({ kind: 'resume_cv', id: 'r' }),
      fakeRequirement({ kind: 'statement_of_purpose', label: 'Why Stanford', id: 's' }),
    ];
    expect(documentItems(rows).map((row) => row.id)).toEqual(['r', 's', 't']);
  });

  it('is empty for a checklist of only letters and fees', () => {
    expect(
      documentItems([
        fakeRequirement({ kind: 'recommendation_letter' }),
        fakeRequirement({ kind: 'application_fee' }),
      ]),
    ).toEqual([]);
  });
});

describe('linkOptions', () => {
  const all = [
    fakeDocument({ id: 'cv', name: 'CV', kind: 'cv' }),
    fakeDocument({ id: 'resume', name: 'Resume', kind: 'resume' }),
    fakeDocument({ id: 'sop', name: 'Statement', kind: 'statement_of_purpose' }),
    fakeDocument({ id: 'ts', name: 'Transcript', kind: 'transcript' }),
  ];

  it('offers the documents that suit the item first, the best fit at the top', () => {
    const { suggested, others } = linkOptions('resume_cv', all);
    expect(suggested.map((row) => row.id)).toEqual(['resume', 'cv']);
    expect(others.map((row) => row.id)).toEqual(['sop', 'ts']);
  });

  it('puts the best fit first even when another suitable type is listed earlier', () => {
    // A statement of purpose is listed before a personal statement, but for a personal statement
    // item the personal statement is the better fit.
    const both = [
      fakeDocument({ id: 'sop', name: 'Statement of purpose', kind: 'statement_of_purpose' }),
      fakeDocument({ id: 'ps', name: 'Personal statement', kind: 'personal_statement' }),
    ];
    expect(linkOptions('personal_statement', both).suggested.map((row) => row.id)).toEqual([
      'ps',
      'sop',
    ]);
    expect(linkOptions('statement_of_purpose', both).suggested.map((row) => row.id)).toEqual([
      'sop',
      'ps',
    ]);
  });

  it('still offers every other document, because any document can be used for any item', () => {
    const { suggested, others } = linkOptions('transcript', all);
    expect(suggested.map((row) => row.id)).toEqual(['ts']);
    expect(others).toHaveLength(3);
  });

  it('suggests nothing for an item with no matching type, and lists everything as other', () => {
    const { suggested, others } = linkOptions('other', all);
    expect(suggested).toEqual([]);
    expect(others).toHaveLength(4);
  });

  it('suggests nothing for an item that is not a document', () => {
    const { suggested, others } = linkOptions('recommendation_letter', all);
    expect(suggested).toEqual([]);
    expect(others).toHaveLength(4);
  });

  it('keeps every document exactly once', () => {
    for (const kind of ['resume_cv', 'gre', 'other', 'application_fee'] as const) {
      const { suggested, others } = linkOptions(kind, all);
      expect([...suggested, ...others].map((row) => row.id).sort()).toEqual(
        all.map((row) => row.id).sort(),
      );
    }
  });
});
