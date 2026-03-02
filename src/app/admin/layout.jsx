'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, PlusCircle, ClipboardList, CheckCircle2, Settings, LogOut, PanelLeftClose, PanelLeftOpen } from 'lucide-react';

export default function AdminLayout({ children }) {
    const pathname = usePathname();
    const [isCollapsed, setIsCollapsed] = useState(false);

    const navigation = [
        { name: 'Dashboard', href: '/admin', icon: LayoutDashboard },
        { name: 'Kickoff Project', href: '/admin/new-project', icon: PlusCircle },
        { name: 'Active Placements', href: '/admin/placements', icon: ClipboardList },
        { name: 'Completed Placements', href: '/admin/completed', icon: CheckCircle2 },
        { name: 'Settings', href: '/admin/settings', icon: Settings },
    ];

    return (
        <div className="min-h-screen bg-gray-50 flex">
            {/* Sidebar */}
            <div className={`${isCollapsed ? 'w-[68px]' : 'w-64'} bg-gray-900 shadow-xl flex-shrink-0 flex-col hidden md:flex transition-all duration-300 ease-in-out`}>
                {/* Header */}
                <div className="h-16 flex items-center px-4 border-b border-gray-800 justify-between">
                    {!isCollapsed && (
                        <h1 className="text-xl font-bold text-white tracking-wider flex items-center gap-2 whitespace-nowrap">
                            <span className="bg-indigo-500 w-8 h-8 rounded flex items-center justify-center text-sm flex-shrink-0">DF</span>
                            Drive-Future
                        </h1>
                    )}
                    <button
                        onClick={() => setIsCollapsed(!isCollapsed)}
                        className={`text-gray-400 hover:text-white transition-colors p-1.5 rounded-md hover:bg-gray-800 ${isCollapsed ? 'mx-auto' : ''}`}
                        title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                    >
                        {isCollapsed ? <PanelLeftOpen className="w-5 h-5" /> : <PanelLeftClose className="w-5 h-5" />}
                    </button>
                </div>

                {/* Navigation Links */}
                <div className="flex-1 px-2 py-6 space-y-1 overflow-y-auto">
                    {navigation.map((item) => {
                        const isActive = pathname === item.href;
                        const Icon = item.icon;
                        return (
                            <Link
                                key={item.name}
                                href={item.href}
                                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${isActive
                                    ? 'bg-indigo-600 text-white'
                                    : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                                    } ${isCollapsed ? 'justify-center' : ''}`}
                                title={isCollapsed ? item.name : ''}
                            >
                                <Icon className={`w-5 h-5 flex-shrink-0 ${isActive ? 'text-indigo-200' : 'text-gray-400'}`} />
                                {!isCollapsed && <span className="whitespace-nowrap">{item.name}</span>}
                            </Link>
                        );
                    })}
                </div>

                {/* Footer */}
                <div className="p-3 pb-4 border-t border-gray-800 shrink-0">
                    <button className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-400 hover:bg-gray-800 hover:text-white transition-colors w-full ${isCollapsed ? 'justify-center' : ''}`}
                        title={isCollapsed ? 'Sign Out' : ''}
                    >
                        <span className="bg-gray-700 w-7 h-7 rounded flex items-center justify-center text-[10px] font-bold text-gray-300 flex-shrink-0">DF</span>
                        {!isCollapsed && <span>Sign Out</span>}
                    </button>
                </div>
            </div>

            {/* Main Content Area */}
            <div className="flex-1 flex flex-col min-w-0">
                <header className="h-16 bg-white border-b border-gray-200 flex items-center px-8 shadow-sm justify-between md:hidden">
                    <h1 className="text-xl font-bold text-gray-900">Drive-Future</h1>
                    <button className="text-gray-500 hover:text-gray-700">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
                    </button>
                </header>

                <main className="flex-1 p-8 overflow-y-auto">
                    {children}
                </main>
            </div>
        </div>
    );
}
