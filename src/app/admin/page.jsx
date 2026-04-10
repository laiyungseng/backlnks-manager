import { getServerSupabase } from '@/lib/supabase-server';
import DashboardLanding from './DashboardLanding';

export const dynamic = 'force-dynamic';

export default async function AdminMetricsPage() {
    const supabase = getServerSupabase();

    // 1. Fetch Placements for Index Rate & Error Rate
    const { data: placements, error: placementsErr } = await supabase
        .from('placements')
        .select(`
            id,
            status,
            indexed_status,
            published_date,
            created_at,
            vendors ( vendor_name )
        `);
        
    // 2. Fetch Projects for Cost and Speed metrics
    const { data: projects, error: projectsErr } = await supabase
        .from('projects')
        .select(`
            id,
            price,
            price_type,
            total_quantity,
            created_date,
            completed_date,
            status,
            vendors ( vendor_name )
        `);

    // 3. Fetch Vendors for Employ Status table
    const { data: vendors, error: vendorsErr } = await supabase
        .from('vendors')
        .select(`
            id,
            vendor_name,
            employ_status,
            performance,
            remark
        `);

    return (
        <DashboardLanding
            placements={placements || []}
            projects={projects || []}
            vendors={vendors || []}
        />
    );
}
