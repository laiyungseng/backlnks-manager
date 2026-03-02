import { supabase } from '@/lib/supabase';
import { redirect } from 'next/navigation';
import VendorForm from './VendorForm';

export const dynamic = 'force-dynamic';

export default async function VendorPortalPage({ params }) {
    // 1. Safe extraction for Next 14/15
    const resolvedParams = await params;
    const hash = resolvedParams?.hash || params?.hash;

    if (!hash) {
        redirect('/unauthorized');
    }

    // 2. Cryptographically Secure DB Match via `project_list.hash`
    const { data: projectList, error: listError } = await supabase
        .from('project_list')
        .select('*')
        .eq('hash', hash)
        .single();

    if (listError || !projectList) {
        console.log("VENDOR PORTAL DEBUG - Redirecting: Hash lookup failed.");
        redirect('/unauthorized');
    }

    const projectId = projectList.project_id;
    const existingStagingData = projectList.vendor_staging_data || []; // The virtual JSON storage!

    // 3. Fetch Core Project Context
    const { data: projectData } = await supabase
        .from('projects')
        .select('project_name, deadline, dripfeed_enabled, dripfeed_period, urls_per_day')
        .eq('id', projectId)
        .single();

    // 4. Fetch the Required Target Alignments
    const { data: targetsData } = await supabase
        .from('project_targets')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: true });

    // 5. Expand Target Rows based on Quantity mapping strategy, folding in existing Staging Data
    let generatedRows = [];
    if (targetsData && targetsData.length > 0) {
        targetsData.forEach((target) => {
            // If target quantity is 3, we need 3 identical assignment rows for the vendor to fulfill
            for (let i = 0; i < target.quantity; i++) {
                const rowId = `${target.id}-qty-${i}`;

                // Seek to see if vendor already saved JSON progress for this specific row ID
                const savedRow = Array.isArray(existingStagingData)
                    ? existingStagingData.find(st => st.id === rowId)
                    : null;

                generatedRows.push({
                    id: rowId,
                    target_id: target.id,
                    target_url: target.target_url,
                    anchor_text: target.anchor_text,
                    published_url: savedRow?.published_url || '',
                    published_date: savedRow?.published_date || ''
                });
            }
        });
    }

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col">
            <header className="bg-white border-b border-gray-200 shadow-sm sticky top-0 z-10 w-full mb-8">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <span className="bg-indigo-600 w-8 h-8 rounded flex items-center justify-center text-sm font-bold text-white shadow">DF</span>
                        <span className="text-xl font-bold text-gray-900 tracking-wider">Drive-Future</span>
                    </div>
                    <div className="hidden sm:flex items-center px-3 py-1 rounded-full bg-indigo-50 border border-indigo-100 text-sm font-semibold text-indigo-700">
                        Vendor Access Portal
                    </div>
                </div>
            </header>

            <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-12">
                <div className="bg-white shadow-sm rounded-xl border border-gray-200 p-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
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
                />
            </main>

            <footer className="w-full text-center py-6 text-sm text-gray-400">
                &copy; {new Date().getFullYear()} Drive-Future Internal SEO System.
            </footer>
        </div>
    );
}
