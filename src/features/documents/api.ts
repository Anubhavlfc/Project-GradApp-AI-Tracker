import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { createGuard, parseRows as parse } from '@/lib/dataApi';
import { DataError } from '@/lib/dataError';
import type { DocumentStatus } from './kinds';
import { documentRowSchema, type DocumentFields, type DocumentRow } from './types';

/** Everything the screens need from the database about documents. */
export interface DocumentsApi {
  list(): Promise<DocumentRow[]>;
  create(fields: DocumentFields): Promise<DocumentRow>;
  /** Adds several documents in a single request: all of them or none. */
  createMany(items: readonly DocumentFields[]): Promise<DocumentRow[]>;
  update(id: string, fields: DocumentFields): Promise<DocumentRow>;
  setStatus(id: string, status: DocumentStatus): Promise<void>;
  /** Deleting something that is already gone counts as success. */
  remove(id: string): Promise<void>;
}

const guard = createGuard('documents');

export function createDocumentsApi(client: SupabaseClient): DocumentsApi {
  return {
    list: () =>
      guard('list', async () => {
        const { data, error } = await client
          .from('documents')
          .select('*')
          .order('created_at', { ascending: true });
        if (error) throw error;
        return parse(z.array(documentRowSchema), data);
      }),

    // The owner is never sent: the database fills in the signed-in person.
    create: (fields) =>
      guard('create', async () => {
        const { data, error } = await client.from('documents').insert(fields).select().single();
        if (error) throw error;
        return parse(documentRowSchema, data);
      }),

    createMany: (items) =>
      guard('createMany', async () => {
        if (items.length === 0) return [];
        const { data, error } = await client
          .from('documents')
          .insert([...items])
          .select();
        if (error) throw error;
        return parse(z.array(documentRowSchema), data);
      }),

    update: (id, fields) =>
      guard('update', async () => {
        const { data, error } = await client
          .from('documents')
          .update(fields)
          .eq('id', id)
          .select()
          .maybeSingle();
        if (error) throw error;
        if (!data) throw new DataError('not_found');
        return parse(documentRowSchema, data);
      }),

    setStatus: (id, status) =>
      guard('setStatus', async () => {
        const { data, error } = await client
          .from('documents')
          .update({ status })
          .eq('id', id)
          .select('id');
        if (error) throw error;
        if (!data || data.length === 0) throw new DataError('not_found');
      }),

    // Checklist items that used this document keep existing; the database just clears the link.
    remove: (id) =>
      guard('remove', async () => {
        const { error } = await client.from('documents').delete().eq('id', id);
        if (error) throw error;
      }),
  };
}
