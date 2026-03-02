import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import { ExternalLink, Clock, CheckCircle2 } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function VendorInProgressPage({ params }) {
    const resolvedParams = await params;
    const vendorName = resolvedParams?.vendor_name;

    if (!vendorName) {
        return <div className="p-8 text-center text-gray-500">Invalid vendor path.</div>;
    }

    // Decode vendor name for display
    const displayName = vendorName.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

    // Fetch all projects assigned to this vendor that are NOT finalized
    const { data: projects, error } = await supabase
        .from('projects')
        .select(`
            id,
            project_name,
            vendor_name,
            status,
            country,
            language,
            languages,
            backlinks_category,
            quantity,
            deadline,
            dripfeed_enabled,
            urls_per_day,
            project_list ( hash, vendor_staging_data, is_locked ),
            project_targets ( id, target_url, anchor_text, quantity ),
            placements ( id )
        `)
        .ilike('vendor_name', vendorName.replace(/-/g, '%'))
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Vendor InProgress fetch error:', error);
    }

    // Filter: only show non-finalized, non-completed projects
    const activeProjects = (projects || []).filter(p => {
        const hasPlacements = p.placements && p.placements.length > 0;
        return p.status !== 'Finalized' && !hasPlacements;
    });

    // Helper to format language display
    const formatLanguages = (project) => {
        if (Array.isArray(project.languages) && project.languages.length > 0) {
            return project.languages.map(l => `${l.code} (${l.ratio}%)`).join(', ');
        }
        return project.language ? `${project.language} (100%)` : '—';
    };

    // Helper to calculate progress
    const getProgress = (project) => {
        const stagingData = project.project_list?.[0]?.vendor_staging_data || [];
        const completed = Array.isArray(stagingData)
            ? stagingData.filter(s => s.published_url && s.published_url.trim().length > 0).length
            : 0;
        const total = project.project_targets
            ? project.project_targets.reduce((acc, t) => acc + (t.quantity || 1), 0)
            : project.quantity || 0;
        return { completed, total, percent: total > 0 ? Math.round((completed / total) * 100) : 0 };
    };

    return (
        <div className="max-w-6xl mx-auto px-6 py-8 pb-20">
            <div className="mb-8">
                <h1 className="text-3xl font-bold text-gray-900 tracking-tight">In Progress Projects</h1>
                <p className="mt-2 text-sm text-gray-500">
                    All active assignments for <span className="font-semibold text-indigo-600">{displayName}</span>
                </p>
            </div>

            <div className="space-y-6">
                {activeProjects.length > 0 ? (
                    activeProjects.map((project) => {
                        const hash = project.project_list?.[0]?.hash;
                        const progress = getProgress(project);

                        return (
                            <div key={project.id} className="bg-white rounded-xl shadow-sm ring-1 ring-gray-200 overflow-hidden hover:shadow-md transition-shadow">
                                <div className="px-6 py-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                                    <div className="flex-1">
                                        <h2 className="text-lg font-bold text-gray-900">{project.project_name}</h2>
                                        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs">
                                            <div>
                                                <span className="text-gray-400">Status: </span>
                                                <span className="font-semibold text-yellow-700">{project.status}</span>
                                            </div>
                                            {project.country && (
                                                <div>
                                                    <span className="text-gray-400">Country: </span>
                                                    <span className="font-semibold text-gray-700 uppercase">{project.country}</span>
                                                </div>
                                            )}
                                            <div>
                                                <span className="text-gray-400">Language: </span>
                                                <span className="font-semibold text-gray-700 uppercase">{formatLanguages(project)}</span>
                                            </div>
                                            {project.backlinks_category && (
                                                <div>
                                                    <span className="text-gray-400">Category: </span>
                                                    <span className="font-semibold text-purple-700">{project.backlinks_category}</span>
                                                </div>
                                            )}
                                            {project.deadline && (
                                                <div className="flex items-center gap-1">
                                                    <Clock className="w-3 h-3 text-red-500" />
                                                    <span className="text-gray-400">Deadline: </span>
                                                    <span className="font-semibold text-red-600">{new Date(project.deadline).toLocaleDateString()}</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-4 shrink-0">
                                        {/* Progress */}
                                        <div className="text-center">
                                            <div className="text-sm font-bold text-gray-900">
                                                {progress.completed} <span className="text-gray-400 font-normal">/ {progress.total}</span>
                                            </div>
                                            <div className="w-28 bg-gray-100 rounded-full h-1.5 mt-1 overflow-hidden">
                                                <div className="bg-indigo-600 h-1.5 transition-all" style={{ width: `${progress.percent}%` }} />
                                            </div>
                                        </div>

                                        {/* Go to Project Button */}
                                        {hash && (
                                            <Link
                                                href={`/vendor/${vendorName}/${hash}`}
                                                className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 text-white text-sm font-bold rounded-lg hover:bg-indigo-700 transition-colors shadow-sm"
                                            >
                                                <ExternalLink className="w-4 h-4" />
                                                Open Project
                                            </Link>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })
                ) : (
                    <div className="text-center py-20 bg-white rounded-xl border border-dashed border-gray-300">
                        <p className="text-gray-500">No active projects at the moment.</p>
                    </div>
                )}
            </div>
        </div>
    );
}
