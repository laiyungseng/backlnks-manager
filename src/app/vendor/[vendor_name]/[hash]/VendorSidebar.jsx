'use client';

import { useState } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import {
    LayoutDashboard, Clock, Loader, CheckCircle2,
    PanelLeftClose, PanelLeftOpen, LogOut, FolderOpen, ChevronRight,
    Star, Gauge, ChevronDown
} from 'lucide-react';
import { vendorLogoutAction } from '@/app/vendor/actions';

function ProjectLink({ p, currentHash, vendorName }) {
    const isCurrent = p.hash === currentHash;
    return (
        <Link
            href={`/vendor/${vendorName}/${p.hash}`}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${isCurrent
                ? 'bg-indigo-50 text-indigo-700 border border-indigo-100'
                : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
            }`}
        >
            <ChevronRight className={`w-3 h-3 shrink-0 ${isCurrent ? 'text-indigo-500' : 'text-gray-300'}`} />
            <span className="truncate flex-1">{p.project_name || 'Unnamed'}</span>
            <span className="flex items-center gap-1 shrink-0">
                {p.is_priority && <Star className="w-3 h-3 text-amber-400 fill-amber-400" title="Priority" />}
                {p.dripfeed_enabled && <Gauge className="w-3 h-3 text-sky-400" title="Dripfeed" />}
                {isCurrent && <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />}
            </span>
        </Link>
    );
}

function ProjectGroup({ label, icon: Icon, iconClass, items, currentHash, vendorName, defaultOpen = true }) {
    const [open, setOpen] = useState(defaultOpen);
    if (items.length === 0) return null;
    return (
        <div className="pt-2">
            <button
                type="button"
                onClick={() => setOpen(v => !v)}
                className="w-full flex items-center gap-1.5 px-3 py-1 hover:bg-gray-50 rounded-lg transition-colors"
            >
                <Icon className={`w-3.5 h-3.5 ${iconClass}`} />
                <span className={`text-[10px] font-bold uppercase tracking-wider flex-1 text-left ${iconClass}`}>{label}</span>
                <span className="text-[10px] font-mono text-gray-400 mr-1">{items.length}</span>
                {open
                    ? <ChevronDown className="w-3 h-3 text-gray-400" />
                    : <ChevronRight className="w-3 h-3 text-gray-400" />}
            </button>
            {open && (
                <div className="mt-0.5 space-y-0.5">
                    {items.map(p => (
                        <ProjectLink key={p.hash} p={p} currentHash={currentHash} vendorName={vendorName} />
                    ))}
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

    const focusProjects = projects.filter(p => p.is_priority && p.status !== 'Finalized');
    const inProgressProjects = projects.filter(p => !p.is_priority && p.status !== 'Finalized');
    const completedProjects = projects.filter(p => p.status === 'Finalized');

    const navItems = [
        { label: 'Dashboard', href: `${base}/dashboard`, icon: LayoutDashboard },
        { label: 'Pending Payment', href: `${base}/pending`, icon: Clock },
        { label: 'In Progress', href: `${base}/inprogress`, icon: Loader },
        { label: 'Completed', href: `${base}/completed`, icon: CheckCircle2 },
    ];

    return (
        <aside className={`${collapsed ? 'w-16' : 'w-64'} bg-white border-r border-gray-200 flex flex-col transition-all duration-300 shrink-0 sticky top-0 h-screen z-20`}>
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

            <nav className="flex-1 px-2 py-4 space-y-1 overflow-y-auto min-h-0">
                {/* Portal nav */}
                {navItems.map((item) => {
                    const Icon = item.icon;
                    const active = pathname === item.href;
                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${collapsed ? 'justify-center' : ''} ${active
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

                {/* Project groups (expanded sidebar) */}
                {projects.length > 0 && !collapsed && (
                    <div className="pt-2 border-t border-gray-100 mt-2">
                        <ProjectGroup
                            label="Project Focus"
                            icon={Star}
                            iconClass="text-amber-500"
                            items={focusProjects}
                            currentHash={currentHash}
                            vendorName={vendorName}
                            defaultOpen={true}
                        />
                        <ProjectGroup
                            label="In Progress"
                            icon={Loader}
                            iconClass="text-indigo-500"
                            items={inProgressProjects}
                            currentHash={currentHash}
                            vendorName={vendorName}
                            defaultOpen={true}
                        />
                        <ProjectGroup
                            label="Completed"
                            icon={CheckCircle2}
                            iconClass="text-emerald-500"
                            items={completedProjects}
                            currentHash={currentHash}
                            vendorName={vendorName}
                            defaultOpen={false}
                        />
                    </div>
                )}

                {/* Collapsed project dots */}
                {projects.length > 0 && collapsed && (
                    <div className="pt-2 flex flex-col items-center gap-1">
                        {focusProjects.map(p => (
                            <Link
                                key={p.hash}
                                href={`/vendor/${vendorName}/${p.hash}`}
                                title={`[Focus] ${p.project_name || 'Unnamed'}${p.dripfeed_enabled ? ' · Dripfeed' : ''}`}
                                className={`w-7 h-7 flex items-center justify-center rounded-lg transition-colors ${p.hash === currentHash ? 'bg-amber-50 text-amber-500 border border-amber-200' : 'text-amber-400 hover:bg-amber-50'}`}
                            >
                                <Star className="w-3.5 h-3.5 fill-current" />
                            </Link>
                        ))}
                        {focusProjects.length > 0 && inProgressProjects.length > 0 && (
                            <div className="w-4 border-t border-gray-200 my-0.5" />
                        )}
                        {inProgressProjects.map(p => (
                            <Link
                                key={p.hash}
                                href={`/vendor/${vendorName}/${p.hash}`}
                                title={`${p.project_name || 'Unnamed'}${p.dripfeed_enabled ? ' · Dripfeed' : ''}`}
                                className={`w-7 h-7 flex items-center justify-center rounded-lg transition-colors ${p.hash === currentHash ? 'bg-indigo-50 text-indigo-600 border border-indigo-200' : 'text-gray-400 hover:bg-gray-50 hover:text-gray-600'}`}
                            >
                                <FolderOpen className="w-3.5 h-3.5" />
                            </Link>
                        ))}
                        {completedProjects.length > 0 && (inProgressProjects.length > 0 || focusProjects.length > 0) && (
                            <div className="w-4 border-t border-gray-200 my-0.5" />
                        )}
                        {completedProjects.map(p => (
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
            </nav>

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
