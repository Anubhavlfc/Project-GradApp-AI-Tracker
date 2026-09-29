import { fakeFunding } from '@/test/fakeFundingApi';
import { permutations } from '@/test/permutations';
import {
  describeMoney,
  describeProgramFunding,
  fundingByApplication,
  fundingDue,
  hasTotals,
  sortFunding,
  sumByCurrency,
  summarizeProgramFunding,
  totalFunding,
} from './logic';

const TODAY = '2026-10-01';

describe('sumByCurrency', () => {
  it('adds amounts per currency and never mixes currencies', () => {
    const totals = sumByCurrency([
      fakeFunding({ amount: 20_000, currency: 'USD' }),
      fakeFunding({ amount: 5_000, currency: 'GBP' }),
      fakeFunding({ amount: 10_000, currency: 'USD' }),
    ]);
    expect(totals).toEqual([
      { currency: 'GBP', amount: 5_000 },
      { currency: 'USD', amount: 30_000 },
    ]);
  });

  it('ignores items without an amount', () => {
    expect(
      sumByCurrency([fakeFunding({ amount: null }), fakeFunding({ amount: 100, currency: 'USD' })]),
    ).toEqual([{ currency: 'USD', amount: 100 }]);
  });

  it('adds in cents, so small amounts do not pick up rounding errors', () => {
    const totals = sumByCurrency([fakeFunding({ amount: 0.1 }), fakeFunding({ amount: 0.2 })]);
    expect(totals).toEqual([{ currency: 'USD', amount: 0.3 }]);
  });

  it('rounds each amount to the nearest cent, not down', () => {
    // 19.99 * 100 is 1998.9999999999998 in floating point: cutting it off would lose a cent.
    const totals = sumByCurrency([fakeFunding({ amount: 19.99 }), fakeFunding({ amount: 0.01 })]);
    expect(totals).toEqual([{ currency: 'USD', amount: 20 }]);
  });

  it('leaves out a currency whose total is zero', () => {
    expect(sumByCurrency([fakeFunding({ amount: 0, currency: 'EUR' })])).toEqual([]);
    expect(sumByCurrency([])).toEqual([]);
  });
});

describe('describeMoney', () => {
  it('writes one amount plainly and several with a plus', () => {
    expect(describeMoney([{ currency: 'USD', amount: 20_000 }])).toBe('$20,000');
    expect(
      describeMoney([
        { currency: 'GBP', amount: 5_000 },
        { currency: 'USD', amount: 20_000.5 },
      ]),
    ).toBe('£5,000 + $20,000.50');
    expect(describeMoney([])).toBe('');
  });
});

describe('totalFunding', () => {
  const rows = [
    fakeFunding({ status: 'accepted', amount: 1_000 }),
    fakeFunding({ status: 'offered', amount: 200 }),
    fakeFunding({ status: 'applied', amount: 30 }),
    // None of these are money you have, were offered, or are waiting on.
    fakeFunding({ status: 'researching', amount: 4_000_000 }),
    fakeFunding({ status: 'applying', amount: 50_000 }),
    fakeFunding({ status: 'declined', amount: 600_000 }),
    fakeFunding({ status: 'rejected', amount: 7_000_000 }),
  ];

  it('counts accepted, offered, and applied-for money separately, and nothing else', () => {
    expect(totalFunding(rows)).toEqual({
      accepted: [{ currency: 'USD', amount: 1_000 }],
      offered: [{ currency: 'USD', amount: 200 }],
      waiting: [{ currency: 'USD', amount: 30 }],
    });
  });

  it('says whether there is anything to show', () => {
    expect(hasTotals(totalFunding(rows))).toBe(true);
    expect(hasTotals(totalFunding([]))).toBe(false);
    expect(hasTotals(totalFunding([fakeFunding({ status: 'accepted', amount: null })]))).toBe(
      false,
    );
    expect(hasTotals(totalFunding([fakeFunding({ status: 'researching', amount: 5 })]))).toBe(
      false,
    );
  });
});

describe('summarizeProgramFunding', () => {
  it('counts the items and tells whether any is an offer or still a possibility', () => {
    const summary = summarizeProgramFunding([
      fakeFunding({ status: 'offered', amount: 100 }),
      fakeFunding({ status: 'accepted', amount: 200 }),
      fakeFunding({ status: 'applied' }),
      fakeFunding({ status: 'declined' }),
    ]);
    expect(summary).toMatchObject({
      count: 4,
      acceptedCount: 1,
      offeredCount: 1,
      pursuingCount: 1,
      hasOffer: true,
      pursuing: true,
      accepted: [{ currency: 'USD', amount: 200 }],
      offered: [{ currency: 'USD', amount: 100 }],
    });
  });

  it('is neither an offer nor a possibility when everything was turned down', () => {
    const summary = summarizeProgramFunding([
      fakeFunding({ status: 'declined' }),
      fakeFunding({ status: 'rejected' }),
    ]);
    expect(summary).toMatchObject({ count: 2, hasOffer: false, pursuing: false });
  });

  it('counts an item being researched or applied for as a possibility', () => {
    for (const status of ['researching', 'applying', 'applied'] as const) {
      expect(summarizeProgramFunding([fakeFunding({ status })])).toMatchObject({
        pursuing: true,
        hasOffer: false,
      });
    }
  });
});

describe('fundingByApplication', () => {
  it('groups by program and leaves out funding that is tied to none', () => {
    const byApplication = fundingByApplication([
      fakeFunding({ application_id: 'a', status: 'offered' }),
      fakeFunding({ application_id: 'a', status: 'researching' }),
      fakeFunding({ application_id: 'b', status: 'declined' }),
      fakeFunding({ application_id: null, status: 'accepted' }),
    ]);
    expect([...byApplication.keys()].sort()).toEqual(['a', 'b']);
    expect(byApplication.get('a')).toMatchObject({ count: 2, hasOffer: true, pursuing: true });
    expect(byApplication.get('b')).toMatchObject({ count: 1, hasOffer: false, pursuing: false });
    expect(byApplication.get('c')).toBeUndefined();
  });
});

describe('describeProgramFunding', () => {
  const describe1 = (...rows: Parameters<typeof fakeFunding>[0][]) =>
    describeProgramFunding(summarizeProgramFunding(rows.map((row) => fakeFunding(row))));

  it('leads with what you have accepted, with the money', () => {
    expect(
      describe1(
        { status: 'accepted', amount: 20_000 },
        { status: 'offered', amount: 5_000 },
        { status: 'researching' },
      ),
    ).toEqual({ label: 'Accepted', amount: '$20,000', tone: 'green' });
  });

  it('then what you have been offered', () => {
    expect(describe1({ status: 'offered', amount: 5_000 }, { status: 'applied' })).toEqual({
      label: 'Offered',
      amount: '$5,000',
      tone: 'violet',
    });
  });

  it('gives no amount when the offer has none', () => {
    expect(describe1({ status: 'offered', amount: null })).toEqual({
      label: 'Offered',
      amount: null,
      tone: 'violet',
    });
  });

  it('then how many are still possible', () => {
    expect(
      describe1({ status: 'researching' }, { status: 'applied' }, { status: 'declined' }),
    ).toEqual({ label: '2 being pursued', amount: null, tone: 'neutral' });
  });

  it('and says so when nothing is left', () => {
    expect(describe1({ status: 'rejected' }, { status: 'declined' })).toEqual({
      label: 'None available',
      amount: null,
      tone: 'neutral',
    });
  });
});

describe('fundingDue', () => {
  it('has nothing to say without a deadline', () => {
    expect(fundingDue({ deadline: null, status: 'applying' }, null, TODAY)).toMatchObject({
      state: 'none',
      text: null,
    });
  });

  it('counts down to a deadline you can still apply by', () => {
    for (const status of ['researching', 'applying'] as const) {
      expect(fundingDue({ deadline: '2026-10-11', status }, null, TODAY)).toMatchObject({
        state: 'soon',
        days: 10,
        text: 'In 10 days',
      });
    }
  });

  it('calls a missed deadline overdue while you could still have applied', () => {
    expect(fundingDue({ deadline: '2026-09-28', status: 'applying' }, null, TODAY)).toMatchObject({
      state: 'overdue',
      text: '3 days overdue',
      tone: 'red',
    });
  });

  it('is history once you have applied or heard back, never overdue', () => {
    for (const status of ['applied', 'offered', 'accepted', 'declined', 'rejected'] as const) {
      expect(fundingDue({ deadline: '2026-09-01', status }, null, TODAY)).toMatchObject({
        state: 'closed',
        text: null,
      });
    }
  });

  it('is history when the program was rejected or withdrawn', () => {
    for (const program of ['rejected', 'withdrawn'] as const) {
      expect(
        fundingDue({ deadline: '2026-11-01', status: 'applying' }, program, TODAY),
      ).toMatchObject({ state: 'closed', text: null });
    }
  });

  it('stays open when the program is only submitted or accepted: a scholarship can be due later', () => {
    for (const program of ['submitted', 'accepted', 'researching'] as const) {
      expect(
        fundingDue({ deadline: '2026-11-01', status: 'applying' }, program, TODAY),
      ).toMatchObject({ state: 'upcoming', days: 31, text: 'In 31 days' });
    }
  });
});

describe('sortFunding', () => {
  it('puts what you can still apply for first, soonest deadline first, no deadline last', () => {
    const none = fakeFunding({ status: 'researching', deadline: null, name: 'A' });
    const december = fakeFunding({ status: 'applying', deadline: '2026-12-01' });
    const november = fakeFunding({ status: 'researching', deadline: '2026-11-15' });
    const sorted = sortFunding([none, december, november]);
    expect(sorted).toEqual([november, december, none]);
  });

  it('then the rest, offers before everything else', () => {
    const rows = [
      fakeFunding({ status: 'offered', name: 'offered' }),
      fakeFunding({ status: 'accepted', name: 'accepted' }),
      fakeFunding({ status: 'applied', name: 'applied' }),
      fakeFunding({ status: 'declined', name: 'declined' }),
      fakeFunding({ status: 'rejected', name: 'rejected' }),
    ];
    const open = fakeFunding({ status: 'applying', name: 'open', deadline: '2027-01-01' });
    for (const arrival of permutations([open, ...rows])) {
      expect(sortFunding(arrival).map((row) => row.name)).toEqual([
        'open',
        'offered',
        'accepted',
        'applied',
        'declined',
        'rejected',
      ]);
    }
  });

  it('gives the same order whatever order the items arrive in', () => {
    const expected = [
      fakeFunding({ status: 'researching', deadline: '2026-11-15', name: 'Abe' }),
      fakeFunding({ status: 'applying', deadline: '2026-12-01', name: 'Bea' }),
      fakeFunding({ status: 'applying', deadline: null, name: 'Cy' }),
      fakeFunding({ status: 'researching', deadline: null, name: 'Di' }),
      fakeFunding({ status: 'offered', deadline: '2026-09-01', name: 'Eve' }),
      fakeFunding({ status: 'offered', deadline: null, name: 'Fay' }),
    ];
    for (const arrival of permutations(expected)) {
      expect(sortFunding(arrival)).toEqual(expected);
    }
  });

  it('breaks ties by name, then by when the item was added, and does not touch its input', () => {
    const bea = fakeFunding({ name: 'Bea', deadline: '2026-12-01' });
    const abe = fakeFunding({ name: 'Abe', deadline: '2026-12-01' });
    const abeTwin = fakeFunding({
      name: 'abe',
      deadline: '2026-12-01',
      created_at: '2026-09-05T00:00:00+00:00',
    });
    const input = [bea, abeTwin, abe];
    expect(sortFunding(input)).toEqual([abe, abeTwin, bea]);
    expect(input).toEqual([bea, abeTwin, abe]);
  });
});
