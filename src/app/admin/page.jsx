import { supabase } from '@/lib/supabase';
import DashboardLanding from './DashboardLanding';

export const dynamic = 'force-dynamic';

export default async function AdminMetricsPage() {
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
        
    if (placementsErr) {
        console.error("Failed to fetch placements for metrics:", placementsErr);
    }

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
            status
        `);

    if (projectsErr) {
        console.error("Failed to fetch projects for metrics:", projectsErr);
    }

    return (
        <DashboardLanding 
            placements={placements || []} 
            projects={projects || []} 
        />
    );
}
