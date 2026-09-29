import { formatMoney, parseAmount, summarizeCosts, type CostFields } from './money';

describe('formatMoney', () => {
  it('drops the cents from whole amounts and keeps them otherwise', () => {
    expect(formatMoney(90, 'USD')).toBe('$90');
    expect(formatMoney(90.5, 'USD')).toBe('$90.50');
    expect(formatMoney(1200, 'USD')).toBe('$1,200');
  });

  it('marks other currencies so they are not mistaken for dollars', () => {
    expect(formatMoney(120, 'CAD')).toBe('CA$120');
    expect(formatMoney(75, 'GBP')).toBe('£75');
  });

  it('never throws on an odd currency code', () => {
    expect(formatMoney(10, 'us')).toBe('10 us');
  });
});

describe('parseAmount', () => {
  it.each([
    ['90', 90],
    ['90.5', 90.5],
    ['90.50', 90.5],
    ['0', 0],
    ['1200', 1200],
    ['1,200', 1200],
    ['1,200.75', 1200.75],
    ['  75  ', 75],
    ['1000000', 1_000_000],
  ])('reads %j as %d', (text, value) => {
    expect(parseAmount(text)).toEqual({ ok: true, value });
  });

  it('treats empty text as "no amount"', () => {
    expect(parseAmount('')).toEqual({ ok: true, value: null });
    expect(parseAmount('   ')).toEqual({ ok: true, value: null });
  });

  it.each(['abc', '-5', '$90', '90,50', '1,20', '90.555', '1.', '.5', '1e3', '1000001'])(
    'refuses %j rather than guessing',
    (text) => {
      expect(parseAmount(text)).toEqual({ ok: false });
    },
  );
});

describe('summarizeCosts', () => {
  const app = (overrides: Partial<CostFields>): CostFields => ({
    status: 'planning_to_apply',
    application_fee: 100,
    fee_currency: 'USD',
    fee_paid_on: null,
    fee_waiver_status: 'not_requested',
    ...overrides,
  });

  it('is empty when nothing has a fee', () => {
    expect(summarizeCosts([])).toEqual([]);
    expect(summarizeCosts([app({ application_fee: null }), app({ application_fee: 0 })])).toEqual(
      [],
    );
  });

  it('splits fees into paid and remaining', () => {
    expect(
      summarizeCosts([
        app({ application_fee: 90, fee_paid_on: '2026-11-01', status: 'submitted' }),
        app({ application_fee: 110 }),
        app({ application_fee: 75.5 }),
      ]),
    ).toEqual([{ currency: 'USD', total: 275.5, paid: 90, remaining: 185.5, waived: 0 }]);
  });

  it('does not charge for a granted waiver, and reports what it saved', () => {
    expect(
      summarizeCosts([
        app({ application_fee: 100 }),
        app({ application_fee: 120, fee_waiver_status: 'granted' }),
      ]),
    ).toEqual([{ currency: 'USD', total: 100, paid: 0, remaining: 100, waived: 120 }]);
  });

  it('still charges when a waiver was only requested or was denied', () => {
    const [summary] = summarizeCosts([
      app({ application_fee: 100, fee_waiver_status: 'requested' }),
      app({ application_fee: 50, fee_waiver_status: 'denied' }),
    ]);
    expect(summary?.remaining).toBe(150);
  });

  it('leaves out an unpaid fee for a withdrawn application, but keeps money already spent', () => {
    expect(
      summarizeCosts([
        app({ application_fee: 100, status: 'withdrawn' }),
        app({ application_fee: 80, status: 'withdrawn', fee_paid_on: '2026-10-01' }),
      ]),
    ).toEqual([{ currency: 'USD', total: 80, paid: 80, remaining: 0, waived: 0 }]);
  });

  it('keeps currencies apart, in a stable order', () => {
    expect(
      summarizeCosts([
        app({ application_fee: 60, fee_currency: 'GBP' }),
        app({ application_fee: 100 }),
        app({ application_fee: 20, fee_currency: 'GBP' }),
      ]),
    ).toEqual([
      { currency: 'GBP', total: 80, paid: 0, remaining: 80, waived: 0 },
      { currency: 'USD', total: 100, paid: 0, remaining: 100, waived: 0 },
    ]);
  });

  it('adds cents exactly', () => {
    const [summary] = summarizeCosts([
      app({ application_fee: 0.1 }),
      app({ application_fee: 0.2 }),
    ]);
    expect(summary?.total).toBe(0.3);
  });
});
