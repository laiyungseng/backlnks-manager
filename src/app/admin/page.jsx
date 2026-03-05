import { supabase } from '@/lib/supabase';
import DashboardClient from './DashboardClient';

export const dynamic = 'force-dynamic';

export default async function AdminDashboardPage() {
    // Fetch recent projects from Supabase ALONG WITH their related Phase 2 Targets and Virtual Staging Data
    const { data: projects, error } = await supabase
        .from('projects')
        .select(`
            id, user, created_date, complete_date, project_details,
            projects_hub ( targets, vendor_staging_data ),
            placements ( id )
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
        <DashboardClient initialProjects={projects || []} />
    );
}
