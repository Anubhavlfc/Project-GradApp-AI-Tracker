import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { createGuard, parseRows as parse } from '@/lib/dataApi';
import { DataError } from '@/lib/dataError';
import type { FundingStatus } from './kinds';
import { fundingRowSchema, type FundingFields, type FundingRow } from './types';

/** Everything the screens need from the database about funding. */
export interface FundingApi {
  /** Every funding item, on every program and tied to none. */
  list(): Promise<FundingRow[]>;
  create(fields: FundingFields): Promise<FundingRow>;
  update(id: string, fields: FundingFields): Promise<FundingRow>;
  setStatus(id: string, status: FundingStatus): Promise<void>;
  /** Deleting something that is already gone counts as success. */
  remove(id: string): Promise<void>;
}

const guard = createGuard('funding');

export function createFundingApi(client: SupabaseClient): FundingApi {
  return {
    list: () =>
      guard('list', async () => {
        const { data, error } = await client
          .from('funding')
          .select('*')
          .order('created_at', { ascending: true });
        if (error) throw error;
        return parse(z.array(fundingRowSchema), data);
      }),

    // The owner is never sent: the database fills in the signed-in person, and refuses a program
    // that belongs to someone else.
    create: (fields) =>
      guard('create', async () => {
        const { data, error } = await client.from('funding').insert(fields).select().single();
        if (error) throw error;
        return parse(fundingRowSchema, data);
      }),

    update: (id, fields) =>
      guard('update', async () => {
        const { data, error } = await client
          .from('funding')
          .update(fields)
          .eq('id', id)
          .select()
          .maybeSingle();
        if (error) throw error;
        if (!data) throw new DataError('not_found');
        return parse(fundingRowSchema, data);
      }),

    setStatus: (id, status) =>
      guard('setStatus', async () => {
        const { data, error } = await client
          .from('funding')
          .update({ status })
          .eq('id', id)
          .select('id');
        if (error) throw error;
        if (!data || data.length === 0) throw new DataError('not_found');
      }),

    remove: (id) =>
      guard('remove', async () => {
        const { error } = await client.from('funding').delete().eq('id', id);
        if (error) throw error;
      }),
  };
}
