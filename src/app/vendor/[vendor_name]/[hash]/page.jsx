import { getServerSupabase } from '@/lib/supabase-server';
import { redirect } from 'next/navigation';
import VendorForm from './VendorForm';
import VendorSessionSetter from './VendorSessionSetter';
import VendorSidebar from './VendorSidebar';
import { writeAuditLog } from '@/lib/auditLog';
import { generateVendorRows } from '@/lib/vendorRowGenerator';
import { resolveActor } from '@/lib/session';

export const dynamic = 'force-dynamic';

export default async function VendorProjectPage({ params }) {
    const supabase = getServerSupabase();
    const resolvedParams = await params;
    const hash = resolvedParams?.hash;
    const vendorNameParam = resolvedParams?.vendor_name;

    if (!hash) {
        redirect('/unauthorized');
    }

    // Cryptographically Secure DB Match via `projects_hub.hash`
    const { data: projectsHub, error: hubError } = await supabase
        .from('projects_hub')
        .select('*')
        .eq('hash', hash)
        .single();

    if (hubError || !projectsHub) {
        redirect('/unauthorized');
    }

    const projectId = projectsHub.project_id;
    const existingStagingData = projectsHub.vendor_staging_data || [];
    const isLocked = projectsHub.is_locked || false;

    // Fetch Core Project Context (include vendor_id for IDOR check)
    const { data: projectData } = await supabase
        .from('projects')
        .select('project_name, status, deadline, dripfeed_enabled, dripfeed_period, urls_per_day, url_entry_enabled, language, randomize_languages, vendor_id, project_languages ( lang_code, ratio )')
        .eq('id', projectId)
        .single();

    // IDOR Guard — verify hash belongs to the vendor in the URL
    let vendorUuid = null;
    if (projectData?.vendor_id) {
        const { data: vendorMatch } = await supabase
            .from('vendors')
            .select('id, vendor_name')
            .eq('id', projectData.vendor_id)
            .maybeSingle();
        if (!vendorMatch) {
            redirect('/unauthorized');
        }
        const expectedSlug = vendorMatch.vendor_name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
        if (expectedSlug !== vendorNameParam) {
            redirect('/unauthorized');
        }
        vendorUuid = vendorMatch.id;
    }

    // Log vendor page view (non-blocking) — resolve actor to distinguish admin vs vendor
    if (vendorUuid) {
        const actor = await resolveActor(supabase);
        void writeAuditLog(supabase, {
            action: 'vendor_project_view',
            actor: actor?.actorLabel ?? null,
            actorId: vendorUuid,
            targetId: projectId,
            detail: `hash=${hash}`,
        });
    }

    // Fetch sibling projects for this vendor (for sidebar campaign switcher)
    let siblingProjects = [];
    if (vendorUuid) {
        const { data: siblings } = await supabase
            .from('projects')
            .select(`
                id, project_name, status, is_approved, is_priority, dripfeed_enabled,
                created_date, start_date,
                projects_hub ( hash ),
                project_plans ( campaign_id, project_campaigns ( id, title ) ),
                project_targets ( category )
            `)
            .eq('vendor_id', vendorUuid)
            .order('created_date', { ascending: false });

        siblingProjects = (siblings || [])
            .filter(p => p.is_approved)
            .map(p => {
                const planRow = p.project_plans?.[0] || null;
                const campaign = planRow?.project_campaigns || null;
                return {
                    id: p.id,
                    project_name: p.project_name,
                    hash: p.projects_hub?.[0]?.hash || null,
                    is_priority: p.is_priority || false,
                    dripfeed_enabled: p.dripfeed_enabled || false,
                    status: p.status || 'Inprogress',
                    created_date: p.created_date || null,
                    start_date: p.start_date || null,
                    campaign_id: planRow?.campaign_id || null,
                    campaign_title: campaign?.title || null,
                    category: p.project_targets?.[0]?.category || null,
                };
            })
            .filter(p => p.hash);
    }

    const isFinalized = projectData?.status === 'Finalized';

    // Find the campaign this project belongs to, then fetch all sibling plans (= other projects under the same campaign)
    const { data: ownCampaignRow } = await supabase
        .from('project_plans')
        .select('campaign_id')
        .eq('project_id', projectId)
        .maybeSingle();
    const campaignId = ownCampaignRow?.campaign_id || null;

    let siblingPlans = [];
    if (campaignId && vendorUuid) {
        const { data: siblingProjectIds } = await supabase
            .from('project_plans')
            .select('project_id')
            .eq('campaign_id', campaignId);
        const ids = [...new Set((siblingProjectIds || []).map(r => r.project_id).filter(Boolean))];
        if (ids.length > 0) {
            const { data: siblingProjects } = await supabase
                .from('projects')
                .select(`
                    id, project_name, status, deadline, start_date, created_date, is_priority,
                    project_targets ( category ),
                    projects_hub ( hash, vendor_staging_data, targets )
                `)
                .in('id', ids)
                .eq('vendor_id', vendorUuid)
                .order('created_date', { ascending: true });

            siblingPlans = (siblingProjects || [])
                .map((p, idx) => {
                    const hub = p.projects_hub?.[0] || {};
                    if (!hub.hash) return null;
                    const targets = Array.isArray(hub.targets) ? hub.targets : [];
                    const staging = Array.isArray(hub.vendor_staging_data) ? hub.vendor_staging_data : [];
                    const total = targets.reduce((acc, t) => acc + (parseInt(t.quantity || '0', 10)), 0);
                    const completed = staging.filter(s => s.published_url && s.published_url.trim().length > 0).length;
                    let status = 'pending';
                    if (p.status === 'Finalized') status = 'done';
                    else if (total > 0 && completed >= total) status = 'done';
                    else if (completed > 0) status = 'progress';
                    return {
                        order: idx,
                        hash: hub.hash,
                        label: `Plan ${idx + 1}`,
                        category: p.project_targets?.[0]?.category || null,
                        startDate: p.start_date || null,
                        deadline: p.deadline || null,
                        isPriority: !!p.is_priority,
                        completed,
                        total,
                        status,
                    };
                })
                .filter(Boolean);
        }
    }

    // Parse targets from JSONB Hub
    const targetsData = Array.isArray(projectsHub.targets) ? projectsHub.targets : [];

    const generatedRows = generateVendorRows({
        targets: targetsData,
        languages: projectData?.project_languages || [],
        fallbackLanguage: projectData?.language,
        existingStagingData,
        randomizeLanguages: !!projectData?.randomize_languages,
    });

    return (
        <div className="flex h-screen bg-gray-50 overflow-hidden">
            <VendorSessionSetter hash={hash} />
            {vendorUuid && (
                <VendorSidebar
                    vendorName={vendorNameParam}
                    vendorUuid={vendorUuid}
                    currentHash={hash}
                    projects={siblingProjects}
                />
            )}
            <main id="vendor-main" className="flex-1 min-w-0 overflow-y-auto">
                <div className="max-w-none px-4 sm:px-6 lg:px-8 py-8 pb-12">
                    <div className="bg-white shadow-sm rounded-xl border border-gray-200 p-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
                                Assignment: <span className="text-indigo-600">{projectData?.project_name || 'Active SEO Project'}</span>
                            </h1>
                            <p className="text-sm text-gray-500 mt-1">Please fulfill all requested Target URL allocations below.</p>
                        </div>
                        <div className="px-4 py-2 bg-red-50 text-red-700 rounded-md border border-red-100 font-medium text-sm shadow-sm whitespace-nowrap">
                            Deadline: {projectData?.deadline ? new Date(projectData.deadline).toLocaleDateString() : 'N/A'}
                        </div>
                    </div>

                    <VendorForm
                        initialRows={generatedRows}
                        projectHash={hash}
                        siblingPlans={siblingPlans}
                        vendorName={vendorNameParam}
                        dripfeedEnabled={projectData?.dripfeed_enabled}
                        dripfeedPeriod={projectData?.dripfeed_period}
                        urlsPerDay={projectData?.urls_per_day}
                        isLocked={isLocked}
                        isFinalized={isFinalized}
                        urlEntryEnabled={projectData?.url_entry_enabled ?? true}
                        initialVersion={projectsHub.version ?? 1}
                    />
                </div>
            </main>
        </div>
    );
}
