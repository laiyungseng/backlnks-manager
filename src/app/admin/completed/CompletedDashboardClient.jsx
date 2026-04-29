'use client';

import { useState } from 'react';
import { Search, CheckCircle2, XCircle, AlertTriangle, ShieldAlert } from 'lucide-react';
import PlacementGroupCard from '../placements/PlacementGroupCard';
import CopyButton from '../projects/CopyButton';
import AnchorInfoPopup from '../placements/AnchorInfoPopup';

// Risk tier config
const TIER_CONFIG = {
    'NO RESPONSE':                 { bg: 'bg-orange-100',  text: 'text-orange-700',  border: 'border-orange-200',  icon: AlertTriangle },
    'POTENTIAL FRAUD':             { bg: 'bg-red-100',     text: 'text-red-600',     border: 'border-red-200',     icon: ShieldAlert   },
    'POTENTIAL FRAUD — HIGH RISK': { bg: 'bg-red-200',     text: 'text-red-800',     border: 'border-red-300',     icon: ShieldAlert   },
    'CLOSED':                      { bg: 'bg-slate-100',   text: 'text-slate-500',   border: 'border-slate-200',   icon: XCircle       },
};

function getRiskTierFromDays(closedDateIso, createdDateIso) {
    // Recompute tier from days elapsed between creation and close (or current time if no closed_date)
    const base = createdDateIso ? new Date(createdDateIso) : null;
    if (!base) return 'CLOSED';
    const reference = closedDateIso ? new Date(closedDateIso) : new Date();
    const days = Math.floor((reference.getTime() - base.getTime()) / 86400000);
    if (days >= 30) return 'POTENTIAL FRAUD — HIGH RISK';
    if (days >= 14) return 'POTENTIAL FRAUD';
    if (days >= 7)  return 'NO RESPONSE';
    return 'CLOSED';
}

function ClosedProjectRow({ project }) {
    const tier = project.vendors?.project_status || getRiskTierFromDays(project.closed_date, project.created_date);
    const cfg = TIER_CONFIG[tier] || TIER_CONFIG['CLOSED'];
    const TierIcon = cfg.icon;

    const hub = project.projects_hub?.[0] || {};
    const hubTargets = Array.isArray(hub.targets) ? hub.targets : [];
    const totalLinks = hubTargets.length > 0
        ? hubTargets.reduce((acc, t) => acc + (parseInt(t.quantity || '0', 10)), 0)
        : (project.total_quantity || 0);
    const completedLinks = hub.completed_count ?? 0;

    return (
        <div className="group flex flex-wrap items-center gap-4 px-5 py-4 bg-white rounded-2xl border border-red-100 hover:border-red-200 transition-all">
            {/* Project Name + ID */}
            <div className="flex-[2] min-w-[180px]">
                <p className="text-sm font-bold text-slate-800 line-clamp-1">{project.project_name || 'Unnamed Project'}</p>
                <div className="flex items-center mt-0.5">
                    <span className="font-mono text-[10px] text-slate-400 cursor-help" title={project.id}>
                        {project.id?.substring(0, 8)}...
                    </span>
                    <CopyButton textToCopy={project.id} />
                </div>
                <p className="text-[10px] text-slate-400 font-semibold mt-0.5">
                    Created {project.created_date ? new Date(project.created_date).toLocaleDateString() : '—'}
                    {project.closed_date && (
                        <> · Closed {new Date(project.closed_date).toLocaleDateString()}</>
                    )}
                </p>
            </div>

            {/* Info Button */}
            <div className="flex items-center justify-center shrink-0">
                <AnchorInfoPopup projectId={project.id} projectName={project.project_name} />
            </div>

            {/* Fulfillment at time of close */}
            <div className="flex-1 min-w-[120px]">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Fulfillment at Close</p>
                <p className="text-sm font-bold text-slate-700">{completedLinks} / {totalLinks}</p>
            </div>

            {/* Risk Tier */}
            <div className="flex-1 min-w-[180px]">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Risk Tier</p>
                <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border ${cfg.bg} ${cfg.border}`}>
                    <TierIcon className={`w-3 h-3 ${cfg.text}`} />
                    <span className={`text-[9px] font-black uppercase tracking-widest ${cfg.text}`}>{tier}</span>
                </div>
            </div>

            {/* Close Reason */}
            <div className="flex-[2] min-w-[180px]">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Reason</p>
                <p className="text-xs text-slate-600 font-medium italic line-clamp-2">
                    {project.vendors?.close_reason || '—'}
                </p>
            </div>
        </div>
    );
}

function ClosedGroupCard({ vendorName, projects }) {
    const [collapsed, setCollapsed] = useState(true);

    return (
        <div className="bg-white rounded-2xl border border-red-100 overflow-hidden shadow-sm border-l-4 border-l-red-400">
            <div className="p-6 flex items-center justify-between bg-red-50/30">
                <div>
                    <p className="text-xl font-black text-slate-900 tracking-tight uppercase">{vendorName}</p>
                    <p className="text-[10px] text-red-400 font-black uppercase tracking-widest mt-0.5">{projects.length} closed {projects.length === 1 ? 'project' : 'projects'}</p>
                </div>
                <button
                    onClick={() => setCollapsed(c => !c)}
                    className="px-4 py-2 text-[10px] font-black uppercase tracking-widest text-red-500 bg-red-50 border border-red-100 hover:bg-red-100 rounded-xl transition-colors"
                >
                    {collapsed ? 'Show' : 'Hide'}
                </button>
            </div>

            {!collapsed && (
                <div className="border-t border-red-100 bg-slate-50/60 px-6 pb-6 pt-4 space-y-3">
                    {projects.map((p, i) => <ClosedProjectRow key={p.id || i} project={p} />)}
                </div>
            )}
        </div>
    );
}

export default function CompletedDashboardClient({ finalizedProjects, closedProjects }) {
    const [activeTab, setActiveTab] = useState('finalized');
    const [searchTerm, setSearchTerm] = useState('');

    // --- Finalized tab metrics ---
    let globalOrdered = 0;
    let globalFulfilled = 0;
    finalizedProjects.forEach(p => {
        const hub = p.projects_hub?.[0] || {};
        const hubTargets = Array.isArray(hub.targets) ? hub.targets : [];
        const totalLinks = hubTargets.length > 0
            ? hubTargets.reduce((acc, t) => acc + (parseInt(t.quantity || '0', 10)), 0)
            : (p.total_quantity || 0);
        globalOrdered += totalLinks;
        globalFulfilled += hub.completed_count ?? 0;
    });
    const percentage = globalOrdered > 0 ? (globalFulfilled / globalOrdered) * 100 : 0;

    // --- Finalized grouping ---
    const groupedFinalized = finalizedProjects.reduce((acc, project) => {
        const vendorName = project.vendors?.vendor_name || 'Generic Vendor';
        if (!acc[vendorName]) acc[vendorName] = { id: vendorName, vendorName, projects: [] };
        acc[vendorName].projects.push(project);
        return acc;
    }, {});

    let finalizedGroups = Object.values(groupedFinalized).sort((a, b) =>
        new Date(b.projects[0]?.completed_date || b.projects[0]?.created_date || 0) -
        new Date(a.projects[0]?.completed_date || a.projects[0]?.created_date || 0)
    );

    // --- Closed grouping ---
    const groupedClosed = closedProjects.reduce((acc, project) => {
        const vendorName = project.vendors?.vendor_name || 'Generic Vendor';
        if (!acc[vendorName]) acc[vendorName] = { vendorName, projects: [] };
        acc[vendorName].projects.push(project);
        return acc;
    }, {});

    let closedGroups = Object.values(groupedClosed).sort((a, b) =>
        new Date(b.projects[0]?.closed_date || 0) - new Date(a.projects[0]?.closed_date || 0)
    );

    // --- Search filter ---
    if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase();
        if (activeTab === 'finalized') {
            finalizedGroups = finalizedGroups.map(group => {
                const groupMatch = group.vendorName.toLowerCase().includes(term);
                const matchingProjects = group.projects.filter(p => {
                    const nameMatch = (p.project_name || '').toLowerCase().includes(term);
                    const targets = p.projects_hub?.[0]?.targets || [];
                    const keywordMatch = targets.some(t =>
                        (t.anchor_text || '').toLowerCase().includes(term) ||
                        (t.category || '').toLowerCase().includes(term)
                    );
                    return nameMatch || keywordMatch;
                });
                if (groupMatch) return group;
                if (matchingProjects.length > 0) return { ...group, projects: matchingProjects };
                return null;
            }).filter(Boolean);
        } else {
            closedGroups = closedGroups.map(group => {
                const groupMatch = group.vendorName.toLowerCase().includes(term);
                const matchingProjects = group.projects.filter(p =>
                    (p.project_name || '').toLowerCase().includes(term)
                );
                if (groupMatch) return group;
                if (matchingProjects.length > 0) return { ...group, projects: matchingProjects };
                return null;
            }).filter(Boolean);
        }
    }

    return (
        <div className="max-w-screen-2xl mx-auto space-y-8 pb-20 px-4">
            {/* Header */}
            <div className="pt-8 flex flex-col xl:flex-row xl:items-end justify-between gap-6 relative z-20">
                <div>
                    <h1 className="text-4xl font-black text-slate-900 tracking-tight uppercase">Completed & Closed</h1>
                    <p className="mt-2 text-[10px] font-black uppercase tracking-widest text-slate-400">
                        Vault of finalized deliverables and closed project records.
                    </p>
                </div>

                <div className="flex flex-col sm:flex-row items-end gap-6 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                    {activeTab === 'finalized' && (
                        <div className="flex flex-col min-w-[160px]">
                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Total Fulfillment</span>
                            <div className="flex items-baseline gap-2">
                                <span className="text-2xl font-black text-emerald-600 leading-none">{globalFulfilled}</span>
                                <span className="text-sm font-bold text-slate-400">/ {globalOrdered}</span>
                            </div>
                            <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden mt-3">
                                <div className="h-full rounded-full bg-emerald-500 transition-all duration-1000" style={{ width: `${percentage}%` }} />
                            </div>
                        </div>
                    )}
                    {activeTab === 'closed' && (
                        <div className="flex flex-col min-w-[160px]">
                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Closed Projects</span>
                            <div className="flex items-baseline gap-2">
                                <span className="text-2xl font-black text-red-500 leading-none">{closedProjects.length}</span>
                                <span className="text-sm font-bold text-slate-400">total</span>
                            </div>
                        </div>
                    )}

                    {/* Search */}
                    <div className="relative w-full sm:w-72">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <Search className="h-4 w-4 text-slate-400" />
                        </div>
                        <input
                            type="text"
                            placeholder="Search vendors, projects..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            className="block w-full pl-10 pr-3 py-3 border border-slate-200 rounded-xl leading-5 bg-slate-50 hover:bg-white placeholder-slate-400 focus:outline-none focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 sm:text-sm transition-all text-slate-900 font-medium"
                        />
                    </div>
                </div>
            </div>

            {/* Tab Switcher */}
            <div className="flex items-center gap-2 bg-slate-100 p-1.5 rounded-2xl w-fit">
                <button
                    onClick={() => { setActiveTab('finalized'); setSearchTerm(''); }}
                    className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all ${activeTab === 'finalized'
                        ? 'bg-white text-emerald-700 shadow-sm border border-emerald-100'
                        : 'text-slate-500 hover:text-slate-700'}`}
                >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Finalized ({finalizedProjects.length})
                </button>
                <button
                    onClick={() => { setActiveTab('closed'); setSearchTerm(''); }}
                    className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all ${activeTab === 'closed'
                        ? 'bg-white text-red-600 shadow-sm border border-red-100'
                        : 'text-slate-500 hover:text-slate-700'}`}
                >
                    <XCircle className="w-3.5 h-3.5" />
                    Closed Projects ({closedProjects.length})
                </button>
            </div>

            {/* Tab Content */}
            <div className="space-y-6">
                {activeTab === 'finalized' ? (
                    finalizedGroups.length > 0 ? (
                        finalizedGroups.map(group => (
                            <PlacementGroupCard key={group.id} group={group} isCompletedView={true} />
                        ))
                    ) : (
                        <div className="text-center py-40 bg-slate-50 rounded-3xl border-2 border-dashed border-slate-200">
                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-300">
                                No finalized projects match your criteria
                            </p>
                        </div>
                    )
                ) : (
                    closedGroups.length > 0 ? (
                        closedGroups.map(group => (
                            <ClosedGroupCard key={group.vendorName} vendorName={group.vendorName} projects={group.projects} />
                        ))
                    ) : (
                        <div className="text-center py-40 bg-slate-50 rounded-3xl border-2 border-dashed border-red-100">
                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-300">
                                No closed projects on record
                            </p>
                        </div>
                    )
                )}
            </div>
        </div>
    );
}
