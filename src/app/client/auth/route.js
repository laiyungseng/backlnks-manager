import { NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase-server';
import { setClientSessionCookie } from '@/lib/session';

export const dynamic = 'force-dynamic';

export async function GET(request) {
    const { searchParams } = request.nextUrl;
    const token = searchParams.get('token');
    const name = searchParams.get('name');

    if (!token || typeof token !== 'string' || token.length !== 64) {
        return NextResponse.redirect(new URL('/client?error=invalid_token', request.url));
    }
    if (!name || typeof name !== 'string' || !name.trim()) {
        return NextResponse.redirect(new URL('/client?error=invalid_name', request.url));
    }

    let supabase;
    try {
        supabase = getServerSupabase();
    } catch {
        return NextResponse.redirect(new URL('/client?error=server_error', request.url));
    }

    const { data: client, error } = await supabase
        .from('clients')
        .select('id, client_name, invite_token, invite_token_expires_at, invite_used_at, session_version')
        .eq('invite_token', token)
        .maybeSingle();

    if (error || !client) {
        return NextResponse.redirect(new URL('/client?error=invalid_token', request.url));
    }

    // Verify the supplied name matches this client record
    if (client.client_name.toLowerCase().trim() !== name.toLowerCase().trim()) {
        return NextResponse.redirect(new URL('/client?error=name_mismatch', request.url));
    }

    if (client.invite_used_at) {
        return NextResponse.redirect(new URL('/client?error=token_used', request.url));
    }

    if (!client.invite_token_expires_at || new Date() > new Date(client.invite_token_expires_at)) {
        return NextResponse.redirect(new URL('/client?error=token_expired', request.url));
    }

    await supabase
        .from('clients')
        .update({ invite_used_at: new Date().toISOString() })
        .eq('id', client.id);

    await setClientSessionCookie(client.id, client.session_version ?? 1);

    const slug = client.client_name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    return NextResponse.redirect(new URL(`/client/${slug}/portal/${client.id}/dashboard`, request.url));
}
