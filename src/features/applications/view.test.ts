import { fundingByApplication } from '@/features/funding/logic';
import type { FundingRow } from '@/features/funding/types';
import { fakeRecord } from '@/test/fakeApplicationsApi';
import { fakeFunding } from '@/test/fakeFundingApi';
import {
  activeFilterCount,
  applyView,
  clearFilters,
  DEFAULT_DIRECTION,
  DEFAULT_VIEW,
  FUNDING_FILTERS,
  isFiltered,
  knownUniversities,
  parseView,
  serializeView,
  SORT_KEYS,
  SORT_LABELS,
  usedCountries,
  type FundingStates,
  type ViewState,
} from './view';

const TODAY = '2026-12-01';
const view = (overrides: Partial<ViewState> = {}): ViewState => ({ ...DEFAULT_VIEW, ...overrides });
const names = (records: ReturnType<typeof applyView>) =>
  records.map((record) => record.university.name);

describe('parseView / serializeView', () => {
  it('reads an empty address as the default view', () => {
    expect(parseView(new URLSearchParams())).toEqual(DEFAULT_VIEW);
    expect(serializeView(DEFAULT_VIEW).toString()).toBe('');
  });

  it('round-trips every setting', () => {
    const everything = view({
      query: 'machine learning',
      status: 'submitted',
      degree: 'phd',
      priority: 'dream',
      deadline: 'week',
      funding: 'pursuing',
      country: 'United States',
      favoritesOnly: true,
      sort: 'fee',
      direction: 'asc',
    });
    expect(parseView(serializeView(everything))).toEqual(everything);
  });

  it('leaves default sorting out of the address, but keeps a changed direction', () => {
    expect(serializeView(view({ sort: 'updated', direction: 'desc' })).toString()).toBe(
      'sort=updated',
    );
    expect(serializeView(view({ sort: 'updated', direction: 'asc' })).toString()).toBe(
      'sort=updated&dir=asc',
    );
    expect(serializeView(view({ direction: 'desc' })).toString()).toBe('dir=desc');
  });

  it('uses the natural direction for a sort key given without one', () => {
    expect(parseView(new URLSearchParams('sort=fee')).direction).toBe('desc');
    expect(parseView(new URLSearchParams('sort=university')).direction).toBe('asc');
  });

  it('ignores values it does not recognise instead of failing', () => {
    expect(
      parseView(
        new URLSearchParams(
          'status=bogus&degree=x&priority=high&deadline=soon&funding=maybe&sort=age&dir=up&fav=yes',
        ),
      ),
    ).toEqual(DEFAULT_VIEW);
  });

  it('trims the search text', () => {
    expect(parseView(new URLSearchParams('q=%20%20stanford%20')).query).toBe('stanford');
  });
});

describe('activeFilterCount / isFiltered / clearFilters', () => {
  it('counts filters but not search or sorting', () => {
    expect(activeFilterCount(DEFAULT_VIEW)).toBe(0);
    expect(activeFilterCount(view({ query: 'mit', sort: 'fee' }))).toBe(0);
    expect(
      activeFilterCount(view({ status: 'accepted', country: 'Canada', favoritesOnly: true })),
    ).toBe(3);
  });

  it('counts the funding filter, and clearing removes it', () => {
    expect(activeFilterCount(view({ funding: 'offered' }))).toBe(1);
    expect(isFiltered(view({ funding: 'none' }))).toBe(true);
    expect(clearFilters(view({ funding: 'pursuing', sort: 'fee' }))).toEqual(view({ sort: 'fee' }));
  });

  it('treats search as narrowing the list too', () => {
    expect(isFiltered(DEFAULT_VIEW)).toBe(false);
    expect(isFiltered(view({ sort: 'fee' }))).toBe(false);
    expect(isFiltered(view({ query: 'mit' }))).toBe(true);
    expect(isFiltered(view({ favoritesOnly: true }))).toBe(true);
  });

  it('clears search and filters but keeps the order', () => {
    expect(
      clearFilters(view({ query: 'mit', status: 'accepted', sort: 'fee', direction: 'asc' })),
    ).toEqual(view({ sort: 'fee', direction: 'asc' }));
  });
});

describe('applyView: search', () => {
  const records = [
    fakeRecord({
      program_name: 'Computer Science',
      department: 'EECS',
      degree_type: 'MS',
      notes: 'Ask Prof. Chen about funding',
      university: {
        name: 'Stanford University',
        city: 'Stanford',
        region: 'CA',
        country: 'United States',
      },
    }),
    fakeRecord({
      program_name: 'Machine Learning',
      university: { name: 'ETH Zürich', city: 'Zürich', country: 'Switzerland' },
    }),
    fakeRecord({
      program_name: 'Data Science',
      university: { name: 'University of Toronto', country: 'Canada' },
    }),
  ];
  const find = (query: string) =>
    names(applyView(records, view({ query, sort: 'university' }), TODAY));

  it('matches the university, program, department, degree, place and notes', () => {
    expect(find('stanford')).toEqual(['Stanford University']);
    expect(find('machine')).toEqual(['ETH Zürich']);
    expect(find('eecs')).toEqual(['Stanford University']);
    expect(find('canada')).toEqual(['University of Toronto']);
    expect(find('CA')).toContain('Stanford University');
    expect(find('funding')).toEqual(['Stanford University']);
  });

  it('ignores capitals and accents', () => {
    expect(find('ZURICH')).toEqual(['ETH Zürich']);
    expect(find('zürich')).toEqual(['ETH Zürich']);
  });

  it('needs every word to match, in any order', () => {
    expect(find('science stanford')).toEqual(['Stanford University']);
    expect(find('science zurich')).toEqual([]);
  });

  it('shows everything for a blank search', () => {
    expect(find('   ')).toHaveLength(3);
  });
});

describe('applyView: filters', () => {
  const records = [
    fakeRecord({
      status: 'submitted',
      degree_level: 'phd',
      priority: 'dream',
      is_favorite: true,
      deadline: '2026-11-15',
      university: { name: 'A', country: 'United States' },
    }),
    fakeRecord({
      status: 'researching',
      degree_level: 'masters',
      priority: 'target',
      deadline: '2026-11-20',
      university: { name: 'B', country: 'Canada' },
    }),
    fakeRecord({
      status: 'researching',
      degree_level: 'masters',
      priority: 'safety',
      deadline: '2026-12-05',
      university: { name: 'C', country: 'Canada' },
    }),
    fakeRecord({
      status: 'documents_in_progress',
      degree_level: 'masters',
      deadline: '2026-12-25',
      university: { name: 'D', country: 'United States' },
    }),
    fakeRecord({
      status: 'shortlisted',
      degree_level: 'other',
      deadline: '2027-03-01',
      university: { name: 'E' },
    }),
    fakeRecord({
      status: 'researching',
      degree_level: 'masters',
      deadline: null,
      university: { name: 'F' },
    }),
  ];
  const filter = (overrides: Partial<ViewState>) =>
    names(applyView(records, view({ sort: 'university', ...overrides }), TODAY));

  it('filters by status, degree, priority, country and favorites', () => {
    expect(filter({ status: 'researching' })).toEqual(['B', 'C', 'F']);
    expect(filter({ degree: 'phd' })).toEqual(['A']);
    expect(filter({ priority: 'safety' })).toEqual(['C']);
    expect(filter({ country: 'Canada' })).toEqual(['B', 'C']);
    expect(filter({ favoritesOnly: true })).toEqual(['A']);
  });

  it('filters by country whatever the capitals', () => {
    expect(filter({ country: 'canada' })).toEqual(['B', 'C']);
    expect(filter({ country: 'UNITED STATES' })).toEqual(['A', 'D']);
  });

  it('combines filters with AND', () => {
    expect(filter({ status: 'researching', country: 'Canada' })).toEqual(['B', 'C']);
    expect(filter({ status: 'researching', country: 'Canada', priority: 'target' })).toEqual(['B']);
    expect(filter({ status: 'submitted', country: 'Canada' })).toEqual([]);
  });

  it('finds overdue deadlines, but only for applications still open', () => {
    // A's deadline passed too, but it was submitted, so it is not "overdue".
    expect(filter({ deadline: 'overdue' })).toEqual(['B']);
  });

  it('finds deadlines coming up within a week or a month', () => {
    expect(filter({ deadline: 'week' })).toEqual(['C']);
    expect(filter({ deadline: 'month' })).toEqual(['C', 'D']);
  });

  it('finds applications without a deadline', () => {
    expect(filter({ deadline: 'none' })).toEqual(['F']);
  });

  it('combines search with filters', () => {
    expect(filter({ query: 'b', country: 'Canada' })).toEqual(['B']);
    expect(filter({ query: 'b', country: 'United States' })).toEqual([]);
  });
});

describe('applyView: funding', () => {
  const rows = (...items: [string, FundingRow['status']][]) =>
    items.map(([application_id, status]) => fakeFunding({ application_id, status }));
  const records = ['won', 'offer', 'hoping', 'applied', 'over', 'nothing', 'floating'].map((name) =>
    fakeRecord({ id: name, university: { name } }),
  );
  const funding = fundingByApplication([
    ...rows(
      ['won', 'accepted'],
      ['offer', 'offered'],
      ['hoping', 'researching'],
      ['hoping', 'rejected'],
      ['applied', 'applied'],
      ['over', 'declined'],
      ['over', 'rejected'],
    ),
    // Funding tied to no program says nothing about any program.
    fakeFunding({ application_id: null, status: 'accepted' }),
  ]);
  const filterWith = (states: FundingStates | undefined, overrides: Partial<ViewState>) =>
    names(applyView(records, view({ sort: 'university', ...overrides }), TODAY, undefined, states));
  const filter = (overrides: Partial<ViewState>) => filterWith(funding, overrides);

  it('finds programs with funding offered or accepted', () => {
    expect(filter({ funding: 'offered' })).toEqual(['offer', 'won']);
  });

  it('finds programs where funding is still a possibility', () => {
    // "hoping" also has a rejected item, but one is still open. "over" has nothing left to pursue.
    expect(filter({ funding: 'pursuing' })).toEqual(['applied', 'hoping']);
  });

  it('finds programs with no funding tracked at all, not just none that is live', () => {
    expect(filter({ funding: 'none' })).toEqual(['floating', 'nothing']);
  });

  it('combines with the other filters', () => {
    expect(filter({ funding: 'none', query: 'noth' })).toEqual(['nothing']);
    expect(filter({ funding: 'offered', status: 'submitted' })).toEqual([]);
  });

  it('changes nothing while the funding is not known, rather than claiming there is none', () => {
    for (const chosen of ['offered', 'pursuing', 'none'] as const) {
      expect(filterWith(undefined, { funding: chosen })).toHaveLength(records.length);
    }
  });

  it('is kept in the address, and unknown values are ignored', () => {
    expect(serializeView(view({ funding: 'offered' })).toString()).toBe('funding=offered');
    expect(parseView(new URLSearchParams('funding=offered')).funding).toBe('offered');
    expect(parseView(new URLSearchParams('funding=everything')).funding).toBeNull();
    expect(FUNDING_FILTERS.map((item) => item.value)).toEqual(['offered', 'pursuing', 'none']);
  });
});

describe('applyView: sorting', () => {
  const sorted = (records: ReturnType<typeof fakeRecord>[], overrides: Partial<ViewState>) =>
    names(applyView(records, view(overrides), TODAY));

  it('sorts by the nearest open deadline, then undated ones, then finished applications', () => {
    const records = [
      fakeRecord({ deadline: null, university: { name: 'undated' } }),
      fakeRecord({
        deadline: '2026-11-01',
        status: 'submitted',
        university: { name: 'submitted' },
      }),
      fakeRecord({ deadline: '2027-01-15', university: { name: 'january' } }),
      fakeRecord({ deadline: '2026-12-10', university: { name: 'december' } }),
      fakeRecord({ deadline: '2026-11-20', university: { name: 'overdue' } }),
    ];
    expect(sorted(records, { sort: 'deadline', direction: 'asc' })).toEqual([
      'overdue',
      'december',
      'january',
      'undated',
      'submitted',
    ]);
    // Reversing puts the furthest deadline first, but undated and finished still sit at the bottom.
    expect(sorted(records, { sort: 'deadline', direction: 'desc' })).toEqual([
      'january',
      'december',
      'overdue',
      'undated',
      'submitted',
    ]);
  });

  it('sorts by university name ignoring case, with numbers in natural order', () => {
    const records = ['beta', 'Alpha', 'Campus 10', 'Campus 2'].map((name) =>
      fakeRecord({ university: { name } }),
    );
    expect(sorted(records, { sort: 'university' })).toEqual([
      'Alpha',
      'beta',
      'Campus 2',
      'Campus 10',
    ]);
    expect(sorted(records, { sort: 'university', direction: 'desc' })).toEqual([
      'Campus 10',
      'Campus 2',
      'beta',
      'Alpha',
    ]);
  });

  it('sorts by workflow status, not alphabetically', () => {
    const records = [
      fakeRecord({ status: 'accepted', university: { name: 'accepted' } }),
      fakeRecord({ status: 'researching', university: { name: 'researching' } }),
      fakeRecord({ status: 'submitted', university: { name: 'submitted' } }),
    ];
    expect(sorted(records, { sort: 'status' })).toEqual(['researching', 'submitted', 'accepted']);
  });

  it('sorts dream, target, safety, and puts unset priorities last either way', () => {
    const records = [
      fakeRecord({ priority: null, university: { name: 'none' } }),
      fakeRecord({ priority: 'safety', university: { name: 'safety' } }),
      fakeRecord({ priority: 'dream', university: { name: 'dream' } }),
      fakeRecord({ priority: 'target', university: { name: 'target' } }),
    ];
    expect(sorted(records, { sort: 'priority', direction: 'asc' })).toEqual([
      'dream',
      'target',
      'safety',
      'none',
    ]);
    expect(sorted(records, { sort: 'priority', direction: 'desc' })).toEqual([
      'safety',
      'target',
      'dream',
      'none',
    ]);
  });

  it('sorts by fee, highest first by default, with unknown fees last', () => {
    const records = [
      fakeRecord({ application_fee: null, university: { name: 'unknown' } }),
      fakeRecord({ application_fee: 75, university: { name: 'cheap' } }),
      fakeRecord({ application_fee: 120, university: { name: 'dear' } }),
    ];
    expect(sorted(records, { sort: 'fee', direction: 'desc' })).toEqual([
      'dear',
      'cheap',
      'unknown',
    ]);
    expect(sorted(records, { sort: 'fee', direction: 'asc' })).toEqual([
      'cheap',
      'dear',
      'unknown',
    ]);
  });

  describe('by completion', () => {
    const records = [
      fakeRecord({ university: { name: 'half' } }),
      fakeRecord({ university: { name: 'none-yet' } }),
      fakeRecord({ university: { name: 'all' } }),
      fakeRecord({ university: { name: 'no-checklist' } }),
      fakeRecord({ university: { name: 'quarter' } }),
      fakeRecord({ university: { name: 'all-optional' } }),
    ];
    const [half, noneYet, all, , quarter, allOptional] = records;
    const completions = new Map([
      [half!.id, { percent: 50 }],
      [noneYet!.id, { percent: 0 }],
      [all!.id, { percent: 100 }],
      [quarter!.id, { percent: 25 }],
      // A checklist with nothing required has no percentage.
      [allOptional!.id, { percent: null }],
    ]);
    const byCompletion = (direction: 'asc' | 'desc') =>
      names(applyView(records, view({ sort: 'completion', direction }), TODAY, completions));

    it('puts the most complete first by default', () => {
      expect(DEFAULT_DIRECTION.completion).toBe('desc');
      expect(byCompletion('desc').slice(0, 4)).toEqual(['all', 'half', 'quarter', 'none-yet']);
    });

    it('puts the least complete first when reversed', () => {
      expect(byCompletion('asc').slice(0, 4)).toEqual(['none-yet', 'quarter', 'half', 'all']);
    });

    it('puts programs without a percentage last either way, in name order', () => {
      expect(byCompletion('desc').slice(4)).toEqual(['all-optional', 'no-checklist']);
      expect(byCompletion('asc').slice(4)).toEqual(['all-optional', 'no-checklist']);
    });

    it('treats every program as having no percentage while progress is unknown', () => {
      expect(names(applyView(records, view({ sort: 'completion' }), TODAY))).toEqual(
        names(applyView(records, view({ sort: 'university' }), TODAY)),
      );
    });

    it('is offered as a sort, and kept in the address', () => {
      expect(SORT_KEYS).toContain('completion');
      expect(SORT_LABELS.completion).toBe('Completion');
      const chosen = view({ sort: 'completion', direction: 'asc' });
      expect(serializeView(chosen).toString()).toBe('sort=completion&dir=asc');
      expect(parseView(new URLSearchParams('sort=completion'))).toMatchObject({
        sort: 'completion',
        direction: 'desc',
      });
    });
  });

  it('sorts by most recently updated', () => {
    const records = [
      fakeRecord({ updated_at: '2026-10-01T00:00:00+00:00', university: { name: 'old' } }),
      fakeRecord({ updated_at: '2026-11-01T00:00:00+00:00', university: { name: 'new' } }),
    ];
    expect(sorted(records, { sort: 'updated', direction: 'desc' })).toEqual(['new', 'old']);
  });

  it('breaks ties by university then program, so the order never jumps around', () => {
    const records = [
      fakeRecord({ deadline: '2026-12-10', program_name: 'B', university: { name: 'Same' } }),
      fakeRecord({ deadline: '2026-12-10', program_name: 'A', university: { name: 'Same' } }),
      fakeRecord({ deadline: '2026-12-10', program_name: 'Z', university: { name: 'Another' } }),
    ];
    const result = applyView(records, view({ sort: 'deadline' }), TODAY);
    expect(result.map((r) => `${r.university.name}/${r.program_name}`)).toEqual([
      'Another/Z',
      'Same/A',
      'Same/B',
    ]);
  });

  it('does not modify the list it is given', () => {
    const records = [
      fakeRecord({ university: { name: 'b' } }),
      fakeRecord({ university: { name: 'a' } }),
    ];
    const before = records.map((r) => r.id);
    applyView(records, view({ sort: 'university' }), TODAY);
    expect(records.map((r) => r.id)).toEqual(before);
  });
});

describe('usedCountries / knownUniversities', () => {
  const stanford = { id: 'u1', name: 'Stanford University', country: 'United States' };
  const records = [
    fakeRecord({ university: stanford }),
    fakeRecord({ program_name: 'Second program', university: stanford, university_id: 'u1' }),
    fakeRecord({ university: { id: 'u2', name: 'McGill University', country: 'Canada' } }),
    fakeRecord({ university: { id: 'u3', name: 'Somewhere', country: null } }),
  ];

  it('lists each country once, alphabetically, without blanks', () => {
    expect(usedCountries(records)).toEqual(['Canada', 'United States']);
  });

  it('lists a country once however it is capitalised', () => {
    const mixed = [
      fakeRecord({ university: { id: 'u1', name: 'A', country: 'United States' } }),
      fakeRecord({ university: { id: 'u2', name: 'B', country: 'united states' } }),
      fakeRecord({ university: { id: 'u3', name: 'C', country: 'Canada' } }),
    ];
    expect(usedCountries(mixed)).toEqual(['Canada', 'United States']);
  });

  it('lists each university once even when it has several programs', () => {
    expect(knownUniversities(records).map((u) => u.name)).toEqual([
      'McGill University',
      'Somewhere',
      'Stanford University',
    ]);
  });
});
