import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import { Lock, ExternalLink, CheckCircle2 } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function VendorCompletedPage({ params }) {
    const resolvedParams = await params;
    const vendorName = resolvedParams?.vendor_name;

    if (!vendorName) {
        return <div className="p-8 text-center text-gray-500">Invalid vendor path.</div>;
    }

    const displayName = vendorName.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

    // Resolve vendor_id from URL slug
    const { data: vendorMatch } = await supabase
        .from('vendors')
        .select('id, vendor_name')
        .ilike('vendor_name', `%${vendorName.replace(/-/g, '%')}%`)
        .maybeSingle();

    const { data: projects, error } = vendorMatch
        ? await supabase
            .from('projects')
            .select(`
                id,
                project_name,
                status,
                country,
                total_quantity,
                created_date,
                language,
                project_languages ( lang_code, ratio ),
                project_targets ( category ),
                projects_hub ( hash, vendor_staging_data, is_locked, targets ),
                placements ( id )
            `)
            .eq('vendor_id', vendorMatch.id)
            .order('created_date', { ascending: false })
        : { data: [] };

    if (error) {
        console.error('Vendor Completed fetch error:', error);
    }

    // Filter to finalized/completed only
    const completedProjects = (projects || []).filter(p => {
        const hasPlacements = p.placements && p.placements.length > 0;
        return p.status === 'Finalized' || hasPlacements;
    });

    const formatLanguages = (project) => {
        if (project.project_languages && project.project_languages.length > 0) {
            return project.project_languages.map(l => `${l.lang_code} (${l.ratio}%)`).join(', ');
        }
        return project.language ? `${project.language} (100%)` : '—';
    };

    const getTotal = (project) => {
        const hub = project.projects_hub?.[0] || {};
        const hubTargets = Array.isArray(hub.targets) ? hub.targets : [];
        return hubTargets.length > 0
            ? hubTargets.reduce((acc, t) => acc + (parseInt(t.quantity || '0', 10)), 0)
            : (project.total_quantity || 0);
    };

    return (
        <div className="max-w-6xl mx-auto px-6 py-8 pb-20">
            <div className="mb-8">
                <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Completed Projects</h1>
                <p className="mt-2 text-sm text-gray-500">
                    Finalized assignments for <span className="font-semibold text-indigo-600">{displayName}</span>
                </p>
            </div>

            <div className="space-y-6">
                {completedProjects.length > 0 ? (
                    completedProjects.map((project) => {
                        const hash = project.projects_hub?.[0]?.hash;
                        const isLocked = project.projects_hub?.[0]?.is_locked || false;
                        const category = project.project_targets?.[0]?.category;

                        return (
                            <div key={project.id} className="bg-white rounded-xl shadow-sm ring-1 ring-gray-200 overflow-hidden">
                                <div className="px-6 py-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2">
                                            <h2 className="text-lg font-bold text-gray-900">{project.project_name || 'Unnamed Project'}</h2>
                                            <span className="flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold rounded bg-green-50 text-green-700 border border-green-200">
                                                <CheckCircle2 className="w-3 h-3" /> Finalized
                                            </span>
                                        </div>
                                        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs">
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
                                            {category && (
                                                <div>
                                                    <span className="text-gray-400">Category: </span>
                                                    <span className="font-semibold text-purple-700">{category}</span>
                                                </div>
                                            )}
                                            <div>
                                                <span className="text-gray-400">Qty: </span>
                                                <span className="font-semibold text-gray-700">{getTotal(project)}</span>
                                            </div>
                                            <div>
                                                <span className="text-gray-400">Target Domain: </span>
                                                {(() => {
                                                    const hubTargets = project.projects_hub?.[0]?.targets || [];
                                                    const safeHostname = (url) => { try { return new URL(url).hostname; } catch (e) { return url; } };
                                                    if (hubTargets.length === 0) return <span className="italic text-gray-400">No Targets</span>;
                                                    if (hubTargets.length === 1) return <span className="font-semibold text-indigo-600 truncate max-w-[200px] inline-block align-bottom">{safeHostname(hubTargets[0].target_url)}</span>;
                                                    return <span className="font-semibold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded text-xs">{hubTargets.length} Target URLs</span>;
                                                })()}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-3 shrink-0">
                                        <span className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded ${isLocked
                                            ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                            : 'bg-blue-50 text-blue-700 border border-blue-200'
                                            }`}>
                                            {isLocked ? <Lock className="w-3.5 h-3.5" /> : <ExternalLink className="w-3.5 h-3.5" />}
                                            {isLocked ? 'Locked' : 'Editable'}
                                        </span>

                                        {hash && !isLocked && (
                                            <Link
                                                href={`/vendor/${vendorName}/${hash}`}
                                                className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 text-white text-sm font-bold rounded-lg hover:bg-indigo-700 transition-colors shadow-sm"
                                            >
                                                <ExternalLink className="w-4 h-4" />
                                                Open
                                            </Link>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })
                ) : (
                    <div className="text-center py-20 bg-white rounded-xl border border-dashed border-gray-300">
                        <p className="text-gray-500">No completed projects yet.</p>
                    </div>
                )}
            </div>
        </div>
    );
}
