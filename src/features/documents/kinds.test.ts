import { REQUIREMENT_KINDS } from '@/features/requirements/kinds';
import {
  COMMON_DOCUMENTS,
  DOCUMENT_KIND_VALUES,
  DOCUMENT_KINDS,
  DOCUMENT_STATUSES,
  documentKindLabel,
  documentKindOrder,
  documentKindsFor,
  getDocumentStatusMeta,
  isDocumentRequirement,
} from './kinds';

describe('document kinds', () => {
  it('are the ten the brief lists, plus IELTS, in a steady order', () => {
    expect(DOCUMENT_KINDS.map((kind) => kind.label)).toEqual([
      'Resume',
      'CV',
      'Statement of Purpose',
      'Personal Statement',
      'Transcript',
      'Writing Sample',
      'Portfolio',
      'GRE Score',
      'TOEFL Score',
      'IELTS Score',
      'Other',
    ]);
    expect(documentKindOrder('resume')).toBeLessThan(documentKindOrder('other'));
  });

  it('have a label, and fall back to the raw value for one this version does not know', () => {
    expect(documentKindLabel('statement_of_purpose')).toBe('Statement of Purpose');
    expect(documentKindLabel('hologram' as never)).toBe('hologram');
  });
});

describe('document statuses', () => {
  it('go from not started to complete', () => {
    expect(DOCUMENT_STATUSES.map((status) => status.label)).toEqual([
      'Not Started',
      'In Progress',
      'Complete',
    ]);
    expect(getDocumentStatusMeta('complete').tone).toBe('green');
  });

  it('throw for a status that does not exist, instead of showing a blank badge', () => {
    expect(() => getDocumentStatusMeta('lost' as never)).toThrow(/Unknown document status/);
  });
});

describe('which checklist items can use a document', () => {
  it('leaves out letters and the application fee, which are not documents of yours', () => {
    expect(isDocumentRequirement('recommendation_letter')).toBe(false);
    expect(isDocumentRequirement('application_fee')).toBe(false);
  });

  it('includes essays, transcripts, test scores and samples', () => {
    for (const kind of [
      'resume_cv',
      'statement_of_purpose',
      'personal_statement',
      'supplemental_essay',
      'transcript',
      'gre',
      'gmat',
      'toefl',
      'ielts',
      'writing_sample',
      'portfolio',
      'other',
    ] as const) {
      expect(isDocumentRequirement(kind), kind).toBe(true);
    }
  });

  it('decides for every kind of checklist item, so a new kind cannot be forgotten', () => {
    const decided = REQUIREMENT_KINDS.map((kind) => kind.value).filter((kind) =>
      isDocumentRequirement(kind),
    );
    const notDocuments = REQUIREMENT_KINDS.map((kind) => kind.value).filter(
      (kind) => !isDocumentRequirement(kind),
    );
    expect(notDocuments).toEqual(['recommendation_letter', 'application_fee']);
    expect(decided.length + notDocuments.length).toBe(REQUIREMENT_KINDS.length);
  });

  it('only suggests kinds of document that exist', () => {
    for (const { value } of REQUIREMENT_KINDS) {
      if (!isDocumentRequirement(value)) continue;
      for (const kind of documentKindsFor(value)) expect(DOCUMENT_KIND_VALUES).toContain(kind);
    }
  });

  it('suggests these kinds of document for each kind of item, best fit first', () => {
    expect(documentKindsFor('resume_cv')).toEqual(['resume', 'cv']);
    expect(documentKindsFor('statement_of_purpose')).toEqual([
      'statement_of_purpose',
      'personal_statement',
    ]);
    expect(documentKindsFor('personal_statement')).toEqual([
      'personal_statement',
      'statement_of_purpose',
    ]);
    expect(documentKindsFor('supplemental_essay')).toEqual([
      'other',
      'personal_statement',
      'statement_of_purpose',
    ]);
    expect(documentKindsFor('transcript')).toEqual(['transcript']);
    expect(documentKindsFor('gre')).toEqual(['gre_score']);
    expect(documentKindsFor('gmat')).toEqual(['other']);
    expect(documentKindsFor('toefl')).toEqual(['toefl_score']);
    expect(documentKindsFor('ielts')).toEqual(['ielts_score']);
    expect(documentKindsFor('writing_sample')).toEqual(['writing_sample']);
    expect(documentKindsFor('portfolio')).toEqual(['portfolio']);
    expect(documentKindsFor('other')).toEqual([]);
  });

  it('puts the best fit first', () => {
    expect(documentKindsFor('resume_cv')).toEqual(['resume', 'cv']);
    expect(documentKindsFor('statement_of_purpose')[0]).toBe('statement_of_purpose');
    expect(documentKindsFor('personal_statement')[0]).toBe('personal_statement');
    expect(documentKindsFor('gre')).toEqual(['gre_score']);
    expect(documentKindsFor('other')).toEqual([]);
  });
});

describe('the usual documents', () => {
  it('each have their own key and a real type', () => {
    const ids = COMMON_DOCUMENTS.map((item) => item.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const item of COMMON_DOCUMENTS) expect(DOCUMENT_KIND_VALUES).toContain(item.kind);
  });

  it('start with a resume, a statement of purpose and a transcript ticked', () => {
    expect(COMMON_DOCUMENTS.filter((item) => item.preselected).map((item) => item.kind)).toEqual([
      'resume',
      'statement_of_purpose',
      'transcript',
    ]);
  });
});
