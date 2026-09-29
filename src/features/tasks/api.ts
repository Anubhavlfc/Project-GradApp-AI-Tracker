import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { createGuard, parseRows as parse } from '@/lib/dataApi';
import { DataError } from '@/lib/dataError';
import type { TaskStatus } from './kinds';
import { taskRowSchema, type TaskFields, type TaskRow } from './types';

/** Everything the screens need from the database about tasks. */
export interface TasksApi {
  /** Every task, on every program and tied to none. */
  list(): Promise<TaskRow[]>;
  create(fields: TaskFields): Promise<TaskRow>;
  update(id: string, fields: TaskFields): Promise<TaskRow>;
  setStatus(id: string, status: TaskStatus): Promise<void>;
  /** Deleting something that is already gone counts as success. */
  remove(id: string): Promise<void>;
}

const guard = createGuard('tasks');

export function createTasksApi(client: SupabaseClient): TasksApi {
  return {
    list: () =>
      guard('list', async () => {
        const { data, error } = await client
          .from('tasks')
          .select('*')
          .order('created_at', { ascending: true });
        if (error) throw error;
        return parse(z.array(taskRowSchema), data);
      }),

    // The owner is never sent: the database fills in the signed-in person, and refuses a program
    // that belongs to someone else.
    create: (fields) =>
      guard('create', async () => {
        const { data, error } = await client.from('tasks').insert(fields).select().single();
        if (error) throw error;
        return parse(taskRowSchema, data);
      }),

    update: (id, fields) =>
      guard('update', async () => {
        const { data, error } = await client
          .from('tasks')
          .update(fields)
          .eq('id', id)
          .select()
          .maybeSingle();
        if (error) throw error;
        if (!data) throw new DataError('not_found');
        return parse(taskRowSchema, data);
      }),

    setStatus: (id, status) =>
      guard('setStatus', async () => {
        const { data, error } = await client
          .from('tasks')
          .update({ status })
          .eq('id', id)
          .select('id');
        if (error) throw error;
        if (!data || data.length === 0) throw new DataError('not_found');
      }),

    remove: (id) =>
      guard('remove', async () => {
        const { error } = await client.from('tasks').delete().eq('id', id);
        if (error) throw error;
      }),
  };
}
