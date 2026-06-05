'use client';

import { useState } from 'react';
import { Check, ChevronDown, ChevronRight, FolderKanban } from 'lucide-react';
import PlacementProjectRow from './PlacementProjectRow';

function formatDate(value) {
    if (!value) return 'No Date';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'No Date';
    return date.toISOString().slice(0, 10);
}

function getPlanRows(project) {
    return Array.isArray(project.project_plans)
        ? [...project.project_plans].sort((a, b) => (a.step_order ?? 0) - (b.step_order ?? 0))
        : [];
}

function getPlanMeta(project) {
    const planRows = getPlanRows(project);
    const firstPlan = planRows[0] || {};
    const rawId = firstPlan.campaign_id || firstPlan.id || project.id || 'unknown';
    const planId = String(rawId).toUpperCase();
    const dateText = formatDate(firstPlan.created_at || project.created_date);

    return {
        key: `${rawId}`,
        dateText,
        planId,
        label: `${dateText} - ${planId}`,
    };
}

function TableHeader() {
    return (
        <div className="hidden md:grid grid-cols-12 px-4 py-3 text-[9px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-200">
            <div className="col-span-1">ID / Category</div>
            <div className="col-span-3">Vendor & Range</div>
            <div className="col-span-1 text-center">Assets</div>
            <div className="col-span-2">Region / Plan</div>
            <div className="col-span-2">Progress</div>
            <div className="col-span-3 text-right">Actions</div>
        </div>
    );
}

function PlanEntry({ plan }) {
    const [open, setOpen] = useState(true);
    const [copied, setCopied] = useState(false);
    const itemCount = plan.projects.length;

    async function handleCopyCampaignId(event) {
        event.stopPropagation();
        await navigator.clipboard.writeText(plan.planId);
        setCopied(true);
        setTimeout(() => setCopied(false), 1400);
    }

    function handleToggleKeyDown(event) {
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            setOpen(v => !v);
        }
    }

    function handleCopyKeyDown(event) {
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            handleCopyCampaignId(event);
        }
    }

    return (
        <div className="rounded-xl border border-slate-100 overflow-hidden bg-white">
            <div
                role="button"
                tabIndex={0}
                onClick={() => setOpen(v => !v)}
                onKeyDown={handleToggleKeyDown}
                className="w-full flex items-center gap-3 px-4 py-3 bg-slate-50/80 hover:bg-slate-100 transition-colors text-left"
            >
                <FolderKanban className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                <span className="text-xs font-black tracking-wider uppercase text-slate-700 flex-1 truncate">
                    <span>{plan.dateText} - </span>
                    <span
                        role="button"
                        tabIndex={0}
                        onClick={handleCopyCampaignId}
                        onKeyDown={handleCopyKeyDown}
                        title="Click to copy campaign id"
                        className="inline-flex items-center gap-1 rounded px-1 py-0.5 text-indigo-700 hover:bg-indigo-50 hover:text-indigo-900 cursor-copy"
                    >
                        {plan.planId}
                        {copied && <Check className="w-3 h-3 text-emerald-600" />}
                    </span>
                </span>
                <span className="px-2 py-1 rounded-full bg-white border border-slate-200 text-[9px] font-black uppercase tracking-widest text-slate-400 shrink-0">
                    {itemCount} {itemCount === 1 ? 'Item' : 'Items'}
                </span>
                {open ? <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" /> : <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />}
            </div>

            {open && (
                <div className="bg-white">
                    <TableHeader />
                    <div className="px-4 pb-4 pt-3 space-y-3">
                        {plan.projects.map((project, idx) => (
                            <PlacementProjectRow
                                key={project.id || idx}
                                project={project}
                                isCompletedView={plan.isCompletedView}
                                onProjectFinalized={plan.onProjectFinalized}
                            />
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

export default function PlacementGroupCard({ group, isCompletedView, onProjectFinalized }) {
    const [isCollapsed, setIsCollapsed] = useState(true);

    const projectTitle = group.projectTitle || group.vendorName || 'Unnamed Project';
    const projects = group.projects || [];
    const projectSlug = projectTitle.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');

    const plans = (() => {
        const planMap = new Map();

        projects.forEach(project => {
            const meta = getPlanMeta(project);
            if (!planMap.has(meta.key)) {
                planMap.set(meta.key, {
                    ...meta,
                    projects: [],
                    isCompletedView,
                    onProjectFinalized,
                });
            }
            planMap.get(meta.key).projects.push(project);
        });

        return [...planMap.values()].sort((a, b) => b.label.localeCompare(a.label));
    })();

    return (
        <div id={`project-${projectSlug}`} className={`bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm mb-6 transition-all border-l-4 ${isCompletedView ? 'border-l-emerald-500' : 'border-l-indigo-500'}`}>
            <button
                type="button"
                onClick={() => setIsCollapsed(v => !v)}
                className={`w-full p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-5 text-left transition-colors ${isCompletedView ? 'bg-emerald-50/10 hover:bg-emerald-50/30' : 'bg-white hover:bg-slate-50/70'}`}
            >
                <div className="min-w-0">
                    <h2 className="text-lg font-black uppercase text-slate-900 tracking-tight truncate" title={projectTitle}>
                        {projectTitle}
                    </h2>
                    <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mt-1">
                        {plans.length} {plans.length === 1 ? 'execution plan' : 'execution plans'}
                    </p>
                </div>

                <div className="flex flex-wrap items-center gap-6 lg:min-w-[360px] lg:justify-end">
                    <div className="flex flex-col items-start min-w-[140px]">
                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Status</span>
                        <div className="flex items-center gap-2">
                            <div className={`w-2 h-2 rounded-full ${isCompletedView ? 'bg-emerald-500' : 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]'}`} />
                            <span className="text-sm font-bold text-slate-800">
                                {isCompletedView ? 'Finalized Archive' : 'Live & Tracking'}
                            </span>
                        </div>
                    </div>

                    <div className="flex flex-col items-start lg:items-end min-w-[120px]">
                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Available Projects</span>
                        <span className="text-sm font-bold text-slate-800 tracking-tight">
                            {projects.length} {projects.length === 1 ? 'Project' : 'Projects'}
                        </span>
                    </div>

                    <span className="p-2 text-slate-400 rounded-xl shrink-0">
                        {isCollapsed ? <ChevronRight className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                    </span>
                </div>
            </button>

            {!isCollapsed && (
                <div className="bg-slate-50/80 border-t border-slate-100 px-6 pb-6 pt-4 shadow-inner space-y-3 max-h-[800px] overflow-y-auto">
                    {plans.map(plan => (
                        <PlanEntry key={plan.key} plan={plan} />
                    ))}
                </div>
            )}
        </div>
    );
}
