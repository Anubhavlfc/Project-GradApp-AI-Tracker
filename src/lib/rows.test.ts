import { upsertRow } from './rows';

describe('upsertRow', () => {
  it('replaces the row that has the same id, keeping its place', () => {
    const rows = [
      { id: 'a', name: 'first' },
      { id: 'b', name: 'second' },
    ];
    expect(upsertRow(rows, { id: 'a', name: 'changed' })).toEqual([
      { id: 'a', name: 'changed' },
      { id: 'b', name: 'second' },
    ]);
  });

  it('adds a new row at the end', () => {
    expect(upsertRow([{ id: 'a' }], { id: 'b' })).toEqual([{ id: 'a' }, { id: 'b' }]);
  });

  it('does not change the list it was given', () => {
    const rows = [{ id: 'a', name: 'first' }];
    upsertRow(rows, { id: 'a', name: 'changed' });
    upsertRow(rows, { id: 'b', name: 'new' });
    expect(rows).toEqual([{ id: 'a', name: 'first' }]);
  });
});
