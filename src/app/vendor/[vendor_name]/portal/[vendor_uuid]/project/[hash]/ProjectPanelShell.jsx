'use client';

import { useState } from 'react';
import { ChevronLeft } from 'lucide-react';

export default function ProjectPanelShell({ projectName, deadline, children }) {
    const [isExpanded, setIsExpanded] = useState(false);

    const deadlineLabel = deadline
        ? new Date(deadline).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
        : null;

    const displayName = projectName
        ? (projectName.length > 22 ? projectName.slice(0, 22) + '…' : projectName)
        : 'Project';

    return (
        <>
            {/* Collapsed tab — anchored to right edge, slides away when panel opens */}
            <button
                onClick={() => setIsExpanded(true)}
                className={`fixed right-0 top-1/2 -translate-y-1/2 z-50 flex flex-col items-center gap-2 py-5 px-3 bg-indigo-600 text-white rounded-l-xl shadow-xl hover:bg-indigo-700 transition-all duration-200 ${
                    isExpanded ? 'opacity-0 pointer-events-none' : 'opacity-100'
                }`}
                title={`Open: ${projectName}`}
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

            {/* Backdrop — click to close */}
            <div
                className={`fixed inset-0 z-40 bg-black/20 transition-opacity duration-300 ${
                    isExpanded ? 'opacity-100' : 'opacity-0 pointer-events-none'
                }`}
                onClick={() => setIsExpanded(false)}
            />

            {/* Slide-in panel */}
            <div
                className={`fixed inset-y-0 right-0 z-50 w-[calc(100vw-4rem)] bg-gray-50 flex flex-col shadow-2xl transition-transform duration-300 ease-in-out ${
                    isExpanded ? 'translate-x-0' : 'translate-x-full'
                }`}
            >
                {/* Panel top bar */}
                <div className="shrink-0 flex items-center gap-3 px-4 py-3 bg-white border-b border-gray-200 shadow-sm">
                    <button
                        onClick={() => setIsExpanded(false)}
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

                {/* Scrollable content */}
                <div className="flex-1 overflow-y-auto">
                    {children}
                </div>
            </div>
        </>
    );
}
