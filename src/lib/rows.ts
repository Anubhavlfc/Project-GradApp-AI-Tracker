/** The list with `row` in place of the one that has its id, or added at the end when new. */
export function upsertRow<T extends { id: string }>(rows: T[], row: T): T[] {
  return rows.some((item) => item.id === row.id)
    ? rows.map((item) => (item.id === row.id ? row : item))
    : [...rows, row];
}
