import { getServerSupabase } from '@/lib/supabase-server';
import { redirect } from 'next/navigation';
import { Clock, AlertCircle } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function VendorPendingPage({ params }) {
    const supabase = getServerSupabase();
    const resolvedParams = await params;
    const vendorName = resolvedParams?.vendor_name;
    const vendorUuid = resolvedParams?.vendor_uuid;

    if (!vendorName || !vendorUuid) redirect('/vendor');

    const { data: vendor } = await supabase
        .from('vendors')
        .select('id, vendor_name')
        .eq('id', vendorUuid)
        .maybeSingle();

    if (!vendor) redirect('/vendor');

    const expectedSlug = vendor.vendor_name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    if (expectedSlug !== vendorName) redirect('/unauthorized');

    const displayName = vendor.vendor_name;

    const { data: projects, error } = await supabase
        .from('projects')
        .select(`
            id,
            project_name,
            status,
            is_approved,
            country,
            total_quantity,
            created_date,
            language,
            project_languages ( lang_code, ratio ),
            project_targets ( category ),
            projects_hub ( targets )
        `)
        .eq('vendor_id', vendor.id)
        .order('created_date', { ascending: false });

    if (error) console.error('Vendor Pending fetch error:', error);

    const pendingProjects = (projects || []).filter(p => !p.is_approved);

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
                <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Pending Payment</h1>
                <p className="mt-2 text-sm text-gray-500">
                    Projects awaiting approval for <span className="font-semibold text-indigo-600">{displayName}</span>
                </p>
            </div>

            <div className="mb-6 flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                <p>These projects are pending admin approval. You will be notified once they are approved and ready for work.</p>
            </div>

            <div className="space-y-6">
                {pendingProjects.length > 0 ? (
                    pendingProjects.map((project) => {
                        const category = project.project_targets?.[0]?.category;
                        return (
                            <div key={project.id} className="bg-white rounded-xl shadow-sm ring-1 ring-gray-200 overflow-hidden">
                                <div className="px-6 py-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2">
                                            <h2 className="text-lg font-bold text-gray-900">{project.project_name || 'Unnamed Project'}</h2>
                                            <span className="flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold rounded bg-amber-50 text-amber-700 border border-amber-200">
                                                <Clock className="w-3 h-3" /> Pending Payment
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
                                        </div>
                                    </div>
                                    <div className="shrink-0">
                                        <span className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded bg-amber-50 text-amber-700 border border-amber-200">
                                            <Clock className="w-3.5 h-3.5" /> Awaiting Approval
                                        </span>
                                    </div>
                                </div>
                            </div>
                        );
                    })
                ) : (
                    <div className="text-center py-20 bg-white rounded-xl border border-dashed border-gray-300">
                        <p className="text-gray-500">No pending projects.</p>
                    </div>
                )}
            </div>
        </div>
    );
}
