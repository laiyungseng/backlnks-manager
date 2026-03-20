'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Eye, Link as LinkIcon, MoreVertical, CheckCircle2, Lock, Unlock } from 'lucide-react';
import { finalizeProjectAction, toggleProjectLockAction } from './actions';

export default function PlacementProjectRow({ project, isCompletedView }) {
    const router = useRouter();
    const representativeHash = project.projects_hub?.[0]?.hash;
    const localStagingData = project.projects_hub?.[0]?.vendor_staging_data || [];
    
    // Parse Targets
    const hub = project.projects_hub?.[0] || {};
    const hubTargets = Array.isArray(hub.targets) ? hub.targets : [];
    const totalLinks = hubTargets.length > 0
        ? hubTargets.reduce((acc, t) => acc + (parseInt(t.quantity || '0', 10)), 0)
        : (project.total_quantity || 0);
        
    const stagingData = localStagingData || [];
    const completedLinks = Array.isArray(stagingData) ? stagingData.filter(p => p.published_url && p.published_url.trim().length > 0).length : 0;
    
    const percentage = totalLinks > 0 ? Math.round((completedLinks / totalLinks) * 100) : 0;
    const allFulfilled = completedLinks === totalLinks && totalLinks > 0;
    const hasPlacements = project.placements && project.placements.length > 0;
    const isFinalized = project.status === 'Finalized' || hasPlacements;

    // Actions
    const [isFinalizing, setIsFinalizing] = useState(false);
    const currentLockState = hub.is_locked || false;
    const [localLockState, setLocalLockState] = useState(currentLockState);
    const [isToggling, setIsToggling] = useState(false);

    async function handleFinalize() {
        if (!representativeHash) return;
        setIsFinalizing(true);
        try {
            const res = await finalizeProjectAction(representativeHash);
            if (!res.success) alert(`Error Finalizing: ${res.message}`);
            else router.refresh();
        } catch (error) {
            alert("Crash triggering processor.");
        } finally {
            setIsFinalizing(false);
        }
    }

    async function handleToggleLock() {
        if (!representativeHash) return;
        setIsToggling(true);
        try {
            const res = await toggleProjectLockAction(representativeHash, !localLockState);
            if (res.success) {
                setLocalLockState(!localLockState);
                router.refresh();
            } else alert(`Error: ${res.message}`);
        } finally {
            setIsToggling(false);
        }
    }

    // Portal Access Copier
    const vendorName = project.vendors?.vendor_name || 'unknown';
    const copyLink = () => {
        const fullUrl = `${window.location.origin}/vendor/${encodeURIComponent(vendorName)}/${representativeHash}`;
        navigator.clipboard.writeText(fullUrl);
        alert('Vendor Portal Link copied to clipboard!');
    };
    
    const openLink = () => {
        const fullUrl = `${window.location.origin}/vendor/${encodeURIComponent(vendorName)}/${representativeHash}`;
        window.open(fullUrl, '_blank');
    };

    // UI Formatting
    const getStatusStyle = () => {
        if (isFinalized) return { label: 'FINALIZED', bg: 'bg-emerald-100 text-emerald-700' };
        if (allFulfilled) return { label: 'COMPLETED', bg: 'bg-emerald-100 text-emerald-700' };
        return { label: 'IN PROGRESS', bg: 'bg-amber-100 text-amber-700' };
    };
    
    const statusStyle = getStatusStyle();

    // Grouping identical category/sheet_name to avoid chip spam
    const chipLabels = [...new Set(hubTargets.map(t => 
        t.category || t._parent_category || t.sheet_name || t._parent_sheet_name || 'GENERIC'
    ).filter(Boolean))].slice(0, 3); // Max 3 chips

    return (
        <div className="grid grid-cols-12 gap-4 px-5 py-4 items-center bg-white rounded-2xl border border-slate-100 hover:border-slate-200 hover:shadow-sm transition-all relative">
            {/* Project Name & Chips */}
            <div className="col-span-3 pr-4 flex flex-col justify-center">
                <div className="flex items-center gap-3 mb-2">
                    <span className="text-base font-bold text-slate-900 truncate max-w-[180px]" title={project.project_name}>
                        {project.project_name || 'Unnamed Project'}
                    </span>
                    <span className={`px-2 py-0.5 text-[9px] font-black rounded uppercase tracking-widest ${statusStyle.bg}`}>
                        {statusStyle.label}
                    </span>
                </div>
                <div className="flex flex-wrap gap-2">
                    {chipLabels.map((lbl, i) => (
                        <span key={i} className="px-2 py-1 bg-slate-100 text-slate-500 rounded text-[9px] font-black tracking-widest uppercase truncate max-w-[100px]">
                            {lbl}
                        </span>
                    ))}
                </div>
            </div>

            {/* Region / Delivery */}
            <div className="col-span-3">
                <div className="flex flex-col gap-1.5">
                    <span className="text-[13px] font-bold text-slate-800">
                        {project.country || 'GLOBAL'} {project.project_languages?.length > 0 && `(${project.project_languages[0].lang_code})`}
                    </span>
                    <span className="text-[11px] font-semibold text-indigo-600 italic">
                        {project.dripfeed_enabled ? `${project.urls_per_day} URL/day (${project.dripfeed_period || 0} days)` : 'No Dripfeed'}
                    </span>
                </div>
            </div>

            {/* Fulfillment */}
            <div className="col-span-2 pr-6">
                <div className="flex flex-col gap-2 w-full">
                    <div className="flex items-center gap-3">
                        <span className="text-xs font-bold text-slate-700">{completedLinks}/{totalLinks}</span>
                        <span className="text-xs font-bold text-slate-500">{percentage}%</span>
                    </div>
                    <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                        <div 
                            className={`h-full rounded-full transition-all duration-1000 ${percentage === 100 ? (isFinalized ? 'bg-emerald-500' : 'bg-indigo-600') : 'bg-indigo-500'}`}
                            style={{ width: `${percentage}%` }}
                        />
                    </div>
                </div>
            </div>

            {/* Portal Access */}
            <div className="col-span-2 flex items-center gap-2">
                <button onClick={openLink} className="flex items-center gap-2 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 font-bold text-[10px] uppercase tracking-widest px-3 py-2 rounded-lg transition-colors">
                    <Eye className="w-3.5 h-3.5" />
                    Open Link
                </button>
                <button onClick={copyLink} className="p-2 border border-slate-200 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-lg transition-colors" title="Copy Link">
                    <LinkIcon className="w-3.5 h-3.5" />
                </button>
            </div>

            {/* Status & Security Actions */}
            <div className="col-span-2 flex items-center gap-2 justify-end">
                {!isCompletedView ? (
                    // Active View
                    <>
                        {allFulfilled ? (
                            <button
                                onClick={handleFinalize}
                                disabled={isFinalizing}
                                className="px-4 py-2 bg-emerald-50 text-emerald-600 border border-emerald-100 hover:bg-emerald-100 rounded-lg font-black text-[10px] uppercase tracking-widest transition-all shadow-sm flex items-center gap-1.5"
                            >
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                {isFinalizing ? '...' : 'Process'}
                            </button>
                        ) : (
                            <button className="p-2 text-slate-300 hover:text-slate-500 transition-colors">
                                <MoreVertical className="w-5 h-5" />
                            </button>
                        )}
                    </>
                ) : (
                    // Completed View
                    <>
                        <button
                            onClick={handleToggleLock}
                            disabled={isToggling}
                            className={`px-3 py-1.5 rounded-lg border font-black text-[9px] uppercase tracking-widest transition-all flex items-center gap-1.5 ${localLockState
                                ? 'bg-amber-50 text-amber-700 border-amber-200'
                                : 'bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100'}`}
                        >
                            {localLockState ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />}
                            {localLockState ? 'LOCKED' : 'UNLOCKED'}
                        </button>
                        <div className="px-3 py-1.5 bg-emerald-50 border border-emerald-100 text-emerald-700 rounded-lg font-black text-[9px] uppercase tracking-widest flex items-center gap-1.5">
                            <CheckCircle2 className="w-3 h-3" />
                            PROCESSED
                        </div>
                        <button className="p-1.5 text-slate-300 hover:text-slate-500 transition-colors ml-1">
                            <MoreVertical className="w-4 h-4" />
                        </button>
                    </>
                )}
            </div>
        </div>
    );
}
