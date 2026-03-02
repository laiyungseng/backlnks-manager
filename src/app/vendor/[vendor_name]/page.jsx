import { supabase } from '@/lib/supabase';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function VendorRootDispatcher({ params }) {
    const resolvedParams = await params;
    const pathParam = resolvedParams?.vendor_name;

    if (!pathParam) {
        redirect('/unauthorized');
    }

    // SCENARIO 1: LEGACY URL
    // The user visited /vendor/[hash]
    // Let's check if the path param is actually a hash in the database
    const { data: projectList, error } = await supabase
        .from('project_list')
        .select('project_id, projects ( vendor_name )')
        .eq('hash', pathParam)
        .maybeSingle();

    if (projectList && !error) {
        // It's a legacy URL! The pathParam is a hash.
        const vendorName = projectList.projects?.vendor_name || 'vendor';
        const vendorSlug = vendorName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');

        // Redirect to the new multi-page URL structure
        redirect(`/vendor/${vendorSlug}/${pathParam}`);
    }

    // SCENARIO 2: VENDOR DASHBOARD
    // The user visited /vendor/[vendor_name]
    // This is not a hash, so it's a vendor name. Redirect them to their in-progress list.
    redirect(`/vendor/${pathParam}/inprogress`);
}
