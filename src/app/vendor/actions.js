'use server';

import { getServerSupabase } from '@/lib/supabase-server';
import { clearVendorSessionCookie } from '@/lib/session';
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

        const slug = vendor.vendor_name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');

        redirect(`/vendor/${slug}/portal/${vendor.id}/dashboard`);

    } catch (err) {
        if (err.message === 'NEXT_REDIRECT') throw err;
        console.error('Unhandled vendor login error:', err);
        return { success: false, message: 'An unexpected error occurred.' };
    }
}

export async function vendorLogoutAction() {
    await clearVendorSessionCookie();
    redirect('/vendor');
}
