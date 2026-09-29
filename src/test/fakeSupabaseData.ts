import type { SupabaseClient } from '@supabase/supabase-js';

// A stand-in for the small part of the Supabase query builder that the data APIs use, backed by
// three in-memory tables. It mimics the database rules that matter to that code: the unique
// university name, the foreign keys (applications to universities, requirements to applications,
// with the delete cascade), and PostgREST's "one row expected" errors. It is not PostgREST; the
// real thing is exercised in the browser tests.

type Row = Record<string, unknown>;
export type PgError = { code: string; message: string; details?: string; hint?: string };
type Result = { data: unknown; error: PgError | null };
type Operation = 'select' | 'insert' | 'update' | 'delete';

const EMBED = 'university:universities(*)';
const nameKey = (name: unknown) => String(name).trim().toLowerCase();

type TableName = 'universities' | 'applications' | 'requirements';

export function createFakeSupabase(
  seed: { universities?: Row[]; applications?: Row[]; requirements?: Row[] } = {},
) {
  const tables: Record<string, Row[]> = {
    universities: (seed.universities ?? []).map((row) => ({ ...row })),
    applications: (seed.applications ?? []).map((row) => ({ ...row })),
    requirements: (seed.requirements ?? []).map((row) => ({ ...row })),
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
    private payload: Row | Row[] = {};
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
    insert(payload: Row | Row[]) {
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
        const payloads = Array.isArray(this.payload) ? this.payload : [this.payload];
        // All or nothing, like one SQL statement: check every row before adding any.
        for (const payload of payloads) {
          const violation = this.violationOf(payload, rows);
          if (violation) return { data: null, error: violation };
        }
        const now = new Date().toISOString();
        affected = payloads.map((payload) => {
          sequence += 1;
          return {
            id: `${this.table}-${sequence}`,
            ...(this.table === 'applications' ? this.defaultApplication() : {}),
            ...(this.table === 'requirements' ? this.defaultRequirement() : {}),
            ...payload,
            created_at: now,
            updated_at: now,
          };
        });
        rows.push(...affected);
      } else if (this.operation === 'update') {
        affected = matching();
        for (const row of affected)
          Object.assign(row, this.payload as Row, { updated_at: new Date().toISOString() });
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
        if (this.table === 'applications') {
          // A program's checklist goes with it, as in the database.
          const gone = new Set(affected.map((application) => application.id));
          tables.requirements = tables.requirements!.filter(
            (requirement) => !gone.has(requirement.application_id),
          );
        }
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

    /** The rule an insert would break, if any: a taken university name, or a program that isn't there. */
    private violationOf(payload: Row, rows: Row[]): PgError | null {
      if (
        this.table === 'universities' &&
        rows.some((r) => nameKey(r.name) === nameKey(payload.name))
      ) {
        return { code: '23505', message: 'duplicate key value violates unique constraint' };
      }
      if (
        this.table === 'requirements' &&
        !tables.applications!.some((application) => application.id === payload.application_id)
      ) {
        return { code: '23503', message: 'violates foreign key constraint' };
      }
      return null;
    }

    private defaultRequirement(): Row {
      return {
        label: null,
        is_required: true,
        status: 'not_started',
        due_date: null,
        document_id: null,
        notes: null,
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
    beforeNext(table: TableName, operation: Operation, run: () => void) {
      interruptions.push({ table, operation, run });
    },
    /** Make the next matching request fail with this error. */
    failNext(table: TableName, operation: Operation, error: PgError) {
      failures.push({ table, operation, error });
    },
  };
}
