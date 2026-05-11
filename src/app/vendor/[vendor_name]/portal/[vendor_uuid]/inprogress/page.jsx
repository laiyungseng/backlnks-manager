import { getServerSupabase } from '@/lib/supabase-server';
import { verifyVendorSession, getSession } from '@/lib/session';
import { redirect } from 'next/navigation';
import CurrentProjectIndicator from './CurrentProjectIndicator';
import InProgressProjectList from './InProgressProjectList';

export const dynamic = 'force-dynamic';

export default async function VendorInProgressPage({ params }) {
    const supabase = getServerSupabase();
    const resolvedParams = await params;
    const vendorName = resolvedParams?.vendor_name;
    const vendorUuid = resolvedParams?.vendor_uuid;

    if (!vendorName || !vendorUuid) redirect('/vendor');

    // Admin users bypass vendor session check — allow read-only preview
    const adminSession = await getSession();
    if (!adminSession) {
        const session = await verifyVendorSession(supabase);
        if (!session?.vendorId || session.vendorId !== vendorUuid) redirect('/vendor');
    }

    // Validate UUID — exact match against vendors.id
    const { data: vendor } = await supabase
        .from('vendors')
        .select('id, vendor_name')
        .eq('id', vendorUuid)
        .maybeSingle();

    if (!vendor) redirect('/vendor');

    // Guard: slug in URL must match the vendor record
    const expectedSlug = vendor.vendor_name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    if (expectedSlug !== vendorName) redirect('/unauthorized');

    const displayName = vendor.vendor_name;

    const { data: projects, error } = await supabase
        .from('projects')
        .select(`
            id,
            project_name,
            status,
            is_approved,
            country,
            deadline,
            start_date,
            total_quantity,
            created_date,
            language,
            is_priority,
            project_languages ( lang_code, ratio ),
            project_targets ( category ),
            project_plans ( campaign_id, project_campaigns ( id, title ) ),
            projects_hub ( hash, vendor_staging_data, is_locked, targets ),
            placements ( id )
        `)
        .eq('vendor_id', vendor.id)
        .order('created_date', { ascending: false });

    if (error) console.error('Vendor InProgress fetch error:', error);

    const activeProjects = (projects || []).filter(p => {
        const hasPlacements = p.placements && p.placements.length > 0;
        return p.is_approved && p.status !== 'Finalized' && !hasPlacements;
    });

    return (
        <div className="max-w-6xl mx-auto px-6 py-8 pb-20 relative">
            <CurrentProjectIndicator vendorName={vendorName} vendorUuid={vendorUuid} activeProjects={activeProjects} />
            <InProgressProjectList projects={activeProjects} vendorName={vendorName} vendorUuid={vendorUuid} displayName={displayName} />
        </div>
    );
}
