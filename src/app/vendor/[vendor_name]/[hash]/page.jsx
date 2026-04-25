import { getServerSupabase } from '@/lib/supabase-server';
import { redirect } from 'next/navigation';
import VendorForm from './VendorForm';
import VendorSessionSetter from './VendorSessionSetter';
import VendorSidebar from './VendorSidebar';
import { writeAuditLog } from '@/lib/auditLog';

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

    // Log vendor page view (non-blocking)
    if (vendorUuid) {
        void writeAuditLog(supabase, {
            action: 'vendor_project_view',
            actorId: vendorUuid,
            targetId: projectId,
            detail: `hash=${hash}`,
        });
    }

    // Fetch sibling projects for this vendor (for sidebar project switcher)
    let siblingProjects = [];
    if (vendorUuid) {
        const { data: siblings } = await supabase
            .from('projects')
            .select('id, project_name, status, is_approved, projects_hub ( hash ), placements ( id )')
            .eq('vendor_id', vendorUuid)
            .order('created_date', { ascending: false });

        siblingProjects = (siblings || [])
            .filter(p => {
                const hasPlacements = p.placements && p.placements.length > 0;
                return p.is_approved && p.status !== 'Finalized' && !hasPlacements;
            })
            .map(p => ({
                project_name: p.project_name,
                hash: p.projects_hub?.[0]?.hash || null,
            }))
            .filter(p => p.hash);
    }

    const isFinalized = projectData?.status === 'Finalized';

    // Parse targets from JSONB Hub
    const targetsData = Array.isArray(projectsHub.targets) ? projectsHub.targets : [];

    // Parse language distribution from normalized project_languages
    const languages = (projectData?.project_languages || []).map(l => ({ 'lang-code': l.lang_code, ratio: l.ratio }));

    // Create linear pool of languages based on precise quantities
    const languagePool = [];
    if (languages.length > 0) {
        languages.forEach(lang => {
            const qty = parseInt(lang.ratio || '0', 10);
            for (let i = 0; i < qty; i++) {
                languagePool.push(lang['lang-code']?.toUpperCase() || 'EN');
            }
        });
    }

    // Expand Target Rows with sequential linear language assignment
    let generatedRows = [];
    let globalLangIndex = 0;

    if (targetsData && targetsData.length > 0) {
        targetsData.forEach((target, tIdx) => {
            const targetId = target.target_id || `idx-${tIdx}`; // Synthetic target ID fallback
            const targetQty = parseInt(target.quantity || '0', 10); // Parse string quantity from JSON

            for (let i = 0; i < targetQty; i++) {
                const assignedLang = languagePool.length > 0 
                  ? (languagePool[globalLangIndex] || languagePool[languagePool.length - 1]) 
                  : (projectData?.language?.toUpperCase() || 'EN');
                
                // Track language advancement
                if (languagePool.length > 0) {
                    globalLangIndex++;
                }

                // ID formats to retain backward compatibility with old staging data
                const rowId = `${targetId}-${assignedLang}-qty-${i}`;
                const legacyRowId = `${targetId}-qty-${generatedRows.length}`;
                const legacyNoLangRowId = `${targetId}-qty-${i}`;
                const undefinedEraRowId = `${targetId}-undefined-qty-${i}`;
                
                const savedRow = Array.isArray(existingStagingData)
                    ? (existingStagingData.find(st => st.id === rowId)
                        || existingStagingData.find(st => st.id === legacyRowId)
                        || existingStagingData.find(st => st.id === legacyNoLangRowId)
                        || existingStagingData.find(st => st.id === undefinedEraRowId))
                    : null;

                generatedRows.push({
                    id: rowId,
                    target_id: targetId,
                    tIdx: tIdx,
                    langIdx: languagePool.indexOf(assignedLang), // Generic grouping info
                    target_url: target.target_url,
                    anchor_text: target.anchor_text,
                    language: assignedLang,
                    domain_url: savedRow?.domain_url || '',
                    published_url: savedRow?.published_url || '',
                    published_date: savedRow?.published_date || '',
                    remark: savedRow?.remark || '',
                    indexed_status: savedRow?.indexed_status || '',
                    indexed_datetime: savedRow?.indexed_datetime || '',
                });
            }
        });
    }

    // Apply deterministic randomization if enabled
    if (projectData?.randomize_languages && generatedRows.length > 0) {
        generatedRows.sort((a, b) => {
            const hashA = [...a.id].reduce((acc, char) => (acc * 31 + char.charCodeAt(0)) | 0, 0);
            const hashB = [...b.id].reduce((acc, char) => (acc * 31 + char.charCodeAt(0)) | 0, 0);
            return hashA - hashB;
        });
    } else if (generatedRows.length > 0) {
        // Group by Target sequence first, then language within each target
        generatedRows.sort((a, b) => {
            if (a.tIdx !== b.tIdx) {
                return (a.tIdx || 0) - (b.tIdx || 0);
            }
            return (a.langIdx || 0) - (b.langIdx || 0);
        });
    }

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
            <main className="flex-1 min-w-0 overflow-y-auto">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-12">
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
