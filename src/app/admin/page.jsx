import { getServerSupabase } from '@/lib/supabase-server';
import DashboardLanding from './DashboardLanding';

export const dynamic = 'force-dynamic';

export default async function AdminMetricsPage() {
    const supabase = getServerSupabase();

    const today = new Date().toISOString().substring(0, 10);
    const plus5 = new Date();
    plus5.setDate(plus5.getDate() + 5);
    const todayPlus5 = plus5.toISOString().substring(0, 10);

    const [
        { data: placements },
        { data: projects },
        { data: weekPlans },
        { data: upcomingPlans },
        { data: packages },
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
            is_approved,
            project_targets ( price, quantity_requested )
        `),
        // This week: plans whose deadline falls within next 7 days or is ongoing now
        supabase.from('project_plans').select(`
            id,
            campaign_id,
            step_order,
            category,
            plan_info,
            start_date,
            end_date,
            total_quantity,
            vendors ( vendor_name ),
            projects (
                id,
                project_name,
                status,
                is_priority,
                payment_status,
                projects_hub ( vendor_staging_data )
            ),
            project_campaigns ( title )
        `)
        .lte('start_date', today)
        .gte('end_date', today),
        // Upcoming: plans starting within the next 5 days that haven't started yet
        supabase.from('project_plans').select(`
            id,
            campaign_id,
            step_order,
            category,
            plan_info,
            start_date,
            end_date,
            total_quantity,
            vendors ( vendor_name ),
            projects (
                id,
                project_name,
                status,
                is_priority,
                payment_status,
                projects_hub ( vendor_staging_data )
            ),
            project_campaigns ( title )
        `)
        .gt('start_date', today)
        .lte('start_date', todayPlus5)
        .order('start_date', { ascending: true }),
        // Packages — for cost card split
        supabase.from('backlink_packages').select('total_price, payment_status'),
    ]);

    const computeCompletedCount = (plans) => (plans || []).map(plan => {
        const projectList = Array.isArray(plan.projects) ? plan.projects : (plan.projects ? [plan.projects] : []);
        return {
            ...plan,
            projects: projectList.map(p => {
                const hub = Array.isArray(p.projects_hub) ? p.projects_hub[0] : p.projects_hub;
                if (!hub) return p;
                const staging = Array.isArray(hub.vendor_staging_data) ? hub.vendor_staging_data : [];
                const completed_count = staging.filter(s =>
                    s.published_url && s.published_url.trim().length > 0 &&
                    s.published_date && s.published_date.trim().length > 0
                ).length;
                return { ...p, projects_hub: [{ completed_count }] };
            }),
        };
    });

    return (
        <DashboardLanding
            placements={placements || []}
            packages={packages || []}
            projects={projects || []}
            weekPlans={computeCompletedCount(weekPlans)}
            upcomingPlans={computeCompletedCount(upcomingPlans)}
        />
    );
}
