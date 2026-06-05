'use client';

import { useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';
import { VendorWorkbenchHost } from '../../_lib/VendorWorkbenchContext';

const LAST_PROJECT_EVENT = 'vendor:last-project-change';

export default function ProjectPageHeader({ projectName, deadline, hash, children }) {
    const router = useRouter();
    const params = useParams();
    const vendorName = params?.vendor_name || '';

    useEffect(() => {
        if (!vendorName || !hash) return;
        try {
            localStorage.setItem(`lastProjectHash_${vendorName}`, hash);
            if (projectName) localStorage.setItem(`lastProjectName_${vendorName}`, projectName);
            else localStorage.removeItem(`lastProjectName_${vendorName}`);
            if (deadline) localStorage.setItem(`lastProjectDeadline_${vendorName}`, deadline);
            else localStorage.removeItem(`lastProjectDeadline_${vendorName}`);
            window.dispatchEvent(new Event(LAST_PROJECT_EVENT));
        } catch {}
    }, [vendorName, hash, projectName, deadline]);

    const deadlineLabel = deadline
        ? new Date(deadline).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
        : null;

    return (
        <div className="flex flex-col animate-in slide-in-from-right duration-300">
            <div className="shrink-0 flex items-center gap-3 px-4 py-3 bg-white border-b border-gray-200 shadow-sm sticky top-0 z-20">
                <button
                    onClick={() => router.back()}
                    className="flex items-center gap-1.5 text-xs font-bold text-gray-500 hover:text-indigo-600 transition-colors shrink-0"
                >
                    <ChevronLeft className="w-4 h-4" />
                    Back
                </button>
                <span className="text-sm font-semibold text-gray-700 truncate flex-1 min-w-0">
                    {projectName}
                </span>
                {deadlineLabel && (
                    <span className="shrink-0 px-3 py-1.5 bg-red-50 text-red-700 rounded border border-red-100 text-xs font-medium whitespace-nowrap">
                        Deadline: {deadlineLabel}
                    </span>
                )}
            </div>
            <div>
                <VendorWorkbenchHost />
                {children}
            </div>
        </div>
    );
}
