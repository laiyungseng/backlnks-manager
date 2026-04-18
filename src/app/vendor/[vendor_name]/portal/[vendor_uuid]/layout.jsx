'use client';

import { useState, useEffect } from 'react';
import { usePathname, useParams } from 'next/navigation';
import Link from 'next/link';
import { FileSpreadsheet, Loader, CheckCircle2, Clock, PanelLeftClose, PanelLeftOpen, LogOut, LayoutDashboard } from 'lucide-react';
import { vendorLogoutAction } from '@/app/vendor/actions';

export default function VendorPortalLayout({ children }) {
    const [collapsed, setCollapsed] = useState(false);
    const [lastProjectHash, setLastProjectHash] = useState('');
    const pathname = usePathname();
    const params = useParams();

    const vendorName = params?.vendor_name || 'vendor';
    const vendorUuid = params?.vendor_uuid || '';
    const displayName = vendorName.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

    const navItems = [
        { label: 'Dashboard', href: `/vendor/${vendorName}/portal/${vendorUuid}/dashboard`, icon: LayoutDashboard, match: '/dashboard' },
        { label: 'Pending Payment', href: `/vendor/${vendorName}/portal/${vendorUuid}/pending`, icon: Clock, match: '/pending' },
        { label: 'In Progress', href: `/vendor/${vendorName}/portal/${vendorUuid}/inprogress`, icon: Loader, match: '/inprogress' },
        { label: 'Completed', href: `/vendor/${vendorName}/portal/${vendorUuid}/completed`, icon: CheckCircle2, match: '/completed' },
    ];

    const isActive = (match) => pathname.includes(match);

    useEffect(() => {
        const savedHash = localStorage.getItem(`lastProjectHash_${vendorName}`);
        if (savedHash) setLastProjectHash(savedHash);
    }, [vendorName]);

    return (
        <div className="flex h-screen bg-gray-50 overflow-hidden">
            <aside className={`${collapsed ? 'w-16' : 'w-64'} bg-white border-r border-gray-200 flex flex-col transition-all duration-300 shrink-0 sticky top-0 h-screen z-20`}>
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

                <nav className="flex-1 px-2 py-4 space-y-1">
                    {lastProjectHash && (
                        <Link
                            href={`/vendor/${vendorName}/${lastProjectHash}`}
                            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors text-gray-600 hover:bg-gray-50 hover:text-gray-900 ${collapsed ? 'justify-center' : ''}`}
                            title={collapsed ? 'Current Project' : undefined}
                        >
                            <FileSpreadsheet className="w-4 h-4 shrink-0" />
                            {!collapsed && <span>Current Project</span>}
                        </Link>
                    )}

                    {navItems.map((item) => {
                        const Icon = item.icon;
                        const active = isActive(item.match);
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
                </nav>

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
                        className={`w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-gray-500 hover:text-gray-700 hover:bg-gray-50 transition-colors ${collapsed ? 'mx-auto' : ''}`}
                        title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                    >
                        {collapsed ? <PanelLeftOpen className="w-5 h-5" /> : <><PanelLeftClose className="w-5 h-5" /><span>Collapse</span></>}
                    </button>
                </div>
            </aside>

            <main className="flex-1 min-w-0 overflow-y-auto">
                {children}
            </main>
        </div>
    );
}
