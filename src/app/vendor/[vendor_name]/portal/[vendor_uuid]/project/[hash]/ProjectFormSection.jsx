import { redirect } from 'next/navigation';
import { getServerSupabase } from '@/lib/supabase-server';
import VendorForm from '@/app/vendor/[vendor_name]/[hash]/VendorForm';
import VendorSessionSetter from '@/app/vendor/[vendor_name]/[hash]/VendorSessionSetter';
import { generateVendorRows } from '@/lib/vendorRowGenerator';

export default async function ProjectFormSection({
    projectId,
    hash,
    vendorName,
    vendorUuid,
}) {
    const supabase = getServerSupabase();

    const { data: projectsHub, error: hubError } = await supabase
        .from('projects_hub')
        .select('targets, vendor_staging_data, is_locked, version')
        .eq('hash', hash)
        .eq('project_id', projectId)
        .single();

    if (hubError || !projectsHub) redirect('/unauthorized');

    const { data: projectData } = await supabase
        .from('projects')
        .select('status, dripfeed_enabled, dripfeed_period, urls_per_day, url_entry_enabled, language, randomize_languages, project_languages ( lang_code, ratio )')
        .eq('id', projectId)
        .eq('vendor_id', vendorUuid)
        .single();

    if (!projectData) redirect('/unauthorized');

    const { data: ownCampaignRow } = await supabase
        .from('project_plans')
        .select('campaign_id')
        .eq('project_id', projectId)
        .maybeSingle();
    const campaignId = ownCampaignRow?.campaign_id || null;

    let siblingPlans = [];
    if (campaignId) {
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

    const generatedRows = generateVendorRows({
        targets: Array.isArray(projectsHub.targets) ? projectsHub.targets : [],
        languages: projectData?.project_languages || [],
        fallbackLanguage: projectData?.language,
        existingStagingData: Array.isArray(projectsHub.vendor_staging_data) ? projectsHub.vendor_staging_data : [],
        randomizeLanguages: !!projectData?.randomize_languages,
    });

    return (
        <div className="max-w-none px-4 sm:px-6 lg:px-8 py-6 pb-12">
            <VendorSessionSetter key={`session-${hash}`} hash={hash} />

            <VendorForm
                key={hash}
                initialRows={generatedRows}
                projectHash={hash}
                siblingPlans={siblingPlans}
                vendorName={vendorName}
                vendorUuid={vendorUuid}
                dripfeedEnabled={projectData?.dripfeed_enabled}
                dripfeedPeriod={projectData?.dripfeed_period}
                urlsPerDay={projectData?.urls_per_day}
                isLocked={projectsHub.is_locked || false}
                isFinalized={projectData?.status === 'Finalized'}
                urlEntryEnabled={projectData?.url_entry_enabled ?? true}
                initialVersion={projectsHub.version ?? 1}
            />
        </div>
    );
}
