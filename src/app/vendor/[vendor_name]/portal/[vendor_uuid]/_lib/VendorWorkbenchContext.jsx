'use client';

import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { usePathname } from 'next/navigation';
import VendorForm from '@/app/vendor/[vendor_name]/[hash]/VendorForm';

const VendorWorkbenchContext = createContext(null);

export function VendorWorkbenchProvider({ children }) {
    const pathname = usePathname();
    const [activeProject, setActiveProjectState] = useState(null);
    const [hostElement, setHostElement] = useState(null);
    const [hiddenHostElement, setHiddenHostElement] = useState(null);

    const setActiveProject = useCallback((project) => {
        if (!project?.projectHash) return;
        setActiveProjectState(prev => {
            if (
                prev?.projectHash === project.projectHash
                && prev?.initialVersion === project.initialVersion
                && prev?.isLocked === project.isLocked
                && prev?.urlEntryEnabled === project.urlEntryEnabled
            ) {
                return prev;
            }
            return project;
        });
    }, []);

    const registerHost = useCallback((node) => {
        setHostElement(prev => (prev === node ? prev : node));
    }, []);

    const registerHiddenHost = useCallback((node) => {
        setHiddenHostElement(prev => (prev === node ? prev : node));
    }, []);

    const value = useMemo(() => ({ setActiveProject, registerHost }), [setActiveProject, registerHost]);
    const isProjectRoute = pathname?.includes('/project/');
    const routeHash = isProjectRoute ? pathname?.split('/project/')[1]?.split('/')[0] : null;
    const isActiveRouteReady = !!activeProject && (!routeHash || activeProject.projectHash === routeHash);
    const portalTarget = isProjectRoute && hostElement && isActiveRouteReady ? hostElement : hiddenHostElement;

    return (
        <VendorWorkbenchContext.Provider value={value}>
            {children}
            {isProjectRoute && hostElement && !isActiveRouteReady && (
                <SheetLoadingPortal target={hostElement} />
            )}
            <div
                ref={registerHiddenHost}
                className="fixed -left-[10000px] top-0 h-[720px] w-[1200px] overflow-hidden opacity-0 pointer-events-none"
                aria-hidden="true"
            />
            {activeProject && portalTarget && createPortal(
                <div className="max-w-none px-4 sm:px-6 lg:px-8 py-6 pb-12">
                    <VendorForm {...activeProject} />
                </div>,
                portalTarget
            )}
        </VendorWorkbenchContext.Provider>
    );
}

function SheetLoadingPortal({ target }) {
    return createPortal(
        <div className="max-w-none px-4 sm:px-6 lg:px-8 py-6 pb-12">
            <div className="h-[720px] rounded-xl border border-indigo-100 bg-white shadow-sm overflow-hidden">
                <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
                    <div>
                        <div className="h-3 w-28 rounded bg-indigo-100 animate-pulse" />
                        <div className="mt-2 h-5 w-52 rounded bg-gray-100 animate-pulse" />
                    </div>
                    <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-indigo-600">
                        <span className="h-2 w-2 rounded-full bg-indigo-500 animate-ping" />
                        Loading sheet
                    </div>
                </div>
                <div className="grid grid-cols-9 border-b border-gray-100 bg-gray-50 px-4 py-3 gap-3">
                    {Array.from({ length: 9 }).map((_, i) => (
                        <div key={i} className="h-3 rounded bg-gray-200 animate-pulse" />
                    ))}
                </div>
                <div className="space-y-3 p-4">
                    {Array.from({ length: 12 }).map((_, row) => (
                        <div key={row} className="grid grid-cols-9 gap-3">
                            {Array.from({ length: 9 }).map((_, col) => (
                                <div
                                    key={col}
                                    className={`h-8 rounded border border-gray-100 animate-pulse ${col < 3 ? 'bg-indigo-50' : 'bg-gray-50'}`}
                                />
                            ))}
                        </div>
                    ))}
                </div>
            </div>
        </div>,
        target
    );
}

export function VendorWorkbenchHost() {
    const { registerHost } = useVendorWorkbench();

    return (
        <div
            ref={registerHost}
            className="min-h-[760px]"
        />
    );
}

export function useVendorWorkbench() {
    const context = useContext(VendorWorkbenchContext);
    if (!context) {
        throw new Error('useVendorWorkbench must be used inside VendorWorkbenchProvider');
    }
    return context;
}
