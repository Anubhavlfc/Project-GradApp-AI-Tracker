import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { createGuard, parseRows as parse } from '@/lib/dataApi';
import { activityRowSchema, type ActivityRow } from './types';

/** Everything the screens need from the database about the activity log: reading it. */
export interface ActivityApi {
  /** The latest entries, newest first. */
  recent(limit: number): Promise<ActivityRow[]>;
}

const guard = createGuard('activity');

export function createActivityApi(client: SupabaseClient): ActivityApi {
  return {
    recent: (limit) =>
      guard('recent', async () => {
        const { data, error } = await client
          .from('activity')
          .select('id, application_id, kind, subject, detail, meta, created_at')
          .order('created_at', { ascending: false })
          .order('id', { ascending: false })
          .limit(limit);
        if (error) throw error;
        return parse(z.array(activityRowSchema), data);
      }),
  };
}
