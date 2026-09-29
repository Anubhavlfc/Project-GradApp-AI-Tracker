import { createContext, useContext } from 'react';
import { DataError } from '@/lib/dataError';
import { supabase } from '@/lib/supabase';
import { createFundingApi, type FundingApi } from './api';

const refuse = () => Promise.reject(new DataError('unknown'));

// Without Supabase settings the app never gets past the sign-in gate, so this only exists to keep
// the default value well typed.
const unavailable: FundingApi = {
  list: refuse,
  create: refuse,
  update: refuse,
  setStatus: refuse,
  remove: refuse,
};

/** Lets tests swap the database for an in-memory fake. */
export const FundingApiContext = createContext<FundingApi>(
  supabase ? createFundingApi(supabase) : unavailable,
);

export function useFundingApi(): FundingApi {
  return useContext(FundingApiContext);
}
