import { createClient } from '@supabase/supabase-js';

/**
 * Server-only Supabase client that uses the service role key.
 * NEVER import this in client components or expose it to the browser.
 * Bypasses RLS — use only in trusted server actions and route handlers.
 */
export function getServerSupabase() {
    const url = process.env.SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url || !serviceKey) {
        throw new Error(
            'SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set as server environment variables.'
        );
    }

    return createClient(url, serviceKey, {
        auth: {
            // Disable auto session management — this is a server-side admin client
            persistSession: false,
            autoRefreshToken: false,
        },
    });
}
