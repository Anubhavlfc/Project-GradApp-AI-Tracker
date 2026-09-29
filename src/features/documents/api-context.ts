import { createContext, useContext } from 'react';
import { DataError } from '@/lib/dataError';
import { supabase } from '@/lib/supabase';
import { createDocumentsApi, type DocumentsApi } from './api';

const refuse = () => Promise.reject(new DataError('unknown'));

// Without Supabase settings the app never gets past the sign-in gate, so this only exists to keep
// the default value well typed.
const unavailable: DocumentsApi = {
  list: refuse,
  create: refuse,
  createMany: refuse,
  update: refuse,
  setStatus: refuse,
  remove: refuse,
};

/** Lets tests swap the database for an in-memory fake. */
export const DocumentsApiContext = createContext<DocumentsApi>(
  supabase ? createDocumentsApi(supabase) : unavailable,
);

export function useDocumentsApi(): DocumentsApi {
  return useContext(DocumentsApiContext);
}
