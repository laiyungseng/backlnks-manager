'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import {
    LayoutDashboard, Clock, Loader, CheckCircle2,
    PanelLeftClose, PanelLeftOpen, LogOut, FolderOpen, ChevronRight,
    Star, Gauge, ChevronDown, FileSpreadsheet, ArrowDown
} from 'lucide-react';
import { vendorLogoutAction } from '@/app/vendor/actions';

function scrollMainToTop() {
    document.getElementById('vendor-main')?.scrollTo({ top: 0, behavior: 'smooth' });
}

function formatTitleWithDate(dateStr, title) {
    if (!dateStr) return title || 'Unnamed';
    const d = new Date(dateStr);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}.${mm}.${dd}-${title || 'Unnamed'}`;
}

// Group flat siblingProjects (already mapped) by campaign_id; orphans (no campaign) become single-plan groups.
function buildSidebarGroups(projects) {
    const groups = new Map();
    const orphans = [];
    for (const p of projects) {
        if (!p.campaign_id) {
            orphans.push(p);
            continue;
        }
        if (!groups.has(p.campaign_id)) {
            groups.set(p.campaign_id, {
                campaignId: p.campaign_id,
                title: p.campaign_title || p.project_name || 'Unnamed',
                plans: [],
            });
        }
        groups.get(p.campaign_id).plans.push(p);
    }
    const aggregate = (g) => {
        const earliest = g.plans
            .map(p => p.created_date ? new Date(p.created_date).getTime() : Infinity)
            .reduce((a, b) => Math.min(a, b), Infinity);
        const allFinalized = g.plans.every(p => p.status === 'Finalized');
        const anyPriority = g.plans.some(p => p.is_priority);
        const anyDripfeed = g.plans.some(p => p.dripfeed_enabled);
        return {
            ...g,
            earliestCreated: earliest === Infinity ? null : new Date(earliest).toISOString(),
            allFinalized,
            anyPriority,
            anyDripfeed,
        };
    };
    const aggGroups = Array.from(groups.values()).map(aggregate);
    const orphanGroups = orphans.map(p => aggregate({
        campaignId: null,
        title: p.project_name || 'Unnamed',
        plans: [p],
    }));
    return [...aggGroups, ...orphanGroups];
}

function bucketGroup(g) {
    if (g.allFinalized) return 'completed';
    if (g.anyPriority) return 'focus';
    return 'inprogress';
}

function PlanLink({ plan, currentHash, vendorName, activeRef }) {
    const isCurrent = plan.hash === currentHash;
    const fullName = plan.project_name || 'Unnamed';
    return (
        <Link
            ref={isCurrent ? activeRef : undefined}
            href={`/vendor/${vendorName}/${plan.hash}`}
            onClick={scrollMainToTop}
            title={fullName}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                isCurrent
                    ? 'bg-indigo-50 text-indigo-700 border border-indigo-100'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
            }`}
        >
            <ChevronRight className={`w-3 h-3 shrink-0 ${isCurrent ? 'text-indigo-500' : 'text-gray-300'}`} />
            <span className="truncate min-w-0 flex-1">{fullName}</span>
            {plan.category && (
                <span
                    className="shrink-0 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-purple-50 text-purple-700 border border-purple-100 truncate max-w-[80px]"
                    title={plan.category}
                >
                    {plan.category}
                </span>
            )}
            <span className="flex items-center gap-1 shrink-0">
                {plan.is_priority && <Star className="w-3 h-3 text-amber-400 fill-amber-400" title="Priority" />}
                {plan.dripfeed_enabled && <Gauge className="w-3 h-3 text-sky-400" title="Dripfeed" />}
                {isCurrent && <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />}
            </span>
        </Link>
    );
}

function CampaignRow({ group, currentHash, vendorName, activeRef, expanded, onToggle }) {
    const titleLabel = formatTitleWithDate(group.earliestCreated, group.title);
    const firstPlanHash = group.plans[0]?.hash;
    const containsCurrent = group.plans.some(p => p.hash === currentHash);

    return (
        <div>
            <div
                className={`w-full flex items-center gap-1 px-1 py-1.5 rounded-md text-xs font-semibold transition-colors ${
                    containsCurrent ? 'text-indigo-700 bg-indigo-50/50' : 'text-gray-700 hover:bg-gray-50'
                }`}
            >
                <button
                    type="button"
                    onClick={onToggle}
                    title={expanded ? 'Collapse' : 'Expand'}
                    className="p-1 rounded hover:bg-gray-100 shrink-0"
                >
                    <ChevronDown className={`w-3 h-3 text-gray-400 transition-transform duration-200 ${expanded ? '' : '-rotate-90'}`} />
                </button>
                <Link
                    href={firstPlanHash ? `/vendor/${vendorName}/${firstPlanHash}` : '#'}
                    onClick={scrollMainToTop}
                    title={titleLabel}
                    className="truncate flex-1 text-left hover:underline"
                >
                    {titleLabel}
                </Link>
                <span className="flex items-center gap-1 shrink-0 pr-1">
                    {group.anyPriority && <Star className="w-3 h-3 text-amber-400 fill-amber-400" />}
                    {group.anyDripfeed && <Gauge className="w-3 h-3 text-sky-400" />}
                    <span className="text-[10px] font-mono text-gray-400">{group.plans.length}</span>
                </span>
            </div>
            {expanded && (
                <div className="ml-3 mt-0.5 border-l border-gray-100 pl-2 space-y-0.5">
                    {group.plans.map(plan => (
                        <PlanLink key={plan.hash} plan={plan} currentHash={currentHash} vendorName={vendorName} activeRef={activeRef} />
                    ))}
                </div>
            )}
        </div>
    );
}

function groupKey(g) {
    return g.campaignId || `orphan-${g.plans[0].hash}`;
}

function StatusSection({ label, icon: Icon, iconClass, groups, currentHash, vendorName, defaultOpen, activeRef, expandedSet, onToggleCampaign }) {
    const [open, setOpen] = useState(defaultOpen);
    if (groups.length === 0) return null;
    return (
        <div className="pt-2">
            <button
                type="button"
                onClick={() => setOpen(v => !v)}
                className="w-full flex items-center gap-1.5 px-3 py-1 hover:bg-gray-50 rounded-lg transition-colors"
            >
                <Icon className={`w-3.5 h-3.5 ${iconClass}`} />
                <span className={`text-[10px] font-bold uppercase tracking-wider flex-1 text-left ${iconClass}`}>{label}</span>
                <span className="text-[10px] font-mono text-gray-400 mr-1">{groups.length}</span>
                {open
                    ? <ChevronDown className="w-3 h-3 text-gray-400" />
                    : <ChevronRight className="w-3 h-3 text-gray-400" />}
            </button>
            {open && (
                <div className="mt-0.5 space-y-0.5">
                    {groups.map(g => {
                        const k = groupKey(g);
                        return (
                            <CampaignRow
                                key={k}
                                group={g}
                                currentHash={currentHash}
                                vendorName={vendorName}
                                activeRef={activeRef}
                                expanded={expandedSet.has(k)}
                                onToggle={() => onToggleCampaign(k)}
                            />
                        );
                    })}
                </div>
            )}
        </div>
    );
}

export default function VendorSidebar({ vendorName, vendorUuid, currentHash, projects }) {
    const [collapsed, setCollapsed] = useState(false);
    const pathname = usePathname();

    const displayName = vendorName.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    const base = `/vendor/${vendorName}/portal/${vendorUuid}`;

    const { allGroups, focusGroups, inProgressGroups, completedGroups } = useMemo(() => {
        const all = buildSidebarGroups(projects);
        return {
            allGroups: all,
            focusGroups: all.filter(g => bucketGroup(g) === 'focus'),
            inProgressGroups: all.filter(g => bucketGroup(g) === 'inprogress'),
            completedGroups: all.filter(g => bucketGroup(g) === 'completed'),
        };
    }, [projects]);

    const currentProjectHref = `/vendor/${vendorName}/${currentHash}`;
    const isOnProjectPage = pathname === currentProjectHref;

    const activeRef = useRef(null);
    const scrollContainerRef = useRef(null);
    const [activeOutOfView, setActiveOutOfView] = useState(false);
    const activeProject = projects.find(p => p.hash === currentHash);

    // Lifted: which campaigns are expanded (controlled). Default empty set = all collapsed.
    const [expandedSet, setExpandedSet] = useState(new Set());
    const toggleCampaign = (k) => {
        setExpandedSet(prev => {
            const next = new Set(prev);
            next.has(k) ? next.delete(k) : next.add(k);
            return next;
        });
    };

    // Sticky Active Preview observer — only fires when active link is mounted (parent expanded)
    useEffect(() => {
        if (collapsed) { setActiveOutOfView(false); return; }
        const root = scrollContainerRef.current;
        if (!root) return;
        const el = activeRef.current;
        if (!el) {
            // Active plan is hidden inside a collapsed parent — treat as out-of-view
            setActiveOutOfView(true);
            return;
        }
        const obs = new IntersectionObserver(
            ([entry]) => setActiveOutOfView(!entry.isIntersecting),
            { root, threshold: 0.5 }
        );
        obs.observe(el);
        return () => obs.disconnect();
    }, [currentHash, collapsed, projects.length, expandedSet]);

    const jumpToActive = () => {
        // Find the campaign containing the active plan; force-expand it if collapsed
        const containing = allGroups.find(g => g.plans.some(p => p.hash === currentHash));
        if (containing) {
            const k = groupKey(containing);
            if (!expandedSet.has(k)) {
                setExpandedSet(prev => {
                    const next = new Set(prev);
                    next.add(k);
                    return next;
                });
            }
        }
        // Wait for the expanded parent to mount the active PlanLink, then scroll
        setTimeout(() => {
            const el = activeRef.current;
            if (el) {
                try { el.scrollIntoView({ block: 'center', behavior: 'smooth' }); } catch {}
            }
        }, 80);
    };

    const navItems = [
        { label: 'Dashboard', href: `${base}/dashboard`, icon: LayoutDashboard },
        { label: 'Pending Payment', href: `${base}/pending`, icon: Clock },
        { label: 'In Progress', href: `${base}/inprogress`, icon: Loader },
        { label: 'Completed', href: `${base}/completed`, icon: CheckCircle2 },
    ];

    return (
        <aside className={`${collapsed ? 'w-16' : 'w-72'} bg-white border-r border-gray-200 flex flex-col transition-all duration-300 shrink-0 sticky top-0 h-screen z-20`}>
            {/* Header */}
            <div className="h-16 px-4 flex items-center gap-2 border-b border-gray-100 shrink-0">
                <div className="bg-indigo-600 w-8 h-8 rounded flex items-center justify-center text-sm font-bold text-white shadow shrink-0">
                    DF
                </div>
                {!collapsed && (
                    <div className="overflow-hidden">
                        <span className="text-sm font-bold text-gray-900 block truncate">{displayName}</span>
                        <span className="text-[10px] text-gray-400 uppercase tracking-wider">Vendor Portal</span>
                    </div>
                )}
            </div>

            {/* Fixed nav zone — always visible, never scrolls */}
            <div className={`px-2 pt-4 pb-2 shrink-0 ${!collapsed ? 'space-y-1' : 'space-y-1'}`}>
                <Link
                    href={currentProjectHref}
                    onClick={scrollMainToTop}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${collapsed ? 'justify-center' : ''} ${
                        isOnProjectPage
                            ? 'bg-indigo-50 text-indigo-700 border border-indigo-100'
                            : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                    }`}
                    title={collapsed ? 'Current Project' : undefined}
                >
                    <FileSpreadsheet className="w-4 h-4 shrink-0" />
                    {!collapsed && <span>Current Project</span>}
                </Link>

                {navItems.map((item) => {
                    const Icon = item.icon;
                    const active = pathname === item.href;
                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${collapsed ? 'justify-center' : ''} ${
                                active
                                    ? 'bg-indigo-50 text-indigo-700 border border-indigo-100'
                                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                            }`}
                            title={collapsed ? item.label : undefined}
                        >
                            <Icon className="w-4 h-4 shrink-0" />
                            {!collapsed && <span>{item.label}</span>}
                        </Link>
                    );
                })}

                {projects.length > 0 && !collapsed && (
                    <div className="border-t border-gray-100 mt-2 pt-0" />
                )}
            </div>

            {/* Scrollable campaign list zone */}
            {projects.length > 0 && !collapsed && (
                <div ref={scrollContainerRef} className="flex-1 overflow-y-auto min-h-0 px-2 pb-2 relative">
                    <StatusSection
                        label="Project Focus"
                        icon={Star}
                        iconClass="text-amber-500"
                        groups={focusGroups}
                        currentHash={currentHash}
                        vendorName={vendorName}
                        defaultOpen={true}
                        activeRef={activeRef}
                        expandedSet={expandedSet}
                        onToggleCampaign={toggleCampaign}
                    />
                    <StatusSection
                        label="In Progress"
                        icon={Loader}
                        iconClass="text-indigo-500"
                        groups={inProgressGroups}
                        currentHash={currentHash}
                        vendorName={vendorName}
                        defaultOpen={true}
                        activeRef={activeRef}
                        expandedSet={expandedSet}
                        onToggleCampaign={toggleCampaign}
                    />
                    <StatusSection
                        label="Completed"
                        icon={CheckCircle2}
                        iconClass="text-emerald-500"
                        groups={completedGroups}
                        currentHash={currentHash}
                        vendorName={vendorName}
                        defaultOpen={false}
                        activeRef={activeRef}
                        expandedSet={expandedSet}
                        onToggleCampaign={toggleCampaign}
                    />
                </div>
            )}

            {/* Sticky Active Preview — shown when active project is hidden or scrolled out */}
            {!collapsed && activeOutOfView && activeProject && (
                <button
                    onClick={jumpToActive}
                    className="mx-2 mb-2 flex items-center gap-2 px-3 py-2 rounded-lg bg-indigo-50 border border-indigo-200 text-left shadow-sm hover:bg-indigo-100 transition-colors"
                    title="Jump to active project"
                >
                    <FileSpreadsheet className="w-4 h-4 text-indigo-600 shrink-0" />
                    <div className="flex flex-col min-w-0 flex-1">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-500">Active</span>
                        <span className="text-xs font-semibold text-indigo-900 truncate">{activeProject.project_name || 'Unnamed'}</span>
                    </div>
                    <ArrowDown className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                </button>
            )}

            {/* Collapsed project dots — flat (campaign grouping doesn't apply when narrow) */}
            {projects.length > 0 && collapsed && (
                <div className="flex-1 overflow-y-auto min-h-0 pt-2 flex flex-col items-center gap-1 px-2 pb-2">
                    {projects.filter(p => p.is_priority && p.status !== 'Finalized').map(p => (
                        <Link
                            key={p.hash}
                            href={`/vendor/${vendorName}/${p.hash}`}
                            title={`[Focus] ${p.project_name || 'Unnamed'}${p.dripfeed_enabled ? ' · Dripfeed' : ''}`}
                            className={`w-7 h-7 flex items-center justify-center rounded-lg transition-colors ${p.hash === currentHash ? 'bg-amber-50 text-amber-500 border border-amber-200' : 'text-amber-400 hover:bg-amber-50'}`}
                        >
                            <Star className="w-3.5 h-3.5 fill-current" />
                        </Link>
                    ))}
                    {projects.filter(p => !p.is_priority && p.status !== 'Finalized').map(p => (
                        <Link
                            key={p.hash}
                            href={`/vendor/${vendorName}/${p.hash}`}
                            title={`${p.project_name || 'Unnamed'}${p.dripfeed_enabled ? ' · Dripfeed' : ''}`}
                            className={`w-7 h-7 flex items-center justify-center rounded-lg transition-colors ${p.hash === currentHash ? 'bg-indigo-50 text-indigo-600 border border-indigo-200' : 'text-gray-400 hover:bg-gray-50 hover:text-gray-600'}`}
                        >
                            <FolderOpen className="w-3.5 h-3.5" />
                        </Link>
                    ))}
                    {projects.filter(p => p.status === 'Finalized').map(p => (
                        <Link
                            key={p.hash}
                            href={`/vendor/${vendorName}/${p.hash}`}
                            title={`[Done] ${p.project_name || 'Unnamed'}`}
                            className={`w-7 h-7 flex items-center justify-center rounded-lg transition-colors ${p.hash === currentHash ? 'bg-emerald-50 text-emerald-600 border border-emerald-200' : 'text-emerald-400 hover:bg-emerald-50'}`}
                        >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                        </Link>
                    ))}
                </div>
            )}

            {/* Footer */}
            <div className="px-2 py-3 border-t border-gray-100 shrink-0 space-y-1">
                <form action={vendorLogoutAction}>
                    <button
                        type="submit"
                        className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-red-500 hover:text-red-700 hover:bg-red-50 transition-colors ${collapsed ? 'justify-center' : ''}`}
                        title={collapsed ? 'Sign Out' : undefined}
                    >
                        <LogOut className="w-4 h-4 shrink-0" />
                        {!collapsed && <span>Sign Out</span>}
                    </button>
                </form>
                <button
                    onClick={() => setCollapsed(!collapsed)}
                    className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-gray-500 hover:text-gray-700 hover:bg-gray-50 transition-colors"
                    title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                >
                    {collapsed ? <PanelLeftOpen className="w-5 h-5" /> : <><PanelLeftClose className="w-5 h-5" /><span>Collapse</span></>}
                </button>
            </div>
        </aside>
    );
}
