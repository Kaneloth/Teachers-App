import { createClient } from '@supabase/supabase-js';

declare const __SUPABASE_URL__: string;
declare const __SUPABASE_ANON_KEY__: string;

const supabaseUrl = (typeof __SUPABASE_URL__ !== 'undefined' ? __SUPABASE_URL__ : '') ||
  (import.meta.env.VITE_SUPABASE_URL as string | undefined) || '';

const supabaseAnonKey = (typeof __SUPABASE_ANON_KEY__ !== 'undefined' ? __SUPABASE_ANON_KEY__ : '') ||
  (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) || '';

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables. Ensure SUPABASE_URL and SUPABASE_ANON_KEY are set as secrets.');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
});
