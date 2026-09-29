import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { createGuard, parseRows as parse } from '@/lib/dataApi';
import { DataError } from '@/lib/dataError';
import type { RecommendationStatus } from './statuses';
import {
  recommenderRowSchema,
  requestRowSchema,
  type NewRequest,
  type RecommenderFields,
  type RecommenderRow,
  type RequestFields,
  type RequestRow,
} from './types';

/** Everything the screens need from the database about recommenders and their letters. */
export interface RecommendationsApi {
  listRecommenders(): Promise<RecommenderRow[]>;
  createRecommender(fields: RecommenderFields): Promise<RecommenderRow>;
  updateRecommender(id: string, fields: RecommenderFields): Promise<RecommenderRow>;
  /** Also removes the person's letter requests. Deleting someone already gone counts as success. */
  deleteRecommender(id: string): Promise<void>;

  /** Every letter request for every program. */
  listRequests(): Promise<RequestRow[]>;
  createRequest(request: NewRequest): Promise<RequestRow>;
  updateRequest(id: string, fields: RequestFields): Promise<RequestRow>;
  /** `requestedOn` is stored alongside when the change is the act of asking. */
  setRequestStatus(id: string, status: RecommendationStatus, requestedOn?: string): Promise<void>;
  deleteRequest(id: string): Promise<void>;
}

const guard = createGuard('recommendations');

export function createRecommendationsApi(client: SupabaseClient): RecommendationsApi {
  return {
    listRecommenders: () =>
      guard('listRecommenders', async () => {
        const { data, error } = await client
          .from('recommenders')
          .select('*')
          .order('created_at', { ascending: true });
        if (error) throw error;
        return parse(z.array(recommenderRowSchema), data);
      }),

    // The owner is never sent: the database fills in the signed-in person.
    createRecommender: (fields) =>
      guard('createRecommender', async () => {
        const { data, error } = await client.from('recommenders').insert(fields).select().single();
        if (error) throw error;
        return parse(recommenderRowSchema, data);
      }),

    updateRecommender: (id, fields) =>
      guard('updateRecommender', async () => {
        const { data, error } = await client
          .from('recommenders')
          .update(fields)
          .eq('id', id)
          .select()
          .maybeSingle();
        if (error) throw error;
        if (!data) throw new DataError('not_found');
        return parse(recommenderRowSchema, data);
      }),

    deleteRecommender: (id) =>
      guard('deleteRecommender', async () => {
        const { error } = await client.from('recommenders').delete().eq('id', id);
        if (error) throw error;
      }),

    listRequests: () =>
      guard('listRequests', async () => {
        const { data, error } = await client
          .from('recommendation_requests')
          .select('*')
          .order('created_at', { ascending: true });
        if (error) throw error;
        return parse(z.array(requestRowSchema), data);
      }),

    // The database refuses a recommender or program that belongs to someone else, and a second
    // request from the same person for the same program.
    createRequest: (request) =>
      guard('createRequest', async () => {
        const { data, error } = await client
          .from('recommendation_requests')
          .insert(request)
          .select()
          .single();
        if (error) throw error;
        return parse(requestRowSchema, data);
      }),

    updateRequest: (id, fields) =>
      guard('updateRequest', async () => {
        const { data, error } = await client
          .from('recommendation_requests')
          .update(fields)
          .eq('id', id)
          .select()
          .maybeSingle();
        if (error) throw error;
        if (!data) throw new DataError('not_found');
        return parse(requestRowSchema, data);
      }),

    setRequestStatus: (id, status, requestedOn) =>
      guard('setRequestStatus', async () => {
        const { data, error } = await client
          .from('recommendation_requests')
          .update(requestedOn ? { status, requested_on: requestedOn } : { status })
          .eq('id', id)
          .select('id');
        if (error) throw error;
        if (!data || data.length === 0) throw new DataError('not_found');
      }),

    deleteRequest: (id) =>
      guard('deleteRequest', async () => {
        const { error } = await client.from('recommendation_requests').delete().eq('id', id);
        if (error) throw error;
      }),
  };
}
