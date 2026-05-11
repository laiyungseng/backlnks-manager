'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
import { usePathname, useParams } from 'next/navigation';
import Link from 'next/link';
import { Loader, CheckCircle2, Clock, PanelLeftClose, PanelLeftOpen, LogOut, LayoutDashboard, ArrowUp, Package } from 'lucide-react';
import { vendorLogoutAction } from '@/app/vendor/actions';
import ActiveFiltersBar from './_lib/ActiveFiltersBar';
import StickyProjectTab from './_lib/StickyProjectTab';

export default function VendorPortalLayout({ children }) {
    const [collapsed, setCollapsed] = useState(false);
    const [showScrollTop, setShowScrollTop] = useState(false);
    const mainRef = useRef(null);
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
        { label: 'Backlink Packages', href: `/vendor/${vendorName}/portal/${vendorUuid}/backlinks-package`, icon: Package, match: '/backlinks-package' },
    ];

    const isActive = (match) => pathname.includes(match);

    useEffect(() => {
        const el = mainRef.current;
        if (!el) return;
        const onScroll = () => setShowScrollTop(el.scrollTop > 300);
        el.addEventListener('scroll', onScroll, { passive: true });
        return () => el.removeEventListener('scroll', onScroll);
    }, []);

    return (
        <div className="flex h-screen bg-gray-50 overflow-hidden">
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

                {/* Fixed nav zone */}
                <nav className="px-2 pt-4 pb-2 shrink-0 space-y-1">
                    {navItems.map((item) => {
                        const Icon = item.icon;
                        const active = isActive(item.match);
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
                </nav>

                <div className="flex-1" />

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
                        className={`w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-gray-500 hover:text-gray-700 hover:bg-gray-50 transition-colors ${collapsed ? 'mx-auto' : ''}`}
                        title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                    >
                        {collapsed ? <PanelLeftOpen className="w-5 h-5" /> : <><PanelLeftClose className="w-5 h-5" /><span>Collapse</span></>}
                    </button>
                </div>
            </aside>

            <main ref={mainRef} className="flex-1 min-w-0 overflow-y-auto">
                <Suspense fallback={null}>
                    <ActiveFiltersBar />
                </Suspense>
                {children}
                <StickyProjectTab />
                {showScrollTop && (
                    <button
                        onClick={() => mainRef.current?.scrollTo({ top: 0, behavior: 'smooth' })}
                        className="fixed bottom-6 right-6 z-50 w-11 h-11 rounded-full bg-indigo-600 text-white shadow-lg flex items-center justify-center hover:bg-indigo-700 active:scale-95 transition-all"
                        aria-label="Back to top"
                    >
                        <ArrowUp className="w-5 h-5" />
                    </button>
                )}
            </main>
        </div>
    );
}
