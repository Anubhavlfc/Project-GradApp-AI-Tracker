import type { SupabaseClient } from '@supabase/supabase-js';

// A stand-in for the small part of the Supabase query builder that the data APIs use, backed by
// in-memory tables. It mimics the database rules that matter to that code: the unique university
// name, the foreign keys (each with its delete cascade), the "one per pair" rules, and PostgREST's
// "one row expected" errors. It is not PostgREST; the real thing is exercised in the browser tests.

type Row = Record<string, unknown>;
export type PgError = { code: string; message: string; details?: string; hint?: string };
type Result = { data: unknown; error: PgError | null };
type Operation = 'select' | 'insert' | 'update' | 'delete';

const EMBED = 'university:universities(*)';
const nameKey = (name: unknown) => String(name).trim().toLowerCase();

const TABLE_NAMES = [
  'universities',
  'applications',
  'requirements',
  'recommenders',
  'recommendation_requests',
  'funding',
  'documents',
] as const;
type TableName = (typeof TABLE_NAMES)[number];

/** What the database fills in when an insert leaves a column out. */
const DEFAULTS: Partial<Record<TableName, Row>> = {
  applications: {
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
  },
  requirements: {
    label: null,
    is_required: true,
    status: 'not_started',
    due_date: null,
    document_id: null,
    notes: null,
  },
  funding: {
    application_id: null,
    amount: null,
    currency: 'USD',
    deadline: null,
    application_required: false,
    status: 'researching',
    url: null,
    notes: null,
  },
  documents: { status: 'not_started', url: null, notes: null },
  recommenders: { title: null, institution: null, email: null, notes: null },
  recommendation_requests: {
    status: 'not_requested',
    requested_on: null,
    deadline: null,
    notes: null,
  },
};

/** Foreign keys: an insert must point at a row that exists (unless the column may be empty). */
type Parent = { column: string; parent: TableName; nullable?: boolean };
const PARENTS: Partial<Record<TableName, Parent[]>> = {
  requirements: [
    { column: 'application_id', parent: 'applications' },
    { column: 'document_id', parent: 'documents', nullable: true },
  ],
  recommendation_requests: [
    { column: 'recommender_id', parent: 'recommenders' },
    { column: 'application_id', parent: 'applications' },
  ],
  funding: [{ column: 'application_id', parent: 'applications', nullable: true }],
};

/** Columns that are unique together. */
const UNIQUE: Partial<Record<TableName, string[][]>> = {
  recommendation_requests: [['recommender_id', 'application_id']],
};

/** Deleting a row in `parent` deletes the rows of `child` that point at it through `column`. */
const CASCADES: [parent: TableName, child: TableName, column: string][] = [
  ['applications', 'requirements', 'application_id'],
  ['applications', 'recommendation_requests', 'application_id'],
  ['recommenders', 'recommendation_requests', 'recommender_id'],
  ['applications', 'funding', 'application_id'],
];

/** Deleting a row in `parent` empties the `column` of the `child` rows that point at it. */
const SET_NULLS: [parent: TableName, child: TableName, column: string][] = [
  ['documents', 'requirements', 'document_id'],
];

export function createFakeSupabase(seed: Partial<Record<TableName, Row[]>> = {}) {
  const tables = Object.fromEntries(
    TABLE_NAMES.map((name) => [name, (seed[name] ?? []).map((row) => ({ ...row }))]),
  ) as Record<TableName, Row[]>;
  /** Every request made, as "select applications", for asserting what was (not) touched. */
  const requests: string[] = [];
  const failures: { table: string; operation: Operation; error: PgError }[] = [];
  const interruptions: { table: string; operation: Operation; run: () => void }[] = [];
  let sequence = 0;

  function project(table: string, row: Row, columns: string): Row {
    if (columns.includes(EMBED) && table === 'applications') {
      const university = tables.universities.find((u) => u.id === row.university_id);
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

    constructor(private readonly table: TableName) {}

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

      const rows = tables[this.table];
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
            ...DEFAULTS[this.table],
            ...payload,
            created_at: now,
            updated_at: now,
          };
        });
        rows.push(...affected);
      } else if (this.operation === 'update') {
        affected = matching();
        // A column that points at another table must keep pointing at a row that exists.
        const broken = this.brokenParent(this.payload as Row);
        if (broken) return { data: null, error: broken };
        for (const row of affected)
          Object.assign(row, this.payload as Row, { updated_at: new Date().toISOString() });
      } else if (this.operation === 'delete') {
        affected = matching();
        if (this.table === 'universities') {
          const inUse = affected.some((u) =>
            tables.applications.some((a) => a.university_id === u.id),
          );
          if (inUse) {
            return {
              data: null,
              error: { code: '23503', message: 'violates foreign key constraint' },
            };
          }
        }
        tables[this.table] = rows.filter((row) => !affected.includes(row));
        // What hangs off a deleted row goes with it, as in the database.
        const gone = new Set(affected.map((row) => row.id));
        for (const [parent, child, column] of CASCADES) {
          if (parent !== this.table) continue;
          tables[child] = tables[child].filter((row) => !gone.has(row[column]));
        }
        for (const [parent, child, column] of SET_NULLS) {
          if (parent !== this.table) continue;
          for (const row of tables[child]) if (gone.has(row[column])) row[column] = null;
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

    /** The rule an insert would break, if any: a taken name, a repeated pair, or a missing parent. */
    private violationOf(payload: Row, rows: Row[]): PgError | null {
      const taken = {
        code: '23505',
        message: 'duplicate key value violates unique constraint',
      };
      if (
        this.table === 'universities' &&
        rows.some((r) => nameKey(r.name) === nameKey(payload.name))
      ) {
        return taken;
      }
      for (const columns of UNIQUE[this.table] ?? []) {
        if (rows.some((row) => columns.every((column) => row[column] === payload[column]))) {
          return taken;
        }
      }
      return this.brokenParent(payload, true);
    }

    /** The error for a foreign key in `payload` that points nowhere. `whole` = every key is needed. */
    private brokenParent(payload: Row, whole = false): PgError | null {
      for (const { column, parent, nullable } of PARENTS[this.table] ?? []) {
        if (!whole && !(column in payload)) continue;
        if (nullable && (payload[column] === null || payload[column] === undefined)) continue;
        if (!tables[parent].some((row) => row.id === payload[column])) {
          return { code: '23503', message: 'violates foreign key constraint' };
        }
      }
      return null;
    }
  }

  return {
    client: { from: (table: TableName) => new Query(table) } as unknown as SupabaseClient,
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
