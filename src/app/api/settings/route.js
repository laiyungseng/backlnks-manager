import { NextResponse } from 'next/server';

/**
 * GET /api/settings
 * Returns whether the required environment variables are configured.
 * Never returns the actual values — only presence flags.
 *
 * This route is protected by middleware (requires valid admin session).
 */
export async function GET() {
    return NextResponse.json({
        supabaseUrlConfigured: !!process.env.SUPABASE_URL,
        supabaseAnonKeyConfigured: !!process.env.SUPABASE_ANON_KEY,
        serviceRoleKeyConfigured: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
        encryptionSecretConfigured: !!process.env.ENCRYPTION_SECRET,
        sessionSecretConfigured: !!process.env.SESSION_SECRET,
    });
}
