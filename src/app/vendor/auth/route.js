import { NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase-server';
import { setVendorSessionCookie } from '@/lib/session';

export const dynamic = 'force-dynamic';

export async function GET(request) {
    const { searchParams } = request.nextUrl;
    const token = searchParams.get('token');

    if (!token || typeof token !== 'string' || token.length !== 64) {
        return NextResponse.redirect(new URL('/vendor?error=invalid_token', request.url));
    }

    let supabase;
    try {
        supabase = getServerSupabase();
    } catch {
        return NextResponse.redirect(new URL('/vendor?error=server_error', request.url));
    }

    const { data: vendor, error } = await supabase
        .from('vendors')
        .select('id, vendor_name, invite_token, invite_expires_at, invite_used_at, session_version')
        .eq('invite_token', token)
        .maybeSingle();

    if (error || !vendor) {
        return NextResponse.redirect(new URL('/vendor?error=invalid_token', request.url));
    }

    // Token already used
    if (vendor.invite_used_at) {
        return NextResponse.redirect(new URL('/vendor?error=token_used', request.url));
    }

    // Token expired
    if (!vendor.invite_expires_at || new Date() > new Date(vendor.invite_expires_at)) {
        return NextResponse.redirect(new URL('/vendor?error=token_expired', request.url));
    }

    // Stamp as used
    await supabase
        .from('vendors')
        .update({ invite_used_at: new Date().toISOString() })
        .eq('id', vendor.id);

    // Set signed session cookie (embed session_version for revocation support)
    await setVendorSessionCookie(vendor.id, vendor.session_version ?? 1);

    // Redirect to vendor dashboard
    const slug = vendor.vendor_name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    return NextResponse.redirect(new URL(`/vendor/${slug}/portal/${vendor.id}/dashboard`, request.url));
}
