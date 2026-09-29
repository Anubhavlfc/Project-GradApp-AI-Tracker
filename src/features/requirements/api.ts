import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { createGuard, parseRows as parse } from '@/lib/dataApi';
import { DataError } from '@/lib/dataError';
import type { RequirementStatus } from './kinds';
import { requirementRowSchema, type RequirementFields, type RequirementRow } from './types';

/** Everything the screens need from the database about checklist items. */
export interface RequirementsApi {
  /** Every item on every one of the person's programs. */
  list(): Promise<RequirementRow[]>;
  /** Adds several items to one program's checklist in a single request: all of them or none. */
  add(applicationId: string, items: readonly RequirementFields[]): Promise<RequirementRow[]>;
  update(id: string, fields: RequirementFields): Promise<RequirementRow>;
  setStatus(id: string, status: RequirementStatus): Promise<void>;
  /** Deleting something that is already gone counts as success. */
  remove(id: string): Promise<void>;
}

const guard = createGuard('requirements');

export function createRequirementsApi(client: SupabaseClient): RequirementsApi {
  return {
    list: () =>
      guard('list', async () => {
        const { data, error } = await client
          .from('requirements')
          .select('*')
          .order('created_at', { ascending: true });
        if (error) throw error;
        return parse(z.array(requirementRowSchema), data);
      }),

    add: (applicationId, items) =>
      guard('add', async () => {
        if (items.length === 0) return [];
        // The owner is never sent: the database fills in the signed-in person, and refuses a
        // program that belongs to someone else.
        const rows = items.map((item) => ({ ...item, application_id: applicationId }));
        const { data, error } = await client.from('requirements').insert(rows).select();
        if (error) throw error;
        return parse(z.array(requirementRowSchema), data);
      }),

    update: (id, fields) =>
      guard('update', async () => {
        const { data, error } = await client
          .from('requirements')
          .update(fields)
          .eq('id', id)
          .select()
          .maybeSingle();
        if (error) throw error;
        if (!data) throw new DataError('not_found');
        return parse(requirementRowSchema, data);
      }),

    setStatus: (id, status) =>
      guard('setStatus', async () => {
        const { data, error } = await client
          .from('requirements')
          .update({ status })
          .eq('id', id)
          .select('id');
        if (error) throw error;
        if (!data || data.length === 0) throw new DataError('not_found');
      }),

    remove: (id) =>
      guard('remove', async () => {
        const { error } = await client.from('requirements').delete().eq('id', id);
        if (error) throw error;
      }),
  };
}
