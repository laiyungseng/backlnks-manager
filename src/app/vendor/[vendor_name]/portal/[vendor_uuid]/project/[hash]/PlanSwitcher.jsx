'use client';

import Link from 'next/link';
import { Star, CheckCircle2, Loader, Clock } from 'lucide-react';

const STATUS_META = {
    done:     { Icon: CheckCircle2, cls: 'bg-emerald-50 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500' },
    progress: { Icon: Loader,       cls: 'bg-indigo-50 text-indigo-700 border-indigo-200',    dot: 'bg-indigo-500' },
    pending:  { Icon: Clock,        cls: 'bg-gray-50 text-gray-600 border-gray-200',          dot: 'bg-gray-400' },
};

export default function PlanSwitcher({ plans, currentHash, vendorName, vendorUuid }) {
    if (!plans || plans.length <= 1) return null;
    const base = `/vendor/${vendorName}/portal/${vendorUuid}/project`;
    return (
        <div className="mb-4 bg-white rounded-xl border border-gray-200 px-4 py-3">
            <div className="flex items-center gap-2 mb-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Plans in this campaign</span>
                <span className="text-[10px] font-mono text-gray-400">{plans.length}</span>
            </div>
            <div className="flex flex-wrap gap-2">
                {plans.map(plan => {
                    const isCurrent = plan.hash === currentHash;
                    const meta = STATUS_META[plan.status] || STATUS_META.pending;
                    const { Icon } = meta;
                    return (
                        <Link
                            key={plan.hash}
                            href={`${base}/${plan.hash}`}
                            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors ${
                                isCurrent
                                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                                    : `${meta.cls} hover:border-indigo-300`
                            }`}
                            title={plan.category || plan.label}
                        >
                            <Icon className={`w-3.5 h-3.5 ${isCurrent ? '' : ''}`} />
                            <span>{plan.label}</span>
                            {plan.category && (
                                <span className={`text-[10px] font-mono uppercase ${isCurrent ? 'text-indigo-100' : 'text-gray-500'}`}>
                                    {plan.category}
                                </span>
                            )}
                            {plan.isPriority && <Star className={`w-3 h-3 ${isCurrent ? 'fill-white text-white' : 'fill-amber-400 text-amber-400'}`} />}
                            <span className={`tabular-nums font-mono text-[10px] ${isCurrent ? 'text-indigo-100' : 'text-gray-500'}`}>
                                {plan.completed}/{plan.total}
                            </span>
                        </Link>
                    );
                })}
            </div>
        </div>
    );
}
