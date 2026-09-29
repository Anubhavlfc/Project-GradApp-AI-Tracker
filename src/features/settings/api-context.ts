import { createContext, useContext } from 'react';
import { DataError } from '@/lib/dataError';
import { supabase } from '@/lib/supabase';
import { createSettingsApi, type SettingsApi } from './api';

const refuse = () => Promise.reject(new DataError('unknown'));

// Without Supabase settings the app never gets past the sign-in gate, so this only exists to keep
// the default value well typed.
const unavailable: SettingsApi = { exportData: refuse, deleteAccount: refuse };

/** Lets tests swap the database for an in-memory fake. */
export const SettingsApiContext = createContext<SettingsApi>(
  supabase ? createSettingsApi(supabase) : unavailable,
);

export function useSettingsApi(): SettingsApi {
  return useContext(SettingsApiContext);
}
