import { supabase } from '@/lib/supabase';
import DashboardClient from './DashboardClient';

export const dynamic = 'force-dynamic';

export default async function AdminDashboardPage() {
    // Fetch recent projects from Supabase ALONG WITH their related Phase 2 Targets and Virtual Staging Data
    const { data: projects, error } = await supabase
        .from('projects')
        .select(`
            id, project_name, vendor_name, status, start_date, deadline, created_at, updated_at, quantity, dripfeed_enabled, dripfeed_period, urls_per_day, backlinks_category,
            project_targets ( target_url, quantity ),
            project_list ( vendor_staging_data ),
            placements ( id )
        `)
        .order('created_at', { ascending: false });

    if (error) {
        console.error("Dashboard DB fetch error:", error);
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
        <DashboardClient initialProjects={projects || []} />
    );
}
