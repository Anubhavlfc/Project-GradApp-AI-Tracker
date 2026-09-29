import { createContext, useContext } from 'react';
import { DataError } from '@/lib/dataError';
import { supabase } from '@/lib/supabase';
import { createRequirementsApi, type RequirementsApi } from './api';

// Without Supabase settings the app never gets past the sign-in gate, so this only exists to keep
// the default value well typed.
const unavailable: RequirementsApi = {
  list: () => Promise.reject(new DataError('unknown')),
  add: () => Promise.reject(new DataError('unknown')),
  update: () => Promise.reject(new DataError('unknown')),
  setStatus: () => Promise.reject(new DataError('unknown')),
  setDocument: () => Promise.reject(new DataError('unknown')),
  remove: () => Promise.reject(new DataError('unknown')),
};

/** Lets tests swap the database for an in-memory fake. */
export const RequirementsApiContext = createContext<RequirementsApi>(
  supabase ? createRequirementsApi(supabase) : unavailable,
);

export function useRequirementsApi(): RequirementsApi {
  return useContext(RequirementsApiContext);
}
