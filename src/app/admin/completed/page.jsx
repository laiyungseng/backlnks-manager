import { supabase } from '@/lib/supabase';
import CompletedDashboardClient from './CompletedDashboardClient';
export const revalidate = 0; // Always fresh

export default async function CompletedPlacementsPage() {
    const { data: projects, error } = await supabase
        .from('projects')
        .select(`
            id,
            owner,
            created_date,
            completed_date,
            status,
            project_name,
            country,
            dripfeed_enabled,
            dripfeed_period,
            urls_per_day,
            total_quantity,
            vendors ( vendor_name ),
            project_languages ( lang_code, ratio ),
            project_targets ( category, sheet_name ),
            projects_hub ( hash, vendor_staging_data, completed_at, is_locked, targets ),
            placements ( id )
        `)
        .order('created_date', { ascending: false });

    if (error) console.error("Completed Placements DB fetch error:", error);

    const completedProjects = (projects || []).filter(p => {
        const hasPlacements = p.placements && p.placements.length > 0;
        const isFinalized = p.status === 'Finalized';
        return isFinalized || hasPlacements;
    });

    return <CompletedDashboardClient projects={completedProjects} />;
}
