import Link from 'next/link';
import { AlertTriangle, Clock, Sparkles, Hourglass, ExternalLink } from 'lucide-react';

const SECTIONS = [
    {
        key: 'overdue',
        title: 'Overdue',
        Icon: AlertTriangle,
        emptyHint: 'No overdue projects.',
        wrap: 'border-red-200 bg-red-50/40',
        head: 'text-red-700 hover:bg-red-100/40',
        dot: 'bg-red-500',
    },
    {
        key: 'due-today',
        title: 'Due Today',
        Icon: Clock,
        emptyHint: 'Nothing due today.',
        wrap: 'border-orange-200 bg-orange-50/40',
        head: 'text-orange-700 hover:bg-orange-100/40',
        dot: 'bg-orange-500',
    },
    {
        key: 'new',
        title: 'New Assignments',
        Icon: Sparkles,
        emptyHint: 'No new assignments in the last 14 days.',
        wrap: 'border-indigo-200 bg-indigo-50/40',
        head: 'text-indigo-700 hover:bg-indigo-100/40',
        dot: 'bg-indigo-500',
    },
    {
        key: 'pending-index',
        title: 'Pending Index Status',
        Icon: Hourglass,
        emptyHint: 'All completed projects are indexed.',
        wrap: 'border-yellow-200 bg-yellow-50/40',
        head: 'text-yellow-800 hover:bg-yellow-100/40',
        dot: 'bg-yellow-500',
    },
];

function ItemRow({ item, vendorName, vendorUuid, accent }) {
    const href = item.hash
        ? (vendorUuid
            ? `/vendor/${vendorName}/portal/${vendorUuid}/project/${item.hash}`
            : `/vendor/${vendorName}/${item.hash}`)
        : null;
    return (
        <li className="flex items-center gap-2 px-4 py-2 text-xs hover:bg-white/60 transition-colors">
            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${accent}`} />
            <span className="font-semibold text-gray-800 truncate min-w-0 flex-1">{item.label}</span>
            {item.category && (
                <span className="hidden sm:inline-block font-mono text-[10px] text-gray-500 bg-white border border-gray-200 px-1.5 py-0.5 rounded">
                    {item.category}
                </span>
            )}
            <span className="text-gray-500 tabular-nums shrink-0">{item.meta}</span>
            {href && (
                <Link
                    href={href}
                    className="flex items-center gap-1 px-2 py-1 text-[10px] font-bold rounded bg-white border border-gray-200 text-gray-700 hover:border-indigo-300 hover:text-indigo-600 shrink-0 transition-colors"
                >
                    <ExternalLink className="w-3 h-3" />
                    Open
                </Link>
            )}
        </li>
    );
}

export default function TodaysFocus({ overdue, dueToday, newAssignments, pendingIndex, vendorName, vendorUuid }) {
    const dataByKey = {
        overdue,
        'due-today': dueToday,
        new: newAssignments,
        'pending-index': pendingIndex,
    };

    const anyHasItems = SECTIONS.some(s => (dataByKey[s.key] || []).length > 0);
    if (!anyHasItems) return null;

    return (
        <section className="mb-8 space-y-2">
            {SECTIONS.map(section => {
                const items = dataByKey[section.key] || [];
                if (items.length === 0) return null;
                const { Icon } = section;
                return (
                    <details
                        key={section.key}
                        id={`focus-${section.key}`}
                        className={`rounded-lg border overflow-hidden ${section.wrap} scroll-mt-4`}
                        open
                    >
                        <summary className={`flex items-center gap-2 px-4 py-2.5 cursor-pointer select-none list-none text-sm font-bold ${section.head}`}>
                            <Icon className="w-4 h-4 shrink-0" />
                            <span>{section.title}</span>
                            <span className="px-1.5 py-0.5 rounded-full text-[10px] font-black tabular-nums bg-white/80 text-gray-700 border border-white">
                                {items.length}
                            </span>
                        </summary>
                        <ul className="divide-y divide-white/70 bg-white/30">
                            {items.slice(0, 5).map(item => (
                                <ItemRow key={item.id} item={item} vendorName={vendorName} vendorUuid={vendorUuid} accent={section.dot} />
                            ))}
                            {items.length > 5 && (
                                <li className="px-4 py-2 text-[11px] text-gray-500 italic bg-white/40">
                                    +{items.length - 5} more — see Campaign Queue below
                                </li>
                            )}
                        </ul>
                    </details>
                );
            })}
        </section>
    );
}
