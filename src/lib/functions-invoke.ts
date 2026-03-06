/**
 * Authed Edge Function invoke: refresh session, then call with user's Bearer token.
 * Uses fetch() so the user JWT is sent as Authorization (client.invoke can overwrite with anon key and cause 401).
 */
import { supabase } from '@/integrations/supabase/client';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL ?? '';
const ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY ?? '';

export interface InvokeAuthedOptions {
  /** If true, skip refreshSession() to avoid triggering token refresh (e.g. during export). Use when current session is acceptable. */
  skipRefresh?: boolean;
}

export async function invokeAuthed<T = unknown>(fnName: string, body?: unknown, options?: InvokeAuthedOptions): Promise<T> {
  // 1) Get a valid user session token (optionally skip refresh to avoid rate-limit / logout during export)
  if (!options?.skipRefresh) {
    await supabase.auth.refreshSession();
  }
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) {
    throw new Error('No valid session. Please log in again.');
  }
  if (ANON_KEY && session.access_token === ANON_KEY) {
    throw new Error('No valid session. Please log in again.');
  }
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) {
    throw new Error('Session expired or invalid. Please log out and log in again.');
  }

  // 2) Call Edge Function: use anon key in Authorization so gateway accepts; send user JWT in body for our auth
  const url = `${SUPABASE_URL.replace(/\/$/, '')}/functions/v1/${fnName}`;
  const payload =
    body !== undefined && typeof body === 'object' && body !== null
      ? { ...body, access_token: session.access_token }
      : { access_token: session.access_token };
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${ANON_KEY}`,
      apikey: ANON_KEY,
      'x-client-info': 'traveltrak-ops',
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    let serverMsg: string | null = null;
    try {
      const data = await res.json();
      if (data && typeof data === 'object' && 'error' in data) {
        serverMsg = (data as { error?: string }).error ?? null;
      }
    } catch {
      // ignore
    }
    if (serverMsg === 'Master admin access required' || serverMsg === 'Forbidden: not master admin') {
      throw new Error('Only master admins can create organizations. Your account does not have master admin access.');
    }
    if (serverMsg === 'missing_bearer_token' || serverMsg === 'invalid_or_expired_token' || res.status === 401) {
      throw new Error('Session expired or invalid. Please log out and log in again.');
    }
    throw new Error(serverMsg || res.statusText || `Function ${fnName} failed`);
  }

  const data = await res.json().catch(() => ({}));
  return data as T;
}
