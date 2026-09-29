import { createContext, useContext } from 'react';
import { DataError } from '@/lib/dataError';
import { supabase } from '@/lib/supabase';
import { createActivityApi, type ActivityApi } from './api';

// Without Supabase settings the app never gets past the sign-in gate, so this only exists to keep
// the default value well typed.
const unavailable: ActivityApi = { recent: () => Promise.reject(new DataError('unknown')) };

/** Lets tests swap the database for an in-memory fake. */
export const ActivityApiContext = createContext<ActivityApi>(
  supabase ? createActivityApi(supabase) : unavailable,
);

export function useActivityApi(): ActivityApi {
  return useContext(ActivityApiContext);
}
