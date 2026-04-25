'use client';

import { useState, useEffect, useRef } from 'react';
import { usePathname, useParams } from 'next/navigation';
import Link from 'next/link';
import { LayoutDashboard, Loader, CheckCircle2, LogOut, PanelLeftClose, PanelLeftOpen, ArrowUp, User, AlertCircle } from 'lucide-react';
import { clientLogoutAction } from '@/app/client/actions';

export default function ClientPortalLayout({ children }) {
    const [collapsed, setCollapsed] = useState(false);
    const [showScrollTop, setShowScrollTop] = useState(false);
    const mainRef = useRef(null);
    const pathname = usePathname();
    const params = useParams();

    const clientName = params?.client_name || 'client';
    const clientUuid = params?.client_uuid || '';
    const displayName = clientName.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

    const navItems = [
        { label: 'Dashboard',   href: `/client/${clientName}/portal/${clientUuid}/dashboard`,    icon: LayoutDashboard, match: '/dashboard',    activeStyle: 'bg-emerald-50 text-emerald-700 border border-emerald-100' },
        { label: 'Outstanding', href: `/client/${clientName}/portal/${clientUuid}/outstanding`,   icon: AlertCircle,     match: '/outstanding',   activeStyle: 'bg-amber-50 text-amber-700 border border-amber-100' },
        { label: 'In Progress', href: `/client/${clientName}/portal/${clientUuid}/inprogress`,    icon: Loader,          match: '/inprogress',    activeStyle: 'bg-emerald-50 text-emerald-700 border border-emerald-100' },
        { label: 'Completed',   href: `/client/${clientName}/portal/${clientUuid}/completed`,     icon: CheckCircle2,    match: '/completed',     activeStyle: 'bg-emerald-50 text-emerald-700 border border-emerald-100' },
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
                <div className="h-16 px-4 flex items-center gap-2 border-b border-gray-100 shrink-0">
                    <div className="bg-emerald-600 w-8 h-8 rounded flex items-center justify-center text-sm font-bold text-white shadow shrink-0">
                        <User className="w-4 h-4" />
                    </div>
                    {!collapsed && (
                        <div className="overflow-hidden">
                            <span className="text-sm font-bold text-gray-900 block truncate">{displayName}</span>
                            <span className="text-[10px] text-gray-400 uppercase tracking-wider">Client Portal</span>
                        </div>
                    )}
                </div>

                <nav className="flex-1 px-2 py-4 space-y-1">
                    {navItems.map((item) => {
                        const Icon = item.icon;
                        const active = isActive(item.match);
                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${collapsed ? 'justify-center' : ''} ${active
                                    ? item.activeStyle
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
                    <form action={clientLogoutAction}>
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

            <main ref={mainRef} className="flex-1 min-w-0 overflow-y-auto">
                {children}
                {showScrollTop && (
                    <button
                        onClick={() => mainRef.current?.scrollTo({ top: 0, behavior: 'smooth' })}
                        className="fixed bottom-6 right-6 z-50 w-11 h-11 rounded-full bg-emerald-600 text-white shadow-lg flex items-center justify-center hover:bg-emerald-700 active:scale-95 transition-all"
                        aria-label="Back to top"
                    >
                        <ArrowUp className="w-5 h-5" />
                    </button>
                )}
            </main>
        </div>
    );
}
