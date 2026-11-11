import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { SCHEMA } from './remote';
import type { Database } from './types';

/**
 * The shared Life Regulation Lab server (docs/SHARED-SERVER.md). The same sign-in as Regulate,
 * Pace, Mull and Head Untangled; Dealt With's own records are in its own part of it. The address
 * and key are public client values, not secrets.
 *
 * The build uses the shared server when both values are set, and this app's own Firebase project
 * otherwise. Nothing else decides it.
 */

const env = import.meta.env;

export function sharedConfigured(): boolean {
  return Boolean(env['VITE_SHARED_URL'] && env['VITE_SHARED_KEY']);
}

export function sharedUrl(): string {
  return String(env['VITE_SHARED_URL'] ?? '');
}

export function sharedKey(): string {
  return String(env['VITE_SHARED_KEY'] ?? '');
}

type Client = SupabaseClient<Database, 'dealt_with'>;
let cached: Client | undefined;

/** One client: the sign-in, and the few calls that are not records (supporter links, Plus, deleting). */
export function shared(): Client {
  if (cached) return cached;
  if (!sharedConfigured()) throw new Error('The shared server is not set up in this build.');
  cached = createClient<Database, 'dealt_with'>(sharedUrl(), sharedKey(), {
    db: { schema: SCHEMA },
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      // Apple and Google come back to /signin with a one-time code that the client exchanges.
      flowType: 'pkce',
      detectSessionInUrl: true,
    },
  });
  return cached;
}

/** The signed-in person's token for a call to the server, or nothing when signed out. */
export async function sharedToken(): Promise<string | undefined> {
  const { data } = await shared().auth.getSession();
  return data.session?.access_token;
}
