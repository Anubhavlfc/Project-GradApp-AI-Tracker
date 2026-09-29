import { createContext, useContext } from 'react';
import { DataError } from '@/lib/dataError';
import { supabase } from '@/lib/supabase';
import { createTasksApi, type TasksApi } from './api';

const refuse = () => Promise.reject(new DataError('unknown'));

// Without Supabase settings the app never gets past the sign-in gate, so this only exists to keep
// the default value well typed.
const unavailable: TasksApi = {
  list: refuse,
  create: refuse,
  update: refuse,
  setStatus: refuse,
  remove: refuse,
};

/** Lets tests swap the database for an in-memory fake. */
export const TasksApiContext = createContext<TasksApi>(
  supabase ? createTasksApi(supabase) : unavailable,
);

export function useTasksApi(): TasksApi {
  return useContext(TasksApiContext);
}
