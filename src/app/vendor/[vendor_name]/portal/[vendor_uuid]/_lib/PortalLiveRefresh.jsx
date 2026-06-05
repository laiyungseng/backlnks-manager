'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { CHANNEL_NAME } from '@/lib/portalBroadcast';

/**
 * Mounts once in the portal layout (invisible).
 * Listens on the df-portal BroadcastChannel for events scoped to this vendor.
 * On match → calls router.refresh() so the server component re-fetches data.
 * Debounced 400ms to coalesce rapid back-to-back saves.
 */
export default function PortalLiveRefresh({ vendorUuid, onRefresh }) {
    const router = useRouter();
    const debounceRef = useRef(null);
    const scope = `vendor:${vendorUuid}`;

    useEffect(() => {
        if (typeof BroadcastChannel === 'undefined') return;

        const ch = new BroadcastChannel(CHANNEL_NAME);

        ch.onmessage = (event) => {
            if (event.data?.scope !== scope) return;
            clearTimeout(debounceRef.current);
            debounceRef.current = setTimeout(() => {
                router.refresh();
                onRefresh?.(new Date());
            }, 400);
        };

        return () => {
            clearTimeout(debounceRef.current);
            ch.close();
        };
    }, [scope, router, onRefresh]);

    return null;
}
