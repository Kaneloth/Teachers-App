import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error(
    '[EduCross] VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY must be set.',
  );
}

/**
 * Every Supabase API call goes through this fetch wrapper.
 * Without it, calls hang indefinitely on slow / broken networks.
 * 15 s is long enough for London (eu-west-2) from SA mobile, but short
 * enough that the user sees an error instead of an infinite spinner.
 */
const TIMEOUT_MS = 15_000;

function fetchWithTimeout(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  return fetch(input, { ...init, signal: controller.signal }).finally(() =>
    clearTimeout(timer),
  );
}

export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder',
  { global: { fetch: fetchWithTimeout } },
);
