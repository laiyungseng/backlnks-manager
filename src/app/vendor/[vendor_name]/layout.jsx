'use client';

import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { FileSpreadsheet, Loader, CheckCircle2, PanelLeftClose, PanelLeftOpen } from 'lucide-react';

export default function VendorLayout({ children, params }) {
    const [collapsed, setCollapsed] = useState(false);
    const [lastProjectHash, setLastProjectHash] = useState('');
    const pathname = usePathname();

    // Extract vendor_name from the URL path
    const pathParts = pathname.split('/');
    const vendorNameIndex = pathParts.indexOf('vendor') + 1;
    const vendorName = pathParts[vendorNameIndex] || 'vendor';
    const displayName = vendorName.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

    const navItems = [
        {
            label: 'In Progress',
            href: `/vendor/${vendorName}/inprogress`,
            icon: Loader,
            match: '/inprogress'
        },
        {
            label: 'Completed',
            href: `/vendor/${vendorName}/completed`,
            icon: CheckCircle2,
            match: '/completed'
        }
    ];

    const isActive = (match) => pathname.includes(match);
    // Current project page is any hash-based route (not inprogress/completed)
    const isProjectPage = !pathname.includes('/inprogress') && !pathname.includes('/completed') && pathParts.length > vendorNameIndex + 1;

    useEffect(() => {
        if (isProjectPage) {
            const hash = pathParts[vendorNameIndex + 1];
            if (hash) {
                setLastProjectHash(hash);
                localStorage.setItem(`lastProjectHash_${vendorName}`, hash);
            }
        } else {
            const savedHash = localStorage.getItem(`lastProjectHash_${vendorName}`);
            if (savedHash) setLastProjectHash(savedHash);
        }
    }, [pathname, isProjectPage, pathParts, vendorNameIndex, vendorName]);

    return (
        <div className="flex min-h-screen bg-gray-50">
            {/* Sidebar */}
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

                {/* Nav */}
                <nav className="flex-1 px-2 py-4 space-y-1">
                    {(isProjectPage || lastProjectHash) && (
                        <Link
                            href={`/vendor/${vendorName}/${isProjectPage ? pathParts[vendorNameIndex + 1] : lastProjectHash}`}
                            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${collapsed ? 'justify-center' : ''} ${isProjectPage ? 'bg-indigo-50 text-indigo-700 border border-indigo-100' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'}`}
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

                {/* Toggle */}
                <div className="px-2 py-3 border-t border-gray-100 shrink-0">
                    <button
                        onClick={() => setCollapsed(!collapsed)}
                        className={`w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-gray-500 hover:text-gray-700 hover:bg-gray-50 transition-colors ${collapsed ? 'mx-auto' : ''}`}
                        title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                    >
                        {collapsed ? <PanelLeftOpen className="w-5 h-5" /> : <><PanelLeftClose className="w-5 h-5" /><span>Collapse</span></>}
                    </button>
                </div>
            </aside>

            {/* Main content */}
            <main className="flex-1 min-w-0">
                {children}
            </main>
        </div>
    );
}
