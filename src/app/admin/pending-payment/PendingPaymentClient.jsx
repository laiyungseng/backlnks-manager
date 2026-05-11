'use client';

import { useState, useTransition } from 'react';
import { AlertCircle, ChevronDown, ChevronUp, Calendar } from 'lucide-react';
import { approvePaymentAction } from '@/app/admin/actions';

function formatDate(d) {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatPrice(price, priceType, qty) {
    const p = parseFloat(price) || 0;
    if (priceType === 'package') return `$${p.toFixed(2)}`;
    return `$${(p * qty).toFixed(2)} ($${p.toFixed(2)}/url)`;
}

function VendorCard({ vendorName, items }) {
    const [open, setOpen] = useState(true);
    const [projects, setProjects] = useState(items);
    const [isPending, startTransition] = useTransition();

    function handleApprove(projectId) {
        startTransition(async () => {
            const result = await approvePaymentAction(projectId);
            if (!result?.success) return;
            const approvedIds = new Set(result.approvedProjectIds?.length ? result.approvedProjectIds : [projectId]);
            setProjects(prev => prev.filter(p => !approvedIds.has(p.id)));
        });
    }

    if (projects.length === 0) return null;

    const currentTotal = projects.reduce((acc, p) => {
        if (p.price_type === 'package') return acc + (parseFloat(p.price) || 0);
        return acc + (parseFloat(p.price) || 0) * (p.total_quantity || 0);
    }, 0);

    return (
        <div className="bg-white rounded-xl ring-1 ring-gray-200 overflow-hidden">
            {/* Vendor header row */}
            <button
                onClick={() => setOpen(v => !v)}
                className="w-full flex items-center justify-between px-5 py-4 bg-gray-50 hover:bg-gray-100 transition-colors border-b border-gray-100"
            >
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
                        <span className="text-xs font-black text-amber-700">{vendorName.charAt(0).toUpperCase()}</span>
                    </div>
                    <div className="text-left">
                        <p className="font-bold text-gray-900 text-sm">{vendorName}</p>
                        <p className="text-xs text-gray-400">{projects.length} project{projects.length !== 1 ? 's' : ''} pending</p>
                    </div>
                </div>
                <div className="flex items-center gap-4">
                    <div className="text-right">
                        <p className="text-xs text-gray-400">Total Outstanding</p>
                        <p className="font-black text-amber-700 text-sm">${currentTotal.toFixed(2)}</p>
                    </div>
                    {open ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                </div>
            </button>

            {/* Project list */}
            {open && (
                <table className="w-full text-sm">
                    <thead>
                        <tr className="border-b border-gray-100">
                            <th className="text-left px-5 py-2.5 text-xs font-semibold text-gray-400 uppercase tracking-wide">Project</th>
                            <th className="text-left px-5 py-2.5 text-xs font-semibold text-gray-400 uppercase tracking-wide">Qty</th>
                            <th className="text-left px-5 py-2.5 text-xs font-semibold text-gray-400 uppercase tracking-wide">Price</th>
                            <th className="text-left px-5 py-2.5 text-xs font-semibold text-gray-400 uppercase tracking-wide">Date Range</th>
                            <th className="px-5 py-2.5" />
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                        {projects.map(p => {
                            const categories = [...new Set((p.project_targets || []).map(t => t.category).filter(Boolean))];
                            return (
                                <tr key={p.id} className="hover:bg-gray-50/50">
                                    <td className="px-5 py-3">
                                        <p className="font-semibold text-gray-900">{p.project_name || 'Unnamed'}</p>
                                        {categories.length > 0 && (
                                            <div className="flex flex-wrap gap-1 mt-1">
                                                {categories.map(cat => (
                                                    <span key={cat} className="px-1.5 py-0.5 text-[9px] font-black uppercase tracking-widest rounded bg-gray-100 text-gray-500">{cat}</span>
                                                ))}
                                            </div>
                                        )}
                                    </td>
                                    <td className="px-5 py-3 text-gray-700 font-semibold tabular-nums">{p.total_quantity || 0}</td>
                                    <td className="px-5 py-3 text-gray-700 tabular-nums text-xs">{formatPrice(p.price, p.price_type, p.total_quantity)}</td>
                                    <td className="px-5 py-3 text-gray-500 text-xs">
                                        <div className="flex items-center gap-1.5">
                                            <Calendar className="w-3 h-3 text-gray-400" />
                                            <span>{formatDate(p.start_date)}</span>
                                            <span className="text-gray-300">→</span>
                                            <span>{formatDate(p.deadline)}</span>
                                        </div>
                                    </td>
                                    <td className="px-5 py-3 text-right">
                                        <button
                                            onClick={() => handleApprove(p.id)}
                                            disabled={isPending}
                                            className="px-3 py-1.5 text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg hover:bg-emerald-100 transition-colors disabled:opacity-50"
                                        >
                                            Approve
                                        </button>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            )}
        </div>
    );
}

export default function PendingPaymentClient({ vendorGroups }) {
    const totalProjects = vendorGroups.reduce((acc, g) => acc + g.items.length, 0);
    const grandTotal = vendorGroups.reduce((acc, g) => acc + g.totalPrice, 0);

    return (
        <div>
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2">
                    <AlertCircle className="w-6 h-6 text-amber-500" />
                    <h1 className="text-2xl font-bold text-gray-900">Pending Payment</h1>
                    <span className="ml-1 px-2 py-0.5 text-xs font-bold rounded-full bg-amber-100 text-amber-700">{totalProjects}</span>
                </div>
                {grandTotal > 0 && (
                    <div className="text-right">
                        <p className="text-xs text-gray-400">Grand Total Outstanding</p>
                        <p className="text-xl font-black text-amber-700">${grandTotal.toFixed(2)}</p>
                    </div>
                )}
            </div>

            {vendorGroups.length === 0 ? (
                <div className="text-center py-20 bg-white rounded-xl border border-dashed border-gray-200">
                    <p className="text-gray-400 text-sm">No pending payments.</p>
                </div>
            ) : (
                <div className="space-y-4">
                    {vendorGroups.map(g => (
                        <VendorCard
                            key={g.vendorName}
                            vendorName={g.vendorName}
                            items={g.items}
                            totalPrice={g.totalPrice}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}
