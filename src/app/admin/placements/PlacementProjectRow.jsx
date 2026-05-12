'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Eye, Link as LinkIcon, MoreVertical, CheckCircle2, Lock, Unlock, XCircle, AlertTriangle, ShieldAlert, Star, Globe2 } from 'lucide-react';
import { finalizeProjectAction, toggleProjectLockAction, closeProjectAction, toggleUrlEntryAction, togglePriorityAction } from './actions';
import CopyButton from '../projects/CopyButton';
import CloseProjectModal from './CloseProjectModal';
import AnchorInfoPopup from './AnchorInfoPopup';
import CampaignSiblingsPopup from './CampaignSiblingsPopup';

const RISK_TIER_STYLES = {
    'NO RESPONSE':                 { bg: 'bg-orange-100', text: 'text-orange-700', border: 'border-orange-200', icon: AlertTriangle },
    'POTENTIAL FRAUD':             { bg: 'bg-red-100',    text: 'text-red-600',    border: 'border-red-200',    icon: ShieldAlert   },
    'POTENTIAL FRAUD — HIGH RISK': { bg: 'bg-red-200',    text: 'text-red-800',    border: 'border-red-300',    icon: ShieldAlert   },
};

function computeRiskTier(lastActivityIso, createdDateIso) {
    const base = lastActivityIso
        ? new Date(lastActivityIso)
        : createdDateIso
            ? new Date(createdDateIso)
            : null;
    if (!base) return null;
    const days = Math.floor((Date.now() - base.getTime()) / 86400000);
    if (days >= 30) return 'POTENTIAL FRAUD — HIGH RISK';
    if (days >= 14) return 'POTENTIAL FRAUD';
    if (days >= 7)  return 'NO RESPONSE';
    return null;
}

export default function PlacementProjectRow({ project, isCompletedView, onProjectFinalized }) {
    const router = useRouter();
    const representativeHash = project.projects_hub?.[0]?.hash;

    const hub = project.projects_hub?.[0] || {};
    const hubTargets = Array.isArray(hub.targets) ? hub.targets : [];
    const totalLinks = hubTargets.length > 0
        ? hubTargets.reduce((acc, t) => acc + (parseInt(t.quantity || '0', 10)), 0)
        : (project.total_quantity || 0);

    const completedLinks = hub.completed_count ?? 0;
    const indexedLinks = hub.indexed_count ?? 0;

    const percentage = totalLinks > 0 ? Math.round((completedLinks / totalLinks) * 100) : 0;
    const allFulfilled = completedLinks >= totalLinks && totalLinks > 0;
    const allIndexed = indexedLinks >= totalLinks && totalLinks > 0;
    const hasPlacements = project.placements && project.placements.length > 0;
    const isFinalized = project.status === 'Finalized' || hasPlacements;

    const [isFinalizing, setIsFinalizing] = useState(false);
    const currentLockState = hub.is_locked || false;
    const [localLockState, setLocalLockState] = useState(currentLockState);
    const [isToggling, setIsToggling] = useState(false);
    const [isCloseModalOpen, setIsCloseModalOpen] = useState(false);
    const [isClosing, setIsClosing] = useState(false);
    const [localUrlEntry, setLocalUrlEntry] = useState(project.url_entry_enabled || false);
    const [isTogglingUrlEntry, setIsTogglingUrlEntry] = useState(false);
    const [localPriority, setLocalPriority] = useState(project.is_priority || false);
    const [isTogglingPriority, setIsTogglingPriority] = useState(false);

    async function handleFinalize() {
        if (!representativeHash) return;
        setIsFinalizing(true);
        try {
            const res = await finalizeProjectAction(representativeHash);
            if (!res.success) alert(`Error Finalizing: ${res.message}`);
            else {
                onProjectFinalized?.(project.id);
                router.refresh();
            }
        } catch {
            alert('Crash triggering processor.');
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

    async function handleToggleUrlEntry() {
        if (!project.id) return;
        setIsTogglingUrlEntry(true);
        try {
            const res = await toggleUrlEntryAction(project.id, !localUrlEntry);
            if (res.success) setLocalUrlEntry(v => !v);
            else alert(`Error: ${res.message}`);
        } finally {
            setIsTogglingUrlEntry(false);
        }
    }

    async function handleTogglePriority() {
        if (!project.id) return;
        setIsTogglingPriority(true);
        try {
            const res = await togglePriorityAction(project.id, !localPriority);
            if (res.success) setLocalPriority(v => !v);
            else alert(`Error: ${res.message}`);
        } finally {
            setIsTogglingPriority(false);
        }
    }

    async function handleCloseConfirm(reason) {
        if (!project.id || !project.vendor_id) return;
        setIsClosing(true);
        try {
            const res = await closeProjectAction(project.id, project.vendor_id, reason);
            if (!res.success) {
                alert(`Error closing project: ${res.message}`);
            } else {
                setIsCloseModalOpen(false);
                router.refresh();
            }
        } catch {
            alert('Unexpected error closing project.');
        } finally {
            setIsClosing(false);
        }
    }

    const vendorName = project.vendors?.vendor_name || 'unknown';
    const vendorSlug = vendorName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    const portalHref = representativeHash && project.vendor_id
        ? `/vendor/${vendorSlug}/portal/${project.vendor_id}/project/${representativeHash}`
        : '';
    const copyLink = () => {
        if (!portalHref) return;
        const fullUrl = `${window.location.origin}${portalHref}`;
        navigator.clipboard.writeText(fullUrl);
        alert('Vendor Portal Link copied to clipboard!');
    };

    const riskTier = !isCompletedView ? computeRiskTier(hub.last_activity_at || null, project.created_date) : null;
    const riskStyle = riskTier ? RISK_TIER_STYLES[riskTier] : null;

    const getStatusStyle = () => {
        if (isFinalized) return { label: 'FINALIZED', bg: 'bg-emerald-100 text-emerald-700' };
        if (allFulfilled && allIndexed) return { label: 'COMPLETED', bg: 'bg-teal-100 text-teal-700' };
        if (allFulfilled && !allIndexed) return { label: 'COMPLETED — PENDING INDEX', bg: 'bg-blue-100 text-blue-700' };
        return { label: 'IN PROGRESS', bg: 'bg-amber-100 text-amber-700' };
    };
    const statusStyle = getStatusStyle();
    const identityStatusClass = statusStyle.label === 'IN PROGRESS'
        ? 'bg-orange-100 text-orange-600 border-orange-200'
        : 'bg-indigo-100 text-indigo-600 border-indigo-200';
    const formatExecutionDate = (value) => value ? String(value).split('T')[0] : 'N/A';

    const chipLabels = [...new Set(hubTargets.map(t =>
        t.category || t._parent_category || t.sheet_name || t._parent_sheet_name || 'GENERIC'
    ).filter(Boolean))].slice(0, 3);

    const progressBar = (
        <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
            <div
                className={`h-full rounded-full transition-all duration-1000 ${percentage === 100 ? (isFinalized ? 'bg-emerald-500' : 'bg-indigo-600') : 'bg-indigo-500'}`}
                style={{ width: `${percentage}%` }}
            />
        </div>
    );

    // Mobile portal buttons (full-width with text)
    const portalButtonsMobile = (
        <>
            <a
                href={portalHref || undefined}
                target="_blank"
                rel="noopener noreferrer"
                aria-disabled={!portalHref}
                className={`flex items-center gap-2 font-bold text-[10px] uppercase tracking-widest px-3 py-2 rounded-lg transition-colors flex-1 justify-center ${
                    portalHref
                        ? 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100'
                        : 'bg-slate-50 text-slate-300 pointer-events-none'
                }`}
            >
                <Eye className="w-3.5 h-3.5" />
                Open Link
            </a>
            <button
                onClick={copyLink}
                disabled={!portalHref}
                className="p-2 border border-slate-200 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-lg transition-colors shrink-0 disabled:opacity-40 disabled:cursor-not-allowed"
                title={portalHref ? 'Copy Link' : 'Missing vendor portal link'}
            >
                <LinkIcon className="w-3.5 h-3.5" />
            </button>
        </>
    );

    // Desktop portal buttons (compact icon-only for narrow col-span-1)
    const portalButtons = (
        <div className="flex flex-col gap-1.5 w-full">
            <a
                href={portalHref || undefined}
                target="_blank"
                rel="noopener noreferrer"
                aria-disabled={!portalHref}
                title={portalHref ? 'Open Vendor Portal' : 'Missing vendor portal link'}
                className={`flex items-center justify-center gap-1 font-bold text-[9px] uppercase tracking-widest px-2 py-1.5 rounded-lg transition-colors w-full ${
                    portalHref
                        ? 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100'
                        : 'bg-slate-50 text-slate-300 pointer-events-none'
                }`}
            >
                <Eye className="w-3 h-3" />
                Open
            </a>
            <button
                onClick={copyLink}
                disabled={!portalHref}
                title={portalHref ? 'Copy Link' : 'Missing vendor portal link'}
                className="flex items-center justify-center gap-1 border border-slate-200 text-slate-400 hover:text-slate-600 hover:bg-slate-50 text-[9px] font-bold uppercase tracking-widest px-2 py-1.5 rounded-lg transition-colors w-full disabled:opacity-40 disabled:cursor-not-allowed"
            >
                <LinkIcon className="w-3 h-3" />
                Copy
            </button>
        </div>
    );

    const urlEntryToggle = (
        <button
            onClick={handleToggleUrlEntry}
            disabled={isTogglingUrlEntry}
            title={localUrlEntry ? 'URL Entry ON — click to disable' : 'URL Entry OFF — click to enable'}
            className={`flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-lg border text-[8px] font-black uppercase tracking-widest transition-all shrink-0 ${
                localUrlEntry
                    ? 'bg-violet-50 text-violet-600 border-violet-200 hover:bg-violet-100'
                    : 'bg-slate-50 text-slate-400 border-slate-200 hover:bg-slate-100'
            }`}
        >
            <div className={`w-6 h-3 rounded-full relative transition-colors ${localUrlEntry ? 'bg-violet-500' : 'bg-slate-300'}`}>
                <div className={`absolute top-0.5 w-2 h-2 bg-white rounded-full shadow transition-all ${localUrlEntry ? 'left-3.5' : 'left-0.5'}`} />
            </div>
            URL
        </button>
    );

    const priorityButton = !isCompletedView && (
        <button
            onClick={handleTogglePriority}
            disabled={isTogglingPriority}
            title={localPriority ? 'Priority ON — click to remove' : 'Mark as priority for vendor'}
            className={`p-2 rounded-lg border transition-all shrink-0 ${
                localPriority
                    ? 'bg-amber-50 text-amber-500 border-amber-200 hover:bg-amber-100'
                    : 'bg-slate-50 text-slate-300 border-slate-200 hover:text-amber-400 hover:border-amber-200'
            }`}
        >
            <Star className={`w-4 h-4 ${localPriority ? 'fill-amber-400' : ''}`} />
        </button>
    );

    const actionButtons = !isCompletedView ? (
        <>
            {priorityButton}
            {allFulfilled ? (
                <button
                    onClick={handleFinalize}
                    disabled={isFinalizing}
                    className="px-3 py-1.5 bg-emerald-50 text-emerald-600 border border-emerald-100 hover:bg-emerald-100 rounded-lg font-black text-[10px] uppercase tracking-widest transition-all shadow-sm flex items-center gap-1 justify-center min-w-[76px]"
                >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    {isFinalizing ? '...' : 'Process'}
                </button>
            ) : (
                <button disabled className="px-3 py-1.5 bg-slate-50 text-slate-400 border border-slate-100 rounded-lg font-black text-[10px] uppercase tracking-widest opacity-60 flex items-center gap-1 justify-center min-w-[76px] cursor-not-allowed">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Process
                </button>
            )}
            {urlEntryToggle}
            <button
                onClick={() => setIsCloseModalOpen(true)}
                title="Close Project"
                className="p-2 bg-red-50 text-red-400 border border-red-100 hover:bg-red-100 hover:text-red-600 rounded-lg transition-colors shrink-0"
            >
                <XCircle className="w-4 h-4" />
            </button>
        </>
    ) : (
        <>
            <button
                onClick={handleToggleLock}
                disabled={isToggling}
                title={localLockState ? 'Locked' : 'Unlocked'}
                className={`p-2 rounded-lg border transition-all flex items-center justify-center shrink-0 ${localLockState
                    ? 'bg-amber-50 text-amber-600 border-amber-200 hover:bg-amber-100'
                    : 'bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100'}`}
            >
                {localLockState ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
            </button>
            <div title="Processed" className="p-2 bg-emerald-50 border border-emerald-100 text-emerald-600 rounded-lg flex items-center justify-center shrink-0">
                <CheckCircle2 className="w-4 h-4" />
            </div>
            <button className="p-1.5 text-slate-300 hover:text-slate-500 transition-colors shrink-0">
                <MoreVertical className="w-4 h-4" />
            </button>
        </>
    );

    return (
        <>
            {/* ── Mobile Card (< md) ── */}
            <div className="md:hidden group bg-white rounded-[12px] border border-slate-100 hover:border-slate-200 hover:shadow-sm transition-all overflow-hidden">
                {/* Top Header Row */}
                <div className="flex items-center justify-between px-4 pt-4 pb-2">
                    <span className="text-xs font-mono text-slate-500 cursor-help" title={project.id}>
                        {project.id?.substring(0, 6)}...
                    </span>
                    <CopyButton textToCopy={project.id} />
                </div>

                {/* Information Block */}
                <div className="px-4 pb-2">
                    <div className="flex flex-wrap items-center gap-1.5 mb-1.5">
                        <span className="text-[13px] font-black text-indigo-600 uppercase tracking-tight truncate" title={vendorName}>
                            {vendorName}
                        </span>
                        {project.created_date && (
                            <span className="text-[10px] font-semibold text-slate-400">
                                {new Date(project.created_date).toLocaleDateString()}
                            </span>
                        )}
                    </div>
                    <span className={`block w-full px-2 py-0.5 text-[9px] font-black rounded uppercase tracking-widest mb-1.5 ${statusStyle.bg}`}>
                        {statusStyle.label}
                    </span>
                    {riskTier && riskStyle && (() => {
                        const RiskIcon = riskStyle.icon;
                        return (
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-[9px] font-black rounded-md border uppercase tracking-widest mb-1.5 ${riskStyle.bg} ${riskStyle.text} ${riskStyle.border}`}>
                                <RiskIcon className="w-2.5 h-2.5" />
                                {riskTier}
                            </span>
                        );
                    })()}
                    <div className="flex flex-wrap gap-1">
                        {chipLabels.map((lbl, i) => (
                            <span key={i} className="px-2 py-0.5 bg-slate-100 text-slate-500 rounded text-[9px] font-black tracking-widest uppercase truncate max-w-[100px]">
                                {lbl}
                            </span>
                        ))}
                    </div>
                </div>

                {/* Info Button Row */}
                <div className="flex items-center gap-2 px-4 pb-1">
                    <AnchorInfoPopup projectId={project.id} projectName={project.project_name} />
                    <CampaignSiblingsPopup projectId={project.id} projectName={project.project_name} />
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Anchor & Campaign Info</span>
                </div>

                {/* Metadata Row */}
                <div className="flex items-center gap-3 px-4 py-2">
                    <span className="inline-flex items-center gap-1.5 text-[13px] font-bold text-slate-800">
                        <Globe2 className="w-3.5 h-3.5 text-slate-400" />
                        {project.country || 'GLOBAL'}{project.project_languages?.length > 0 && ` (${project.project_languages[0].lang_code})`}
                    </span>
                    <span className="px-2 py-1 rounded-md bg-indigo-50 text-[11px] font-bold text-indigo-600 truncate">
                        {project.dripfeed_enabled ? `${project.urls_per_day} URL/day (${project.dripfeed_period || 0} days)` : 'No Dripfeed'}
                    </span>
                </div>

                {/* Progress Block */}
                <div className="px-4 py-2">
                    <div className="flex items-center gap-3 mb-1.5">
                        <span className="text-xs font-bold text-slate-700">{completedLinks}/{totalLinks}</span>
                        <span className="text-xs font-bold text-slate-500">{percentage}%</span>
                    </div>
                    {progressBar}
                </div>

                {/* Portal Access Row */}
                <div className="flex items-center gap-2 px-4 py-2">
                    {portalButtonsMobile}
                </div>

                {/* Actions Footer */}
                <div className="flex items-center justify-between gap-2 px-4 py-3 border-t border-slate-100">
                    {actionButtons}
                </div>
            </div>

            {/* ── Desktop Row (≥ md) — 12-column grid ── */}
            {/* Layout: [ID:1] [Vendor+Dates:3] [Assets:1] [Region:2] [Progress:2] [Actions:3] = 12 */}
            <div className="hidden md:grid group grid-cols-12 items-center bg-white rounded-[12px] border border-slate-100 hover:border-slate-200 hover:shadow-sm transition-all relative">
                {/* Col 1: Project ID + Category Badge */}
                <div className="col-span-1 flex flex-col gap-1.5 px-3 py-3 border-r border-slate-100 min-w-0 overflow-hidden">
                    <div className="flex items-center gap-1 min-w-0">
                        <span className="text-xs font-mono text-slate-500 cursor-help truncate" title={project.id}>
                            {project.id?.substring(0, 6)}...
                        </span>
                        <CopyButton textToCopy={project.id} />
                    </div>
                    <div className="flex gap-1 min-w-0">
                        {chipLabels.slice(0, 1).map((lbl, i) => (
                            <span key={i} className="px-2 py-0.5 bg-slate-100 text-slate-500 rounded text-[9px] font-black tracking-widest uppercase truncate max-w-[90px]">
                                {lbl}
                            </span>
                        ))}
                    </div>
                </div>

                {/* Col 2-4: Vendor identity + execution range */}
                <div className="col-span-3 grid grid-cols-[128px_1px_118px] items-center gap-4 px-3 py-3 border-r border-slate-100 min-w-0 overflow-hidden">
                    {/* Name / badges — flex-1 so info button doesn't get squashed */}
                    <div className="flex flex-col gap-1 min-h-[38px] justify-center overflow-hidden">
                        <span className="text-[13px] font-black text-indigo-600 uppercase tracking-tight truncate" title={vendorName}>
                            {vendorName}
                        </span>
                        <div className="flex flex-wrap gap-1">
                            <span className={`px-2 py-0.5 text-[8px] font-bold rounded-full border uppercase tracking-tight self-start whitespace-nowrap ${identityStatusClass}`}>
                                {statusStyle.label}
                            </span>
                            {riskTier && riskStyle && (() => {
                                const RiskIcon = riskStyle.icon;
                                return (
                                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-[8px] font-bold rounded-full border uppercase tracking-tight self-start whitespace-nowrap ${riskStyle.bg} ${riskStyle.text} ${riskStyle.border}`}>
                                        <RiskIcon className="w-2.5 h-2.5" />
                                        {riskTier}
                                    </span>
                                );
                            })()}
                        </div>
                    </div>
                    <div className="w-px h-8 bg-slate-100" />
                    <div className="grid grid-rows-2 items-center gap-1 justify-start">
                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tight whitespace-nowrap">
                            <span className="font-black text-slate-300">S: </span>{formatExecutionDate(project.start_date)}
                        </span>
                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tight whitespace-nowrap">
                            <span className="font-black text-slate-300">E: </span>{formatExecutionDate(project.deadline)}
                        </span>
                    </div>
                </div>

                {/* Col 5: Assets */}
                <div className="col-span-1 flex items-center justify-center gap-2 px-2 py-3 border-r border-slate-100 min-w-0 overflow-hidden">
                    <AnchorInfoPopup projectId={project.id} projectName={project.project_name} />
                    <CampaignSiblingsPopup projectId={project.id} projectName={project.project_name} />
                </div>

                {/* Col 6-7: Region / Configuration */}
                <div className="col-span-2 flex flex-col gap-1 px-3 py-3 border-r border-slate-100 min-w-0 overflow-hidden">
                    <span className="inline-flex items-center gap-1.5 text-[13px] font-bold text-slate-800 truncate">
                        <Globe2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        {project.country || 'GLOBAL'}{project.project_languages?.length > 0 && ` (${project.project_languages[0].lang_code})`}
                    </span>
                    <span className="w-fit max-w-full px-2 py-1 rounded-md bg-indigo-50 text-[11px] font-bold text-indigo-600 truncate">
                        {project.dripfeed_enabled ? `${project.urls_per_day} URL/day (${project.dripfeed_period || 0} days)` : 'No Dripfeed'}
                    </span>
                </div>

                {/* Col 8-9: Progress */}
                <div className="col-span-2 flex flex-col gap-2 px-3 py-3 border-r border-slate-100 min-w-0">
                    <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-700">{completedLinks}/{totalLinks}</span>
                        <span className="text-xs font-bold text-slate-500">{percentage}%</span>
                    </div>
                    {progressBar}
                </div>

                {/* Col 10-12: Actions */}
                <div className="col-span-3 flex items-center gap-1.5 justify-end px-3 py-3 min-w-0">
                    {portalButtons}
                    {actionButtons}
                </div>
            </div>

            {isCloseModalOpen && (
                <CloseProjectModal
                    project={project}
                    vendorLastActivity={hub.last_activity_at || null}
                    onClose={() => setIsCloseModalOpen(false)}
                    onConfirm={handleCloseConfirm}
                    isSubmitting={isClosing}
                />
            )}
        </>
    );
}
