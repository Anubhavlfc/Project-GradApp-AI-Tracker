import { createContext, useContext } from 'react';
import { DataError } from '@/lib/dataError';
import { supabase } from '@/lib/supabase';
import { createRecommendationsApi, type RecommendationsApi } from './api';

const refuse = () => Promise.reject(new DataError('unknown'));

// Without Supabase settings the app never gets past the sign-in gate, so this only exists to keep
// the default value well typed.
const unavailable: RecommendationsApi = {
  listRecommenders: refuse,
  createRecommender: refuse,
  updateRecommender: refuse,
  deleteRecommender: refuse,
  listRequests: refuse,
  createRequest: refuse,
  updateRequest: refuse,
  setRequestStatus: refuse,
  deleteRequest: refuse,
};

/** Lets tests swap the database for an in-memory fake. */
export const RecommendationsApiContext = createContext<RecommendationsApi>(
  supabase ? createRecommendationsApi(supabase) : unavailable,
);

export function useRecommendationsApi(): RecommendationsApi {
  return useContext(RecommendationsApiContext);
}
