'use client';

import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { useEffect, useState, useCallback, useMemo } from 'react';

function writeParams(router, pathname, searchParams, patch) {
    const next = new URLSearchParams(searchParams.toString());
    for (const [k, v] of Object.entries(patch)) {
        if (v === null || v === undefined || v === '') {
            next.delete(k);
        } else {
            next.set(k, String(v));
        }
    }
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
}

export function useUrlParam(key) {
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const value = searchParams.get(key) || '';

    const setValue = useCallback((next) => {
        writeParams(router, pathname, searchParams, { [key]: next });
    }, [router, pathname, searchParams, key]);

    return [value, setValue];
}

// Debounced text input — local immediate state, URL writes after `delay` ms idle
export function useDebouncedUrlParam(key, delay = 300) {
    const [urlValue, setUrlValue] = useUrlParam(key);
    const [draft, setDraft] = useState(urlValue);

    // Reset draft when URL changes externally (back/forward, Clear All)
    useEffect(() => {
        setDraft(urlValue);
    }, [urlValue]);

    useEffect(() => {
        if (draft === urlValue) return;
        const t = setTimeout(() => setUrlValue(draft || null), delay);
        return () => clearTimeout(t);
    }, [draft, delay, urlValue, setUrlValue]);

    return [draft, setDraft];
}

export function useMultipleUrlParams(keys) {
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();

    const values = useMemo(() => {
        const out = {};
        for (const k of keys) out[k] = searchParams.get(k) || '';
        return out;
    }, [searchParams, keys]);

    const setValues = useCallback((patch) => {
        writeParams(router, pathname, searchParams, patch);
    }, [router, pathname, searchParams]);

    return [values, setValues];
}
