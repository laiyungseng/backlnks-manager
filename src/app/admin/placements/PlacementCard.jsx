'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import VendorLinkCopy from './VendorLinkCopy';
import { ChevronDown, ChevronRight, Droplet, CheckCircle, Lock, Unlock, Hash, Database, Globe, Target, Zap, BarChart } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { finalizeProjectAction, toggleProjectLockAction } from './actions';

export default function PlacementCard({ project, representativeHash }) {
    // Default to collapsed to keep the dashboard clean
    const [isCollapsed, setIsCollapsed] = useState(true);

    const details = project.project_details?.[0] || {};
    const localStagingData = project.projects_hub?.[0]?.vendor_staging_data || [];

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
        : parseInt(details.quantity || '0', 10);

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
        const languages = details['languages-ratio'];
        if (Array.isArray(languages) && languages.length > 0) {
            return languages.map(l => `${l['lang-code']} (${l.ratio}%)`).join(', ');
        }
        return details.language ? `${details.language} (100%)` : null;
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
        <div className="relative bg-white rounded-xl shadow-xl border border-slate-200 overflow-hidden transition-all duration-300 group hover:shadow-2xl">
            {/* Top Gradient Accent */}
            <div className="h-1 w-full bg-gradient-to-r from-indigo-600 via-indigo-500 to-emerald-500" />

            <div className="p-6">
                {/* Identity Header */}
                <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-6 mb-8">
                    <div className="space-y-2">
                        <div className="flex items-center flex-wrap gap-3">
                            <h2 className="text-2xl font-bold text-slate-900">
                                {details.project_name || 'Unnamed Project'}
                            </h2>
                            {/* Status Badge */}
                            {(() => {
                                let badgeClass = "amber-100 bg-amber-50 text-amber-700 border-amber-200";
                                let statusText = details.status || 'IN PROGRESS';

                                if (isFinalized) {
                                    badgeClass = "emerald-100 bg-emerald-50 text-emerald-700 border-emerald-200";
                                    statusText = "FINALIZED";
                                } else if (details.status === 'Completed' || allFulfilled) {
                                    badgeClass = "emerald-100 bg-emerald-50 text-emerald-700 border-emerald-200";
                                    statusText = "COMPLETED";
                                }

                                return (
                                    <span className={`px-2 py-0.5 rounded border text-[10px] font-black uppercase tracking-tight ${badgeClass}`}>
                                        {statusText}
                                    </span>
                                );
                            })()}
                        </div>

                        <div className="flex flex-wrap items-center gap-4">
                            <div className="flex items-center gap-1.5">
                                <Hash className="w-3.5 h-3.5 text-indigo-400" />
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{project.id.split('-')[0]}</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                                <Database className="w-3.5 h-3.5 text-indigo-400" />
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{details.vendor_name}</span>
                            </div>
                            {localLockState ? (
                                <div className="flex items-center gap-1 text-[10px] font-black text-amber-600 uppercase tracking-widest">
                                    <Lock className="w-3 h-3" /> Locked
                                </div>
                            ) : (
                                <div className="flex items-center gap-1 text-[10px] font-black text-emerald-600 uppercase tracking-widest">
                                    <Unlock className="w-3 h-3" /> Editable
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="flex items-end gap-3">
                        <VendorLinkCopy projectHash={representativeHash} vendorName={details.vendor_name || 'unknown'} />
                        <button
                            onClick={() => setIsCollapsed(!isCollapsed)}
                            className={`p-2 rounded-lg border border-slate-200 transition-all shadow-sm ${!isCollapsed ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-400 hover:text-indigo-600'}`}
                        >
                            {isCollapsed ? <ChevronRight className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                        </button>
                    </div>
                </div>

                {/* Information Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                    {/* Region/Lang */}
                    <div className="bg-slate-50 rounded-lg p-3 border border-slate-100">
                        <div className="flex items-center gap-2 mb-1">
                            <Globe className="w-3.5 h-3.5 text-indigo-500" />
                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest underline decoration-indigo-200 underline-offset-4">Region/Language</span>
                        </div>
                        <p className="text-xs font-black text-slate-800 uppercase tracking-tight">
                            {details.country || 'GLOBAL'} / {formatLanguages() || 'EN'}
                        </p>
                    </div>

                    {/* Target Domain */}
                    <div className="bg-slate-50 rounded-lg p-3 border border-slate-100">
                        <div className="flex items-center gap-2 mb-1">
                            <Target className="w-3.5 h-3.5 text-indigo-500" />
                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest underline decoration-indigo-200 underline-offset-4">Target Domain</span>
                        </div>
                        <p className="text-xs font-black text-slate-800 uppercase tracking-tight truncate">
                            {hubTargets.length > 0 ? getSafeHostname(hubTargets[0].target_url) : 'NO TARGET'}
                        </p>
                    </div>

                    {/* Dripfeed */}
                    <div className="bg-slate-50 rounded-lg p-3 border border-slate-100">
                        <div className="flex items-center gap-2 mb-1">
                            <Zap className="w-3.5 h-3.5 text-indigo-500" />
                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest underline decoration-indigo-200 underline-offset-4">Dripfeed Status</span>
                        </div>
                        {details.dripfeed_enabled ? (
                            <p className="text-xs font-black text-amber-600 uppercase tracking-tight">
                                {details.urls_per_day} URLS/DAY
                            </p>
                        ) : (
                            <p className="text-xs font-bold text-slate-400 italic">No Dripfeed</p>
                        )}
                    </div>

                    {/* Assigned Sheet */}
                    <div className="bg-slate-50 rounded-lg p-3 border border-slate-100">
                        <div className="flex items-center gap-2 mb-1">
                            <BarChart className="w-3.5 h-3.5 text-indigo-500" />
                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest underline decoration-indigo-200 underline-offset-4">Reference Sheet</span>
                        </div>
                        <p className="text-xs font-bold text-slate-600 italic truncate">
                            {(() => {
                                const sheets = details.sheet_name ? [details.sheet_name] :
                                    Array.isArray(details.project_info) ? Array.from(new Set(details.project_info.map(i => i.sheet_name).filter(Boolean))) : [];
                                return sheets.length > 0 ? sheets.join(', ') : 'N/A';
                            })()}
                        </p>
                    </div>
                </div>

                {/* Progress & Actions Row */}
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 pt-6 border-t border-slate-100">
                    <div className="flex-1 w-full max-w-xl">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Fulfillment Progress</span>
                            <span className="text-xs font-black text-slate-900 italic tracking-tighter uppercase">{completedLinks} / {totalLinks} COMPLETE</span>
                        </div>
                        <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                            <div
                                className={`h-full rounded-full transition-all duration-1000 bg-gradient-to-r ${isFinalized ? 'from-emerald-500 to-emerald-600' : 'from-indigo-600 to-indigo-400'}`}
                                style={{ width: `${totalLinks > 0 ? (completedLinks / totalLinks) * 100 : 0}%` }}
                            />
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        {allFulfilled && !isFinalized && (
                            <button
                                onClick={handleFinalize}
                                disabled={isFinalizing}
                                className="inline-flex items-center gap-2 px-6 py-3 text-[11px] font-black text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-all shadow-md active:scale-95 uppercase tracking-tighter"
                            >
                                <CheckCircle className="w-4 h-4" />
                                {isFinalizing ? 'NORMAILIZING...' : 'Approve & Finalize'}
                            </button>
                        )}

                        {isFinalized && (
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={handleToggleLock}
                                    disabled={isToggling}
                                    className={`inline-flex items-center gap-2 px-4 py-3 text-[11px] font-black rounded-lg border transition-all shadow-sm uppercase tracking-tighter ${localLockState
                                        ? 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100'
                                        : 'bg-indigo-50 text-indigo-700 border-indigo-100 hover:bg-indigo-100'}`}
                                >
                                    {localLockState ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
                                    {isToggling ? 'Wait...' : localLockState ? 'Locked' : 'Unlocked'}
                                </button>
                                <div className="inline-flex items-center gap-2 px-6 py-3 text-[11px] font-black text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-lg uppercase tracking-tighter">
                                    <CheckCircle className="w-4 h-4" />
                                    Processed
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Expanded Table Section */}
            {!isCollapsed && (
                <div className="border-t border-slate-100 bg-white animate-in slide-in-from-top duration-300">
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-slate-100">
                            <thead className="bg-slate-50">
                                <tr>
                                    <th className="px-6 py-4 text-left text-[11px] font-bold text-slate-500 uppercase tracking-widest">Target#</th>
                                    <th className="px-6 py-4 text-left text-[11px] font-bold text-slate-500 uppercase tracking-widest">Domain</th>
                                    <th className="px-6 py-4 text-left text-[11px] font-bold text-slate-500 uppercase tracking-widest">Anchor</th>
                                    <th className="px-6 py-4 text-right text-[11px] font-bold text-slate-500 uppercase tracking-widest">Progress</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {liveTargetSummaries.map((target, index) => (
                                    <tr key={target.id} className="hover:bg-slate-50 transition-colors">
                                        <td className="px-6 py-4 text-[11px] font-mono text-slate-400">T-{index + 1}</td>
                                        <td className="px-6 py-4">
                                            <p className="text-[11px] font-black text-slate-800 uppercase tracking-tight truncate max-w-[200px]">
                                                {getSafeHostname(target.target_url)}
                                            </p>
                                        </td>
                                        <td className="px-6 py-4">
                                            <p className="text-[11px] font-mono text-slate-400 truncate max-w-[200px]">
                                                {target.anchor_text || '-'}
                                            </p>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                <span className="text-[11px] font-black text-slate-900 italic tracking-tighter">
                                                    {target.uploaded_count}/{target.ordered_quantity}
                                                </span>
                                                <div className={`w-2 h-2 rounded-full ${target.is_completed ? 'bg-emerald-500' : 'bg-slate-200'}`} />
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
}
