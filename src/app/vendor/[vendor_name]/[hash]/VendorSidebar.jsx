'use client';

import { useState } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import {
    LayoutDashboard, Clock, Loader, CheckCircle2,
    PanelLeftClose, PanelLeftOpen, LogOut, FolderOpen, ChevronRight
} from 'lucide-react';
import { vendorLogoutAction } from '@/app/vendor/actions';

export default function VendorSidebar({ vendorName, vendorUuid, currentHash, projects }) {
    const [collapsed, setCollapsed] = useState(false);
    const pathname = usePathname();

    const displayName = vendorName.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    const base = `/vendor/${vendorName}/portal/${vendorUuid}`;

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

                {/* Project switcher */}
                {projects.length > 0 && !collapsed && (
                    <div className="pt-3">
                        <div className="flex items-center gap-1.5 px-3 pb-1.5">
                            <FolderOpen className="w-3.5 h-3.5 text-gray-400" />
                            <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Projects</span>
                        </div>
                        <div className="space-y-0.5">
                            {projects.map((p) => {
                                const isCurrent = p.hash === currentHash;
                                return (
                                    <Link
                                        key={p.hash}
                                        href={`/vendor/${vendorName}/${p.hash}`}
                                        className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${isCurrent
                                            ? 'bg-indigo-50 text-indigo-700 border border-indigo-100'
                                            : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                                        }`}
                                    >
                                        <ChevronRight className={`w-3 h-3 shrink-0 ${isCurrent ? 'text-indigo-500' : 'text-gray-300'}`} />
                                        <span className="truncate">{p.project_name || 'Unnamed'}</span>
                                        {isCurrent && <span className="ml-auto shrink-0 w-1.5 h-1.5 rounded-full bg-indigo-500" />}
                                    </Link>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* Collapsed project dots */}
                {projects.length > 0 && collapsed && (
                    <div className="pt-2 flex flex-col items-center gap-1">
                        {projects.map((p) => {
                            const isCurrent = p.hash === currentHash;
                            return (
                                <Link
                                    key={p.hash}
                                    href={`/vendor/${vendorName}/${p.hash}`}
                                    title={p.project_name || 'Unnamed'}
                                    className={`w-7 h-7 flex items-center justify-center rounded-lg transition-colors ${isCurrent
                                        ? 'bg-indigo-50 text-indigo-600 border border-indigo-200'
                                        : 'text-gray-400 hover:bg-gray-50 hover:text-gray-600'
                                    }`}
                                >
                                    <FolderOpen className="w-3.5 h-3.5" />
                                </Link>
                            );
                        })}
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
                    className={`w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-gray-500 hover:text-gray-700 hover:bg-gray-50 transition-colors`}
                    title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                >
                    {collapsed ? <PanelLeftOpen className="w-5 h-5" /> : <><PanelLeftClose className="w-5 h-5" /><span>Collapse</span></>}
                </button>
            </div>
        </aside>
    );
}
