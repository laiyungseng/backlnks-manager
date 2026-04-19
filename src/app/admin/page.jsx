import { getServerSupabase } from '@/lib/supabase-server';
import DashboardLanding from './DashboardLanding';

export const dynamic = 'force-dynamic';

export default async function AdminMetricsPage() {
    const supabase = getServerSupabase();

    const [
        { data: placements },
        { data: projects },
        { data: vendors },
    ] = await Promise.all([
        supabase.from('placements').select(`
            id,
            status,
            indexed_status,
            published_date,
            created_at,
            vendors ( vendor_name )
        `),
        supabase.from('projects').select(`
            id,
            price,
            price_type,
            total_quantity,
            created_date,
            completed_date,
            status,
            vendors ( vendor_name )
        `),
        supabase.from('vendors').select(`
            id,
            vendor_name,
            employ_status,
            performance,
            remark
        `),
    ]);

    return (
        <DashboardLanding
            placements={placements || []}
            projects={projects || []}
            vendors={vendors || []}
        />
    );
}
