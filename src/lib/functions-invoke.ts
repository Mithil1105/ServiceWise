/**
 * Authed Edge Function invoke: refresh session, then call with explicit Bearer.
 * Use this for all Edge Function calls that require a signed-in user.
 */
import { supabase } from '@/integrations/supabase/client';

const ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY ?? '';

export async function invokeAuthed<T = unknown>(fnName: string, body?: unknown): Promise<T> {
  // 1) Refresh then get a valid user session token
  await supabase.auth.refreshSession();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) {
    throw new Error('No valid session. Please log in again.');
  }
  // Do not send the anon key as Bearer (would cause 401)
  if (ANON_KEY && session.access_token === ANON_KEY) {
    throw new Error('No valid session. Please log in again.');
  }
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) {
    throw new Error('Session expired or invalid. Please log out and log in again.');
  }

  // 2) Invoke with explicit Bearer token (required for Edge Functions)
  const { data, error } = await supabase.functions.invoke(fnName, {
    body,
    headers: {
      Authorization: `Bearer ${session.access_token}`,
    },
  });

  if (error) {
    const msg = error.message || `Function ${fnName} failed`;
    let serverMsg: string | null = null;
    const res = (error as { context?: Response }).context;
    if (res && typeof (res as Response).json === 'function') {
      try {
        const body = await (res as Response).json();
        if (body && typeof body === 'object' && 'error' in body) {
          serverMsg = (body as { error?: string }).error ?? null;
        }
      } catch {
        // ignore parse errors
      }
    }
    if (serverMsg === 'Master admin access required' || serverMsg === 'Forbidden: not master admin') {
      throw new Error('Only master admins can create organizations. Your account does not have master admin access.');
    }
    if (serverMsg === 'missing_bearer_token' || serverMsg === 'invalid_or_expired_token') {
      throw new Error('Session expired or invalid. Please log out and log in again.');
    }
    throw new Error(serverMsg || msg);
  }

  return data as T;
}
