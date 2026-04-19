'use server';

import { randomBytes } from 'crypto';
import { getServerSupabase } from '@/lib/supabase-server';
import { getVendorSession, clearVendorSessionCookie } from '@/lib/session';
import { redirect } from 'next/navigation';

export async function vendorLogin(vendorName) {
    if (!vendorName) {
        return { success: false, message: 'Vendor name is required.' };
    }

    try {
        const supabase = getServerSupabase();

        const { data: vendor, error } = await supabase
            .from('vendors')
            .select('id, vendor_name')
            .ilike('vendor_name', vendorName.toLowerCase())
            .maybeSingle();

        if (error) {
            console.error('Vendor login error:', error);
            return { success: false, message: 'An error occurred while verifying the vendor.' };
        }

        if (!vendor) {
            return { success: false, message: 'Invalid vendor name. Please try again.' };
        }

        // Generate a 64-char hex invite token (single-use, 7-day expiry)
        const token = randomBytes(32).toString('hex');
        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

        const { error: tokenError } = await supabase
            .from('vendors')
            .update({
                invite_token: token,
                invite_expires_at: expiresAt,
                invite_used_at: null,
            })
            .eq('id', vendor.id);

        if (tokenError) {
            console.error('Token generation error:', tokenError);
            return { success: false, message: 'Failed to generate access link. Please try again.' };
        }

        return { success: true, inviteUrl: `/vendor/auth?token=${token}` };

    } catch (err) {
        console.error('Unhandled vendor login error:', err);
        return { success: false, message: 'An unexpected error occurred.' };
    }
}

export async function vendorLogoutAction() {
    const session = await getVendorSession();
    if (session?.vendorId) {
        try {
            const supabase = getServerSupabase();
            await supabase
                .from('vendors')
                .update({ session_version: (session.sessionVersion ?? 1) + 1 })
                .eq('id', session.vendorId);
        } catch { /* non-fatal — cookie cleared regardless */ }
    }
    await clearVendorSessionCookie();
    redirect('/vendor');
}
