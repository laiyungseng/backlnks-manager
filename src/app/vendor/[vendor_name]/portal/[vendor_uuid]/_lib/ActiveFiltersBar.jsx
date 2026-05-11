'use client';

import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { Filter, X } from 'lucide-react';

const FILTER_LABELS = {
    q:       (v) => `Search: "${v}"`,
    dstatus: (v) => `Status: ${v}`,
    istatus: (v) => `Status: ${v}`,
    idate:   (v) => `Created: ${v}`,
    iname:   (v) => `Project: ${v}`,
    from:    (v) => `From: ${v}`,
    to:      (v) => `To: ${v}`,
};

const FILTER_KEYS = Object.keys(FILTER_LABELS);

export default function ActiveFiltersBar() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const pathname = usePathname();

    const active = FILTER_KEYS
        .map(key => ({ key, value: searchParams.get(key) }))
        .filter(({ value }) => value && value.trim());

    if (active.length === 0) return null;

    function removeOne(keyToRemove) {
        const next = new URLSearchParams(searchParams.toString());
        next.delete(keyToRemove);
        const qs = next.toString();
        router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    }

    function clearAll() {
        const next = new URLSearchParams(searchParams.toString());
        for (const key of FILTER_KEYS) next.delete(key);
        const qs = next.toString();
        router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    }

    return (
        <div className="border-b border-indigo-100 bg-indigo-50/60 px-6 py-2 flex items-center flex-wrap gap-2 text-xs">
            <Filter className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
            <span className="font-bold text-indigo-700 uppercase tracking-wider shrink-0">Filters:</span>
            {active.map(({ key, value }) => (
                <span
                    key={key}
                    className="flex items-center gap-1 px-2 py-0.5 bg-white text-indigo-700 border border-indigo-200 rounded font-semibold"
                >
                    {FILTER_LABELS[key](value)}
                    <button
                        type="button"
                        onClick={() => removeOne(key)}
                        className="ml-0.5 text-indigo-400 hover:text-indigo-700"
                        aria-label={`Remove ${key} filter`}
                    >
                        <X className="w-3 h-3" />
                    </button>
                </span>
            ))}
            <button
                type="button"
                onClick={clearAll}
                className="ml-auto px-2 py-0.5 text-indigo-600 hover:text-indigo-900 font-bold"
            >
                Clear all
            </button>
        </div>
    );
}
