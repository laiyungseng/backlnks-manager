'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { LayoutDashboard, PlusCircle, ClipboardList, CheckCircle2, Settings, PanelLeftClose, PanelLeftOpen, Blocks, Users, Globe } from 'lucide-react';
import { logoutAction } from '@/app/admin/settings/actions';

export default function AdminLayout({ children }) {
    const pathname = usePathname();
    const router = useRouter();
    const [isCollapsed, setIsCollapsed] = useState(false);

    const handleSignOut = async () => {
        localStorage.removeItem('df_admin_session');
        await logoutAction();
        router.push('/login');
    };

    const navigation = [
        { name: 'Dashboard', href: '/admin', icon: LayoutDashboard },
        { name: 'Kickoff Project', href: '/admin/new-project', icon: PlusCircle },
        { name: 'Active Placements', href: '/admin/placements', icon: ClipboardList },
        { name: 'Completed Placements', href: '/admin/completed', icon: CheckCircle2 },
        { name: 'Schema Builder', href: '/admin/schema-builder', icon: Blocks },
        { name: 'Vendor Manager', href: '/admin/vendor-manager', icon: Users },
        { name: 'Domains Manager', href: '/admin/domains-manager', icon: Globe },
        { name: 'Settings', href: '/admin/settings', icon: Settings },
    ];

    return (
        <div className="min-h-screen bg-slate-50 flex font-sans">
            {/* Sidebar */}
            <div className={`bg-slate-900 flex-shrink-0 flex-col hidden md:flex transition-all duration-300 ease-in-out sticky top-0 h-screen ${isCollapsed ? 'w-[68px]' : 'w-64'}`}>
                {/* Header */}
                <div className="h-16 flex items-center px-4 border-b border-slate-800 justify-between shrink-0">
                    <div className="flex items-center gap-2 overflow-hidden">
                        <span className="bg-indigo-600 w-8 h-8 rounded-md flex items-center justify-center text-sm flex-shrink-0 font-black text-white">DF</span>
                        {!isCollapsed && <h1 className="text-xl font-black text-white tracking-widest whitespace-nowrap uppercase">Drive-Future</h1>}
                    </div>
                    <button 
                        onClick={() => setIsCollapsed(!isCollapsed)}
                        className="text-slate-400 hover:text-white p-1 rounded-md hover:bg-slate-800 transition-colors shrink-0"
                    >
                        {isCollapsed ? <PanelLeftOpen className="w-5 h-5" /> : <PanelLeftClose className="w-5 h-5" />}
                    </button>
                </div>

                {/* Navigation Links */}
                <div className="flex-1 px-3 py-8 space-y-1 overflow-y-auto">
                    {navigation.map((item) => {
                        const isActive = pathname === item.href;
                        const Icon = item.icon;
                        return (
                            <Link
                                key={item.name}
                                href={item.href}
                                className={`flex items-center px-4 py-3 rounded-lg text-sm font-bold transition-all duration-200 ${
                                    isCollapsed ? 'justify-center' : 'gap-3'
                                } ${isActive
                                    ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20'
                                    : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                                    }`}
                                title={isCollapsed ? item.name : undefined}
                            >
                                <Icon className={`w-5 h-5 flex-shrink-0 ${isActive ? 'text-white' : 'text-slate-500'}`} />
                                {!isCollapsed && <span className="whitespace-nowrap">{item.name}</span>}
                            </Link>
                        );
                    })}
                </div>

                {/* Footer */}
                <div className="p-4 pb-6 border-t border-slate-800 shrink-0">
                    <button
                        onClick={handleSignOut}
                        title={isCollapsed ? "Sign Out" : undefined}
                        className={`flex items-center px-4 py-3 rounded-lg text-sm font-bold text-slate-400 hover:bg-slate-800 hover:text-white transition-all w-full ${
                            isCollapsed ? 'justify-center' : 'gap-3'
                        }`}
                    >
                        <span className="bg-slate-800 w-7 h-7 rounded-md flex items-center justify-center text-[10px] font-black text-slate-300 flex-shrink-0">DF</span>
                        {!isCollapsed && <span>Sign Out</span>}
                    </button>
                </div>
            </div>

            {/* Main Content Area */}
            <div className="flex-1 flex flex-col min-w-0">
                <header className="h-16 bg-white border-b border-slate-200 flex items-center px-8 shadow-sm justify-between md:hidden">
                    <h1 className="text-xl font-black text-slate-900 uppercase tracking-widest">Drive-Future</h1>
                    <button className="text-slate-500 hover:text-slate-700">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
                    </button>
                </header>

                <main className="flex-1 p-8 overflow-y-auto bg-slate-50">
                    {children}
                </main>
            </div>
        </div>
    );
}
