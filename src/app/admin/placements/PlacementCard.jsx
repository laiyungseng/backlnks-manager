'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import VendorLinkCopy from './VendorLinkCopy';
import { ChevronDown, ChevronRight, Droplet, CheckCircle, Lock, Unlock } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { finalizeProjectAction, toggleProjectLockAction } from './actions';

export default function PlacementCard({ project, representativeHash }) {
    // Default to collapsed to keep the dashboard clean
    const [isCollapsed, setIsCollapsed] = useState(true);

    // Manage live data locally to trigger re-renders
    const [localStagingData, setLocalStagingData] = useState(project.projects_hub?.[0]?.vendor_staging_data || []);

    // Real-time listener for this specific project
    useEffect(() => {
        if (!representativeHash || !supabase) return;

        const channel = supabase.channel(`placement-card-${project.id}`)
            .on(
                'postgres_changes',
                { event: 'UPDATE', schema: 'public', table: 'projects_hub' },
                (payload) => {
                    // Only update if the hash exactly matches our project's vendor link hash
                    if (payload.new.hash === representativeHash) {
                        console.log(`Live update received for project ${project.id}`);
                        setLocalStagingData(payload.new.vendor_staging_data || []);
                    }
                }
            )
            .subscribe();

        return () => {
            if (supabase) supabase.removeChannel(channel);
        };
    }, [project.id, representativeHash]);

    // Live computational function to build target summaries securely
    function buildTargetSummary() {
        // Parse from Hub
        const hubContacts = project.projects_hub?.[0] || {};
        const targetsArray = Array.isArray(hubContacts.targets) ? hubContacts.targets : [];

        return targetsArray.map((t, idx) => {
            // Because target_id was synthetic, we have to match the generic idx fallback if it doesnt exist
            const syntheticId = t.target_id || `idx-${idx}`;

            const targetSubmissions = Array.isArray(localStagingData) ? localStagingData.filter(s => s.target_id === syntheticId) : [];
            const uploadedCount = targetSubmissions.filter(s => s.published_url && s.published_url.trim().length > 0).length;
            const targetOrderedQty = parseInt(t.quantity || '0', 10);

            return {
                id: syntheticId,
                target_url: t.target_url,
                anchor_text: t.anchor_text,
                ordered_quantity: targetOrderedQty,
                uploaded_count: uploadedCount,
                is_completed: uploadedCount === targetOrderedQty
            };
        });
    }

    const liveTargetSummaries = buildTargetSummary();

    // Verification Logic for Finalization
    const [isFinalizing, setIsFinalizing] = useState(false);

    // Math logic: Check if all dynamic target rows are explicitly 100% fulfilled
    const allFulfilled = liveTargetSummaries.length > 0 && liveTargetSummaries.every(t => t.is_completed);

    const stagingData = localStagingData || [];
    const completedLinks = Array.isArray(stagingData) ? stagingData.filter(p => p.published_url && p.published_url.trim().length > 0).length : 0;

    // Parse from Hub
    const hub = project.projects_hub?.[0] || {};
    const hubTargets = Array.isArray(hub.targets) ? hub.targets : [];
    const totalLinks = hubTargets.length > 0
        ? hubTargets.reduce((acc, t) => acc + (parseInt(t.quantity || '0', 10)), 0)
        : parseInt(project.quantity || '0', 10);

    const overallFulfillmentMatch = completedLinks === totalLinks && totalLinks > 0;

    const hasPlacements = project.placements && project.placements.length > 0;
    const isFinalized = project.status === 'Finalized' || hasPlacements;

    const router = useRouter();

    async function handleFinalize() {
        if (!representativeHash) return;
        setIsFinalizing(true);
        try {
            const res = await finalizeProjectAction(representativeHash);
            if (!res.success) {
                alert(`Error Finalizing: ${res.message}`);
            } else {
                alert(res.message);
                router.refresh();
            }
        } catch (error) {
            console.error(error);
            alert("Crash triggering processor.");
        } finally {
            setIsFinalizing(false);
        }
    }

    // Lock/Edit toggle
    const [isToggling, setIsToggling] = useState(false);
    const currentLockState = project.projects_hub?.[0]?.is_locked || false;
    const [localLockState, setLocalLockState] = useState(currentLockState);

    async function handleToggleLock() {
        if (!representativeHash) return;
        setIsToggling(true);
        try {
            const res = await toggleProjectLockAction(representativeHash, !localLockState);
            if (res.success) {
                setLocalLockState(!localLockState);
                router.refresh();
            } else {
                alert(`Error: ${res.message}`);
            }
        } catch (error) {
            console.error(error);
        } finally {
            setIsToggling(false);
        }
    }

    // Language display helper
    const formatLanguages = () => {
        const languages = project.languages;
        if (Array.isArray(languages) && languages.length > 0) {
            return languages.map(l => `${l.code} (${l.ratio}%)`).join(', ');
        }
        return project.language ? `${project.language} (100%)` : null;
    };

    // Helper for safe URL parsing
    const getSafeHostname = (urlString) => {
        if (!urlString) return 'Unknown';
        try {
            return new URL(urlString).hostname;
        } catch (e) {
            return urlString;
        }
    };

    return (
        <div className="bg-white rounded-xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] ring-1 ring-gray-200 overflow-hidden transform transition-all hover:-translate-y-1 hover:shadow-[0_12px_40px_rgb(0,0,0,0.08)] duration-300 group">
            {/* Header / Vendor Control Strip */}
            <div className="px-6 py-5 border-b border-gray-100 bg-gradient-to-r from-gray-50 to-white flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h2 className="text-xl font-bold text-gray-900">{project.project_name}</h2>
                    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1.5 text-xs">
                        {localLockState ? (
                            <div className="flex items-center gap-1 text-amber-700 font-semibold bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                                <Lock className="w-3 h-3" /> Locked
                            </div>
                        ) : (
                            <div className="flex items-center gap-1 text-green-700 font-semibold bg-green-50 px-2 py-0.5 rounded border border-green-200">
                                <Unlock className="w-3 h-3" /> Editable
                            </div>
                        )}
                        <div>
                            <span className="text-gray-400 font-medium">Vendor: </span>
                            <span className="font-semibold text-indigo-600">{project.vendor_name}</span>
                        </div>
                        <div>
                            <span className="text-gray-400 font-medium">Status: </span>
                            <span className={`font-semibold ${(isFinalized || allFulfilled) ? 'text-green-700' : 'text-yellow-700'}`}>
                                {isFinalized ? 'Finalized' : (project.status === 'Completed' || allFulfilled) ? 'Completed' : project.status}
                            </span>
                        </div>
                        {project.country && (
                            <div>
                                <span className="text-gray-400 font-medium">Country: </span>
                                <span className="font-semibold text-gray-700 uppercase">{project.country}</span>
                            </div>
                        )}
                        {formatLanguages() && (
                            <div>
                                <span className="text-gray-400 font-medium">Language: </span>
                                <span className="font-semibold text-gray-700 uppercase">{formatLanguages()}</span>
                            </div>
                        )}
                        {project.backlinks_category && (
                            <div>
                                <span className="text-gray-400 font-medium">Category: </span>
                                <span className="px-1.5 py-0.5 rounded text-xs font-semibold bg-purple-50 text-purple-700 border border-purple-200">{project.backlinks_category}</span>
                            </div>
                        )}
                        {project.sheet_name && (
                            <div>
                                <span className="text-gray-400 font-medium">Sheet: </span>
                                <span className="font-medium text-gray-600 italic">{project.sheet_name}</span>
                            </div>
                        )}
                        {project.dripfeed_enabled && (
                            <div className="flex items-center gap-1">
                                <Droplet className="w-3 h-3 text-amber-600" />
                                <span className="text-gray-400 font-medium">Dripfeed: </span>
                                <span className="font-semibold text-amber-700">{project.urls_per_day} URLs/Day</span>
                            </div>
                        )}
                        <div>
                            <span className="text-gray-400 font-medium">Target Domain: </span>
                            {hubTargets.length > 0 ? (
                                hubTargets.length === 1 ? (
                                    <a href={hubTargets[0].target_url} target="_blank" rel="noopener noreferrer" className="font-semibold text-indigo-600 hover:text-indigo-900 truncate max-w-[150px] inline-block align-bottom">
                                        {getSafeHostname(hubTargets[0].target_url)}
                                    </a>
                                ) : (
                                    <button
                                        onClick={(e) => { e.preventDefault(); setIsCollapsed(false); }}
                                        className="font-semibold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded text-xs hover:bg-indigo-100 transition-colors"
                                    >
                                        {hubTargets.length} URLs
                                    </button>
                                )
                            ) : (
                                <span className="text-gray-400 italic">No Targets</span>
                            )}
                        </div>
                        <div>
                            <span className="text-gray-400 font-medium">Progress: </span>
                            <span className="font-mono font-semibold text-gray-700">{completedLinks} / {totalLinks}</span>
                        </div>
                        <div>
                            <span className="text-gray-400 font-medium">ID: </span>
                            <span className="font-mono text-gray-400">{project.id.split('-')[0]}</span>
                        </div>
                    </div>
                </div>

                {/* Action Center: Token & Link Generation */}
                <div className="flex items-center gap-4 bg-white p-2 rounded-lg border border-gray-100 shadow-sm shrink-0">

                    {/* Finalization Block */}
                    {allFulfilled && !isFinalized && (
                        <button
                            onClick={handleFinalize}
                            disabled={isFinalizing || !overallFulfillmentMatch}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded shadow-sm disabled:opacity-50 transition-colors"
                        >
                            <CheckCircle className="w-4 h-4" />
                            {isFinalizing ? 'Normalizing Data...' : 'Approve & Finalize'}
                        </button>
                    )}

                    {isFinalized && (
                        <div className="flex items-center gap-2">
                            <span className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-green-700 bg-green-50 border border-green-200 rounded">
                                <CheckCircle className="w-4 h-4" />
                                Finalized
                            </span>
                            <button
                                onClick={handleToggleLock}
                                disabled={isToggling}
                                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded shadow-sm transition-colors disabled:opacity-50 ${localLockState
                                    ? 'bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100'
                                    : 'bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100'
                                    }`}
                                title={localLockState ? 'Unlock for vendor editing' : 'Lock vendor editing'}
                            >
                                {localLockState ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
                                {isToggling ? '...' : localLockState ? 'Locked' : 'Editable'}
                            </button>
                        </div>
                    )}

                    <div className="flex flex-col border-l border-gray-100 pl-4">
                        <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Vendor Portal Link</span>
                        <span className="text-[10px] text-gray-400 italic">(View Placement Details)</span>
                    </div>
                    {representativeHash ? (
                        <VendorLinkCopy projectHash={representativeHash} />
                    ) : (
                        <span className="text-sm text-red-500 italic px-2">Unlinked - No Kickoff Hash Created</span>
                    )}

                    {/* Collapse Toggle Button */}
                    <div className="ml-2 pl-4 border-l border-gray-200">
                        <button
                            onClick={() => setIsCollapsed(!isCollapsed)}
                            className="p-1.5 rounded-md text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            title={isCollapsed ? "Expand Targets" : "Collapse Targets"}
                        >
                            {isCollapsed ? <ChevronRight className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                        </button>
                    </div>
                </div>
            </div>

            {/* Nested Target Summary Table (Collapsible) */}
            {!isCollapsed && (
                <div className="overflow-x-auto border-t border-gray-100 transition-all duration-300 ease-in-out origin-top">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-widest w-16">Target#</th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-widest">Target Domain</th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-widest">Anchor Text</th>
                                <th scope="col" className="px-6 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-widest">Fulfillment Progress</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-100">
                            {liveTargetSummaries && liveTargetSummaries.length > 0 ? (
                                liveTargetSummaries.map((target, index) => (
                                    <tr key={target.id} className={`${index % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'} hover:bg-indigo-50/30 transition-colors`}>
                                        <td className="px-6 py-4 whitespace-nowrap text-xs font-mono font-medium text-gray-400">
                                            T-{index + 1}
                                        </td>
                                        <td className="px-6 py-4 text-sm font-medium text-gray-900 max-w-xs truncate" title={target.target_url}>
                                            <a href={target.target_url} target="_blank" rel="noopener noreferrer" className="hover:text-indigo-600 transition-colors">
                                                {getSafeHostname(target.target_url)}
                                            </a>
                                        </td>
                                        <td className="px-6 py-4 text-sm text-gray-500 font-mono">
                                            {target.anchor_text}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-center">
                                            <div className="flex flex-col items-center justify-center">
                                                <span className="text-sm font-bold text-gray-700">
                                                    {target.uploaded_count} <span className="text-gray-400 font-normal">/ {target.ordered_quantity}</span>
                                                </span>
                                                {target.is_completed ? (
                                                    <span className="mt-1 px-2 inline-flex text-[10px] leading-4 font-semibold rounded-sm bg-green-100 text-green-800">
                                                        Fulfilled
                                                    </span>
                                                ) : (
                                                    <span className="mt-1 px-2 inline-flex text-[10px] leading-4 font-semibold rounded-sm bg-blue-100 text-blue-800">
                                                        Pending
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan="4" className="px-6 py-12 whitespace-nowrap text-center text-gray-400 bg-gray-50/30">
                                        <span className="block text-sm font-medium text-gray-600">No Target Links configured for this project.</span>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
