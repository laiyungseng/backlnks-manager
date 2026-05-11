'use client';

import { AlertTriangle, Clock, Sparkles, Hourglass, X } from 'lucide-react';

const CHIPS = [
    { key: 'overdue',       label: 'Overdue',       Icon: AlertTriangle, tone: 'red' },
    { key: 'due-today',     label: 'Due Today',     Icon: Clock,         tone: 'orange' },
    { key: 'new',           label: 'New',           Icon: Sparkles,      tone: 'indigo' },
    { key: 'pending-index', label: 'Pending Index', Icon: Hourglass,     tone: 'yellow' },
];

const TONE = {
    red:    'bg-red-50 text-red-700 border-red-200 hover:bg-red-100',
    orange: 'bg-orange-50 text-orange-700 border-orange-200 hover:bg-orange-100',
    indigo: 'bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100',
    yellow: 'bg-yellow-50 text-yellow-800 border-yellow-200 hover:bg-yellow-100',
};

const ACTIVE_TONE = {
    red:    'bg-red-600 text-white border-red-600 hover:bg-red-700',
    orange: 'bg-orange-500 text-white border-orange-500 hover:bg-orange-600',
    indigo: 'bg-indigo-600 text-white border-indigo-600 hover:bg-indigo-700',
    yellow: 'bg-yellow-500 text-white border-yellow-500 hover:bg-yellow-600',
};

const BADGE = {
    red:    'bg-red-600 text-white',
    orange: 'bg-orange-500 text-white',
    indigo: 'bg-indigo-600 text-white',
    yellow: 'bg-yellow-500 text-white',
};

const ACTIVE_BADGE = 'bg-white text-gray-900';

export default function TriageStrip({ counts, activeFilter, onSelect }) {
    const visibleChips = CHIPS.filter(c => (counts[c.key] || 0) > 0);

    if (visibleChips.length === 0) return null;

    return (
        <div className="mb-6 flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold text-gray-500 uppercase tracking-wider mr-1">Needs attention:</span>
            {visibleChips.map(({ key, label, Icon, tone }) => {
                const count = counts[key] || 0;
                const isActive = activeFilter === key;
                return (
                    <button
                        key={key}
                        type="button"
                        onClick={() => onSelect(key)}
                        className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-bold border transition-colors ${
                            isActive ? ACTIVE_TONE[tone] : TONE[tone]
                        }`}
                        aria-pressed={isActive}
                    >
                        <Icon className="w-4 h-4" />
                        <span>{label}</span>
                        <span className={`px-1.5 py-0.5 rounded-full text-[11px] font-black tabular-nums min-w-[22px] text-center ${
                            isActive ? ACTIVE_BADGE : BADGE[tone]
                        }`}>
                            {count}
                        </span>
                    </button>
                );
            })}
            {activeFilter && (
                <button
                    type="button"
                    onClick={() => onSelect(activeFilter)}
                    className="flex items-center gap-1 px-2.5 py-2 rounded-lg text-xs font-bold text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-colors"
                >
                    <X className="w-3.5 h-3.5" />
                    Clear
                </button>
            )}
        </div>
    );
}
