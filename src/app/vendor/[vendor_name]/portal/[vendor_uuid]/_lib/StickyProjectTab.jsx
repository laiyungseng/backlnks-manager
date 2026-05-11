'use client';

import { useEffect, useSyncExternalStore } from 'react';
import { useRouter, useParams, usePathname } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';

const EMPTY_PROJECT = JSON.stringify({ hash: '', projectName: '', deadline: '' });
const LAST_PROJECT_EVENT = 'vendor:last-project-change';

function readStoredProject(vendorName) {
    if (!vendorName || typeof window === 'undefined') return EMPTY_PROJECT;

    return JSON.stringify({
        hash: localStorage.getItem(`lastProjectHash_${vendorName}`) || '',
        projectName: localStorage.getItem(`lastProjectName_${vendorName}`) || '',
        deadline: localStorage.getItem(`lastProjectDeadline_${vendorName}`) || '',
    });
}

export default function StickyProjectTab() {
    const router = useRouter();
    const params = useParams();
    const pathname = usePathname();
    const vendorName = params?.vendor_name || '';
    const vendorUuid = params?.vendor_uuid || '';
    const storedProjectSnapshot = useSyncExternalStore(
        (onStoreChange) => {
            window.addEventListener('storage', onStoreChange);
            window.addEventListener(LAST_PROJECT_EVENT, onStoreChange);

            return () => {
                window.removeEventListener('storage', onStoreChange);
                window.removeEventListener(LAST_PROJECT_EVENT, onStoreChange);
            };
        },
        () => readStoredProject(vendorName),
        () => EMPTY_PROJECT
    );
    const { hash, projectName, deadline } = JSON.parse(storedProjectSnapshot);

    const projectUrl = hash && vendorName && vendorUuid
        ? `/vendor/${vendorName}/portal/${vendorUuid}/project/${hash}`
        : '';

    useEffect(() => {
        if (!projectUrl) return;
        router.prefetch(projectUrl);
    }, [projectUrl, router]);

    if (!hash || !vendorUuid) return null;
    if (pathname?.includes(`/project/${hash}`)) return null;

    const deadlineLabel = deadline
        ? new Date(deadline).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
        : null;

    const displayName = projectName
        ? (projectName.length > 22 ? projectName.slice(0, 22) + '…' : projectName)
        : 'Current Project';

    const handleClick = () => {
        router.push(projectUrl);
    };

    return (
        <button
            onClick={handleClick}
            className="fixed right-0 top-1/2 -translate-y-1/2 z-50 flex flex-col items-center gap-2 py-5 px-3 bg-indigo-600 text-white rounded-l-xl shadow-xl hover:bg-indigo-700 hover:px-4 transition-all duration-200"
            title={`Open: ${projectName || 'Current Project'}`}
        >
            <ChevronLeft className="w-4 h-4 shrink-0" />
            <span
                className="text-[10px] font-bold tracking-wider uppercase"
                style={{ writingMode: 'vertical-rl', textOrientation: 'mixed' }}
            >
                {displayName}
            </span>
            {deadlineLabel && (
                <span
                    className="text-[10px] font-mono opacity-75"
                    style={{ writingMode: 'vertical-rl' }}
                >
                    {deadlineLabel}
                </span>
            )}
        </button>
    );
}
