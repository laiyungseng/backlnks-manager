import { supabase } from '@/lib/supabase';
import { redirect } from 'next/navigation';
import VendorForm from './VendorForm';

export const dynamic = 'force-dynamic';

export default async function VendorProjectPage({ params }) {
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

    // Fetch Core Project Context
    const { data: projectData } = await supabase
        .from('projects')
        .select('project_details')
        .eq('id', projectId)
        .single();

    const details = projectData?.project_details?.[0] || {};

    // Parse targets from JSONB Hub
    const targetsData = Array.isArray(projectsHub.targets) ? projectsHub.targets : [];

    // Parse language distribution
    const languages = details['languages-ratio'] || [];

    // Expand Target Rows with language assignment
    let generatedRows = [];
    if (targetsData && targetsData.length > 0) {
        targetsData.forEach((target, tIdx) => {
            const targetId = target.target_id || `idx-${tIdx}`; // Synthetic target ID fallback
            const targetQty = parseInt(target.quantity || '0', 10); // Parse string quantity from JSON

            if (languages.length > 0) {
                let remainingQty = targetQty;
                languages.forEach((lang, langIdx) => {
                    let langQty;
                    if (langIdx === languages.length - 1) {
                        langQty = remainingQty;
                    } else {
                        langQty = Math.round(targetQty * lang.ratio / 100);
                        remainingQty -= langQty;
                    }

                    for (let i = 0; i < langQty; i++) {
                        const langCode = lang['lang-code'];
                        const rowId = `${targetId}-${langCode}-qty-${i}`;
                        const legacyRowId = `${targetId}-qty-${generatedRows.length}`;
                        const undefinedEraRowId = `${targetId}-undefined-qty-${i}`;
                        const savedRow = Array.isArray(existingStagingData)
                            ? (existingStagingData.find(st => st.id === rowId)
                                || existingStagingData.find(st => st.id === legacyRowId)
                                || existingStagingData.find(st => st.id === undefinedEraRowId))
                            : null;

                        generatedRows.push({
                            id: rowId,
                            target_id: targetId,
                            target_url: target.target_url,
                            anchor_text: target.anchor_text,
                            language: lang['lang-code']?.toUpperCase() || '',
                            domain_url: savedRow?.domain_url || '',
                            published_url: savedRow?.published_url || '',
                            published_date: savedRow?.published_date || '',
                            remark: savedRow?.remark || '',
                            indexed_status: savedRow?.indexed_status || '',
                        });
                    }
                });
            } else {
                for (let i = 0; i < targetQty; i++) {
                    const rowId = `${targetId}-qty-${i}`;
                    const savedRow = Array.isArray(existingStagingData)
                        ? existingStagingData.find(st => st.id === rowId)
                        : null;

                    generatedRows.push({
                        id: rowId,
                        target_id: targetId,
                        target_url: target.target_url,
                        anchor_text: target.anchor_text,
                        language: details.language?.toUpperCase() || 'EN',
                        domain_url: savedRow?.domain_url || '',
                        published_url: savedRow?.published_url || '',
                        published_date: savedRow?.published_date || '',
                        remark: savedRow?.remark || '',
                        indexed_status: savedRow?.indexed_status || '',
                    });
                }
            }
        });
    }

    // Apply deterministic randomization if enabled
    if (details.randomize_language && generatedRows.length > 0) {
        generatedRows.sort((a, b) => {
            const hashA = [...a.id].reduce((acc, char) => (acc * 31 + char.charCodeAt(0)) | 0, 0);
            const hashB = [...b.id].reduce((acc, char) => (acc * 31 + char.charCodeAt(0)) | 0, 0);
            return hashA - hashB;
        });
    }

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col">
            <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-12">
                <div className="bg-white shadow-sm rounded-xl border border-gray-200 p-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
                            Assignment: <span className="text-indigo-600">{details.project_name || 'Active SEO Project'}</span>
                        </h1>
                        <p className="text-sm text-gray-500 mt-1">Please fulfill all requested Target URL allocations below.</p>
                    </div>
                    <div className="px-4 py-2 bg-red-50 text-red-700 rounded-md border border-red-100 font-medium text-sm shadow-sm whitespace-nowrap">
                        Deadline: {details.deadline ? new Date(details.deadline).toLocaleDateString() : 'N/A'}
                    </div>
                </div>

                <VendorForm
                    initialRows={generatedRows}
                    projectHash={hash}
                    dripfeedEnabled={details.dripfeed_enabled}
                    dripfeedPeriod={details.dripfeed_period}
                    urlsPerDay={details.urls_per_day}
                    isLocked={isLocked}
                    urlEntryEnabled={details.url_entry_enabled ?? true}
                />
            </main>
        </div>
    );
}
