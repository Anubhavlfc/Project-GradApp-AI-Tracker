import type { SupabaseClient } from '@supabase/supabase-js';

// A stand-in for the small part of the Supabase query builder that the applications API uses,
// backed by two in-memory tables. It mimics the database rules that matter to that code: the
// unique university name, the foreign key from applications to universities, and PostgREST's
// "one row expected" errors. It is not PostgREST; the real thing is exercised in the browser tests.

type Row = Record<string, unknown>;
export type PgError = { code: string; message: string; details?: string; hint?: string };
type Result = { data: unknown; error: PgError | null };
type Operation = 'select' | 'insert' | 'update' | 'delete';

const EMBED = 'university:universities(*)';
const nameKey = (name: unknown) => String(name).trim().toLowerCase();

export function createFakeSupabase(seed: { universities?: Row[]; applications?: Row[] } = {}) {
  const tables: Record<string, Row[]> = {
    universities: (seed.universities ?? []).map((row) => ({ ...row })),
    applications: (seed.applications ?? []).map((row) => ({ ...row })),
  };
  /** Every request made, as "select applications", for asserting what was (not) touched. */
  const requests: string[] = [];
  const failures: { table: string; operation: Operation; error: PgError }[] = [];
  const interruptions: { table: string; operation: Operation; run: () => void }[] = [];
  let sequence = 0;

  function project(table: string, row: Row, columns: string): Row {
    if (columns.includes(EMBED) && table === 'applications') {
      const university = tables.universities!.find((u) => u.id === row.university_id);
      return { ...row, university: university ? { ...university } : null };
    }
    if (columns.trim() === '*' || columns.trim() === '') return { ...row };
    return Object.fromEntries(columns.split(',').map((name) => [name.trim(), row[name.trim()]]));
  }

  class Query implements PromiseLike<Result> {
    private operation: Operation = 'select';
    private payload: Row = {};
    private filters: [string, unknown][] = [];
    private columns = '*';
    private returning = false;
    private cardinality: 'many' | 'single' | 'maybe' = 'many';
    private max = Infinity;

    constructor(private readonly table: string) {}

    select(columns = '*') {
      this.columns = columns;
      if (this.operation !== 'select') this.returning = true;
      return this;
    }
    insert(payload: Row) {
      this.operation = 'insert';
      this.payload = payload;
      return this;
    }
    update(payload: Row) {
      this.operation = 'update';
      this.payload = payload;
      return this;
    }
    delete() {
      this.operation = 'delete';
      return this;
    }
    eq(column: string, value: unknown) {
      this.filters.push([column, value]);
      return this;
    }
    order() {
      return this; // rows are kept in creation order already
    }
    limit(count: number) {
      this.max = count;
      return this;
    }
    single() {
      this.cardinality = 'single';
      return this;
    }
    maybeSingle() {
      this.cardinality = 'maybe';
      return this;
    }

    then<A = Result, B = never>(
      onfulfilled?: ((value: Result) => A | PromiseLike<A>) | null,
      onrejected?: ((reason: unknown) => B | PromiseLike<B>) | null,
    ): PromiseLike<A | B> {
      return Promise.resolve(this.run()).then(onfulfilled, onrejected);
    }

    private run(): Result {
      requests.push(`${this.operation} ${this.table}`);
      const interruption = interruptions.findIndex(
        (i) => i.table === this.table && i.operation === this.operation,
      );
      if (interruption >= 0) interruptions.splice(interruption, 1)[0]!.run();
      const failure = failures.findIndex(
        (f) => f.table === this.table && f.operation === this.operation,
      );
      if (failure >= 0) return { data: null, error: failures.splice(failure, 1)[0]!.error };

      const rows = tables[this.table]!;
      const matching = () =>
        rows.filter((row) => this.filters.every(([column, value]) => row[column] === value));

      let affected: Row[];
      if (this.operation === 'insert') {
        if (this.table === 'universities') {
          if (rows.some((row) => nameKey(row.name) === nameKey(this.payload.name))) {
            return {
              data: null,
              error: { code: '23505', message: 'duplicate key value violates unique constraint' },
            };
          }
        }
        sequence += 1;
        const now = new Date().toISOString();
        const row: Row = {
          id: `${this.table}-${sequence}`,
          ...(this.table === 'applications' ? this.defaultApplication() : {}),
          ...this.payload,
          created_at: now,
          updated_at: now,
        };
        rows.push(row);
        affected = [row];
      } else if (this.operation === 'update') {
        affected = matching();
        for (const row of affected)
          Object.assign(row, this.payload, { updated_at: new Date().toISOString() });
      } else if (this.operation === 'delete') {
        affected = matching();
        if (this.table === 'universities') {
          const inUse = affected.some((u) =>
            tables.applications!.some((a) => a.university_id === u.id),
          );
          if (inUse) {
            return {
              data: null,
              error: { code: '23503', message: 'violates foreign key constraint' },
            };
          }
        }
        tables[this.table] = rows.filter((row) => !affected.includes(row));
      } else {
        affected = matching().slice(0, this.max);
      }

      const wantsRows = this.operation === 'select' || this.returning;
      if (!wantsRows) return { data: null, error: null };
      const projected = affected.map((row) => project(this.table, row, this.columns));
      if (this.cardinality === 'many') return { data: projected, error: null };
      if (projected.length === 1) return { data: projected[0], error: null };
      if (projected.length === 0 && this.cardinality === 'maybe')
        return { data: null, error: null };
      return {
        data: null,
        error: {
          code: 'PGRST116',
          message: 'JSON object requested, multiple (or no) rows returned',
        },
      };
    }

    private defaultApplication(): Row {
      return {
        school_college: null,
        department: null,
        degree_level: 'masters',
        degree_type: null,
        program_url: null,
        program_length_months: null,
        is_stem: false,
        status: 'researching',
        priority: null,
        is_favorite: false,
        deadline: null,
        priority_deadline: null,
        portal_url: null,
        interview_at: null,
        submitted_on: null,
        application_fee: null,
        fee_currency: 'USD',
        fee_waiver_available: false,
        fee_waiver_status: 'not_requested',
        fee_paid_on: null,
        decision_received_on: null,
        decision_deadline: null,
        enrollment_deposit: null,
        is_final_choice: false,
        notes: null,
      };
    }
  }

  return {
    client: { from: (table: string) => new Query(table) } as unknown as SupabaseClient,
    tables,
    requests,
    /** Run `run` just before the next matching request: someone else getting in first. */
    beforeNext(table: 'universities' | 'applications', operation: Operation, run: () => void) {
      interruptions.push({ table, operation, run });
    },
    /** Make the next matching request fail with this error. */
    failNext(table: 'universities' | 'applications', operation: Operation, error: PgError) {
      failures.push({ table, operation, error });
    },
  };
}
