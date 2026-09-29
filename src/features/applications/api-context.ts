import { createContext, useContext } from 'react';
import { supabase } from '@/lib/supabase';
import { createApplicationsApi, type ApplicationsApi } from './api';
import { DataError } from './errors';

// Without Supabase settings the app never gets past the sign-in gate, so this only exists to keep
// the default value well typed.
const unavailable: ApplicationsApi = {
  list: () => Promise.reject(new DataError('unknown')),
  create: () => Promise.reject(new DataError('unknown')),
  update: () => Promise.reject(new DataError('unknown')),
  setStatus: () => Promise.reject(new DataError('unknown')),
  setFavorite: () => Promise.reject(new DataError('unknown')),
  remove: () => Promise.reject(new DataError('unknown')),
};

/** Lets tests swap the database for an in-memory fake. */
export const ApplicationsApiContext = createContext<ApplicationsApi>(
  supabase ? createApplicationsApi(supabase) : unavailable,
);

export function useApplicationsApi(): ApplicationsApi {
  return useContext(ApplicationsApiContext);
}
