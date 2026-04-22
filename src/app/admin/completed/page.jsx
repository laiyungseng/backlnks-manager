import { getServerSupabase } from '@/lib/supabase-server';
import CompletedDashboardClient from './CompletedDashboardClient';
export const revalidate = 0; // Always fresh

export default async function CompletedPlacementsPage() {
    const supabase = getServerSupabase();
    const { data: projects, error } = await supabase
        .from('projects')
        .select(`
            id,
            owner,
            created_date,
            completed_date,
            closed_date,
            status,
            project_name,
            country,
            dripfeed_enabled,
            dripfeed_period,
            urls_per_day,
            total_quantity,
            vendor_id,
            vendors ( vendor_name ),
            project_languages ( lang_code, ratio ),
            project_targets ( category, sheet_name ),
            projects_hub ( hash, vendor_staging_data, completed_at, is_locked, targets ),
            placements ( id )
        `)
        .order('created_date', { ascending: false });

    if (error) console.error("Completed/Closed Placements DB fetch error:", error);

    // Finalized projects — strip vendor_staging_data blob, compute completed_count
    const finalizedProjects = (projects || [])
        .filter(p => p.status === 'Finalized' || (p.placements && p.placements.length > 0))
        .map(p => {
            const hub = p.projects_hub?.[0];
            if (!hub) return p;
            const staging = Array.isArray(hub.vendor_staging_data) ? hub.vendor_staging_data : [];
            const completed_count = staging.filter(s => s.published_url && s.published_url.trim().length > 0).length;
            const { vendor_staging_data: _dropped, ...hubWithoutBlob } = hub;
            return { ...p, projects_hub: [{ ...hubWithoutBlob, completed_count }] };
        });

    // Closed projects — also strip blob
    const closedProjects = (projects || [])
        .filter(p => p.status === 'Closed')
        .map(p => {
            const hub = p.projects_hub?.[0];
            if (!hub) return p;
            const staging = Array.isArray(hub.vendor_staging_data) ? hub.vendor_staging_data : [];
            const completed_count = staging.filter(s => s.published_url && s.published_url.trim().length > 0).length;
            const { vendor_staging_data: _dropped, ...hubWithoutBlob } = hub;
            return { ...p, projects_hub: [{ ...hubWithoutBlob, completed_count }] };
        });

    return <CompletedDashboardClient finalizedProjects={finalizedProjects} closedProjects={closedProjects} />;
}
