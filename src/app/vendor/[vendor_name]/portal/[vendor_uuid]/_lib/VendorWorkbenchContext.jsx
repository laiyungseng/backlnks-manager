'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { usePathname } from 'next/navigation';
import VendorForm from '@/app/vendor/[vendor_name]/[hash]/VendorForm';
import { saveCampaignProgressBulk } from '@/app/vendor/[vendor_name]/[hash]/actions';

const VendorWorkbenchContext = createContext(null);

// ---------------------------------------------------------------------------
// Helpers — mirror minimal logic from VendorForm without importing it
// ---------------------------------------------------------------------------
function readCacheForHash(hash) {
    try {
        const raw = localStorage.getItem(`df_vendor_cache_${hash}`);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        if (!parsed?.rows || !Array.isArray(parsed.rows)) return null;
        return parsed; // { rows, version, timestamp }
    } catch {
        return null;
    }
}

function buildBulkDelta(rows) {
    return (rows || [])
        .filter(r => {
            if (typeof r.id === 'string' && r.id.startsWith('new-')) {
                return !!(r.target_url || r.anchor_text || r.published_url || r.domain_url || r.remark);
            }
            return true;
        })
        .map(r => ({
            id: r.id,
            target_id: r.target_id,
            target_url: r.target_url,
            anchor_text: r.anchor_text,
            language: r.language || '',
            domain_url: r.domain_url || '',
            published_url: r.published_url || '',
            published_date: r.published_date || '',
            remark: r.remark || '',
            indexed_status: r.indexed_status || '',
            indexed_datetime: r.indexed_datetime || '',
        }));
}

function countCompleted(rows) {
    return (rows || []).filter(r => r.published_url?.trim() && r.published_date?.trim()).length;
}

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------
export function VendorWorkbenchProvider({ children }) {
    const pathname = usePathname();
    const [activeProject, setActiveProjectState] = useState(null);
    const [hostElement, setHostElement] = useState(null);
    const [hiddenHostElement, setHiddenHostElement] = useState(null);
    const prevActiveProjectRef = useRef(null);

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

    // Flush sibling plans (not the active plan — VendorForm handles its own hash)
    const flushSiblingPlans = useCallback(async (project) => {
        if (!project?.campaignId) return;
        const siblingHashes = (project.siblingPlans || [])
            .map(p => p.hash)
            .filter(h => h && h !== project.projectHash);
        if (siblingHashes.length === 0) return;

        const dirtyPlans = [];
        for (const hash of siblingHashes) {
            const cache = readCacheForHash(hash);
            if (!cache?.rows?.length) continue;
            const delta = buildBulkDelta(cache.rows);
            if (!delta.length) continue;
            dirtyPlans.push({
                hash,
                delta,
                knownVersion: cache.version,
                cellTimestamps: null,
                completedCount: countCompleted(cache.rows),
            });
        }

        if (dirtyPlans.length === 0) return;

        try {
            const result = await saveCampaignProgressBulk(
                project.campaignId,
                project.vendorUuid,
                dirtyPlans
            );
            if (result?.results) {
                for (const r of result.results) {
                    if (r.success) {
                        try { localStorage.removeItem(`df_vendor_cache_${r.hash}`); } catch { /* noop */ }
                    }
                }
            }
        } catch (e) {
            console.error('[VendorWorkbenchContext] Bulk flush error:', e);
        }
    }, []);

    // Flush previous campaign's siblings on tab-switch
    useEffect(() => {
        const prev = prevActiveProjectRef.current;
        if (prev && prev.projectHash !== activeProject?.projectHash && prev.campaignId) {
            flushSiblingPlans(prev);
        }
        prevActiveProjectRef.current = activeProject;
    }, [activeProject, flushSiblingPlans]);

    // Periodic 5s flush for sibling plans while a campaign project is active
    useEffect(() => {
        if (!activeProject?.campaignId || !(activeProject?.siblingPlans?.length > 0)) return;
        const id = setInterval(() => { flushSiblingPlans(activeProject); }, 5000);
        return () => clearInterval(id);
    }, [activeProject, flushSiblingPlans]);

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
