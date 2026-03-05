import { supabase } from '@/lib/supabase';
import PlacementCard from '../placements/PlacementCard';
export const revalidate = 0; // Always fresh

export default async function CompletedPlacementsPage() {
    const { data: projects, error } = await supabase
        .from('projects')
        .select(`
            id,
            user,
            created_date,
            complete_date,
            project_details,
            projects_hub ( hash, vendor_staging_data, completed_at, is_locked, targets ),
            placements ( id )
        `)
        .order('created_date', { ascending: false });

    if (error) {
        console.error("Completed Placements DB fetch error:", error);
    }

    // Filter: Only show projects that HAVE been uploaded to the placements table
    const completedProjects = (projects || []).filter(p => {
        const hasPlacements = p.placements && p.placements.length > 0;
        const details = p.project_details?.[0] || {};
        return details.status === 'Finalized' || hasPlacements;
    });

    return (
        <div className="max-w-7xl mx-auto space-y-10 pb-20">
            <div>
                <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Completed Placements</h1>
                <p className="mt-2 text-sm text-gray-500">
                    Finalized projects that have been approved and uploaded to the database.
                </p>
            </div>

            <div className="space-y-12">
                {completedProjects.length > 0 ? (
                    completedProjects.map((project) => {
                        const representativeHash = project.projects_hub?.[0]?.hash;

                        return (
                            <PlacementCard
                                key={project.id}
                                project={project}
                                representativeHash={representativeHash}
                            />
                        );
                    })
                ) : (
                    <div className="text-center py-20 bg-white rounded-xl border border-dashed border-gray-300">
                        <p className="text-gray-500">No completed projects yet. Finalized projects will appear here.</p>
                    </div>
                )}
            </div>
        </div>
    );
}
