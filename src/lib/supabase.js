import { createClient } from '@supabase/supabase-js';

// Private server-only env vars (no NEXT_PUBLIC_ prefix) — never shipped to the browser.
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

// Return null when credentials are missing — avoids a crash at module load time
// when .env is empty (e.g. after logout). Callers must guard against null.
export const supabase = (supabaseUrl && supabaseAnonKey)
    ? createClient(supabaseUrl, supabaseAnonKey)
    : null;
