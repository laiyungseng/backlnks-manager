import { getServerSupabase } from '@/lib/supabase-server';
import ProjectDetailsClient from './ProjectDetailsClient';

export const dynamic = 'force-dynamic';

export default async function AdminProjectDetailsPage() {
    const supabase = getServerSupabase();
    // Fetch recent projects from Supabase ALONG WITH their related Phase 2 Targets and Virtual Staging Data
    const { data: projects, error } = await supabase
        .from('projects')
        .select(`
            id, owner, created_date, completed_date,
            project_name, country, total_quantity,
            status, is_approved, start_date, deadline, price, price_type,
            dripfeed_enabled, dripfeed_period, urls_per_day,
            vendors ( vendor_name ),
            projects_hub ( targets, vendor_staging_data ),
            placements ( id ),
            project_languages ( lang_code, ratio ),
            project_targets ( category, sheet_name )
        `)
        .order('created_date', { ascending: false });

    if (error) {
        console.error("Dashboard DB fetch error:", JSON.stringify(error, null, 2));
    }

    // Helper for safe URL parsing
    const getSafeHostname = (urlString) => {
        if (!urlString) return 'Unknown';
        try {
            return new URL(urlString).hostname;
        } catch (e) {
            return urlString;
        }
    };

    return (
        <ProjectDetailsClient initialProjects={projects || []} />
    );
}
