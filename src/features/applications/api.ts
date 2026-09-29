import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { createGuard, parseRows as parse } from '@/lib/dataApi';
import { DataError } from '@/lib/dataError';
import { logError } from '@/lib/log';
import type { ApplicationStatus } from './status';
import {
  applicationRecordSchema,
  universityRowSchema,
  type ApplicationInput,
  type ApplicationRecord,
  type UniversityInput,
  type UniversityRow,
} from './types';

/** Everything the screens need from the database about applications. */
export interface ApplicationsApi {
  list(): Promise<ApplicationRecord[]>;
  create(input: ApplicationInput): Promise<ApplicationRecord>;
  update(id: string, input: ApplicationInput): Promise<ApplicationRecord>;
  /** `submittedOn` is stored alongside when the status change is the act of submitting. */
  setStatus(id: string, status: ApplicationStatus, submittedOn?: string): Promise<void>;
  setFavorite(id: string, isFavorite: boolean): Promise<void>;
  /** Saves only the program's notes (null clears them) and returns the program as stored. */
  setNotes(id: string, notes: string | null): Promise<ApplicationRecord>;
  /** Deleting something that is already gone counts as success. */
  remove(id: string): Promise<void>;
}

// One request returns each application together with its university.
const RECORD_SELECT = '*, university:universities(*)';

/** Two spellings are the same university if they differ only by capitals or spacing. */
export function universityKey(name: string): string {
  return name.trim().replace(/\s+/g, ' ').toLowerCase();
}

const guard = createGuard('applications');

const universityFields = ['city', 'region', 'country', 'website_url'] as const;

export function createApplicationsApi(client: SupabaseClient): ApplicationsApi {
  async function findUniversity(name: string): Promise<UniversityRow | undefined> {
    const { data, error } = await client.from('universities').select('*');
    if (error) throw error;
    const key = universityKey(name);
    return parse(z.array(universityRowSchema), data).find((row) => universityKey(row.name) === key);
  }

  /**
   * A university may be shared by several programs. When the typed name matches one you already
   * have, that one is reused and only its blanks are filled in or corrected: leaving a field empty
   * never erases what another program's form saved.
   */
  async function updateUniversity(
    existing: UniversityRow,
    input: UniversityInput,
  ): Promise<UniversityRow> {
    const changes: Partial<UniversityInput> = {};
    for (const field of universityFields) {
      const value = input[field];
      if (value !== null && value !== existing[field]) changes[field] = value;
    }
    if (Object.keys(changes).length === 0) return existing;
    const { data, error } = await client
      .from('universities')
      .update(changes)
      .eq('id', existing.id)
      .select()
      .single();
    if (error) throw error;
    return parse(universityRowSchema, data);
  }

  async function resolveUniversity(input: UniversityInput) {
    const existing = await findUniversity(input.name);
    if (existing) return { university: await updateUniversity(existing, input), created: false };

    const { data, error } = await client.from('universities').insert(input).select().single();
    if (error?.code === '23505') {
      // Another tab added the same university a moment ago: use theirs.
      const raced = await findUniversity(input.name);
      if (raced) return { university: await updateUniversity(raced, input), created: false };
    }
    if (error) throw error;
    return { university: parse(universityRowSchema, data), created: true };
  }

  /** Removes a university nobody uses any more. Best effort: the database refuses if it is in use. */
  async function pruneUniversity(id: string): Promise<void> {
    try {
      const { data, error } = await client
        .from('applications')
        .select('id')
        .eq('university_id', id)
        .limit(1);
      if (error || (data && data.length > 0)) return;
      await client.from('universities').delete().eq('id', id);
    } catch (error) {
      logError('applications.pruneUniversity', error);
    }
  }

  return {
    list: () =>
      guard('list', async () => {
        const { data, error } = await client
          .from('applications')
          .select(RECORD_SELECT)
          .order('created_at', { ascending: true });
        if (error) throw error;
        return parse(z.array(applicationRecordSchema), data);
      }),

    create: (input) =>
      guard('create', async () => {
        const { university, created } = await resolveUniversity(input.university);
        const { data, error } = await client
          .from('applications')
          .insert({ ...input.application, university_id: university.id })
          .select(RECORD_SELECT)
          .single();
        if (error) {
          if (created) await pruneUniversity(university.id);
          throw error;
        }
        return parse(applicationRecordSchema, data);
      }),

    update: (id, input) =>
      guard('update', async () => {
        const { data: current, error: readError } = await client
          .from('applications')
          .select('university_id')
          .eq('id', id)
          .maybeSingle();
        if (readError) throw readError;
        if (!current) throw new DataError('not_found');
        const previousUniversityId = parse(
          z.object({ university_id: z.string() }),
          current,
        ).university_id;

        const { university, created } = await resolveUniversity(input.university);
        const { data, error } = await client
          .from('applications')
          .update({ ...input.application, university_id: university.id })
          .eq('id', id)
          .select(RECORD_SELECT)
          .maybeSingle();
        if (error || !data) {
          if (created) await pruneUniversity(university.id);
          throw error ?? new DataError('not_found');
        }
        if (previousUniversityId !== university.id) await pruneUniversity(previousUniversityId);
        return parse(applicationRecordSchema, data);
      }),

    setStatus: (id, status, submittedOn) =>
      guard('setStatus', async () => {
        const { data, error } = await client
          .from('applications')
          .update(submittedOn ? { status, submitted_on: submittedOn } : { status })
          .eq('id', id)
          .select('id');
        if (error) throw error;
        if (!data || data.length === 0) throw new DataError('not_found');
      }),

    setFavorite: (id, isFavorite) =>
      guard('setFavorite', async () => {
        const { data, error } = await client
          .from('applications')
          .update({ is_favorite: isFavorite })
          .eq('id', id)
          .select('id');
        if (error) throw error;
        if (!data || data.length === 0) throw new DataError('not_found');
      }),

    setNotes: (id, notes) =>
      guard('setNotes', async () => {
        const { data, error } = await client
          .from('applications')
          .update({ notes })
          .eq('id', id)
          .select(RECORD_SELECT)
          .maybeSingle();
        if (error) throw error;
        if (!data) throw new DataError('not_found');
        return parse(applicationRecordSchema, data);
      }),

    remove: (id) =>
      guard('remove', async () => {
        const { data, error } = await client
          .from('applications')
          .delete()
          .eq('id', id)
          .select('university_id');
        if (error) throw error;
        for (const row of data ?? []) {
          await pruneUniversity(parse(z.object({ university_id: z.string() }), row).university_id);
        }
      }),
  };
}
