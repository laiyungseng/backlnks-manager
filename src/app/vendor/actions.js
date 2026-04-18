'use server';

import { getServerSupabase } from '@/lib/supabase-server';
import { redirect } from 'next/navigation';

export async function vendorLogin(vendorName) {
    if (!vendorName) {
        return { success: false, message: 'Vendor name is required.' };
    }

    try {
        const supabase = getServerSupabase();
        
        // Exact match query (case-insensitive via ilike without wildcards)
        const { data: vendor, error } = await supabase
            .from('vendors')
            .select('vendor_name')
            .ilike('vendor_name', vendorName)
            .maybeSingle();

        if (error) {
            console.error('Vendor login error:', error);
            return { success: false, message: 'An error occurred while verifying the vendor.' };
        }

        if (!vendor) {
            return { success: false, message: 'Invalid vendor name. Please try again.' };
        }

        // Generate the slug mirroring the standard creation pipeline
        const slug = vendor.vendor_name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');

        // Redirect directly to the vendor's in-progress dashboard
        redirect(`/vendor/${slug}/inprogress`);
        
    } catch (err) {
        // next/navigation redirect throws an error internally, we must rethrow it
        if (err.message === 'NEXT_REDIRECT') {
            throw err;
        }
        console.error('Unhandled vendor login error:', err);
        return { success: false, message: 'An unexpected error occurred.' };
    }
}
