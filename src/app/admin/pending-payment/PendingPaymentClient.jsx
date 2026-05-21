'use client';

import { useState, useTransition } from 'react';
import { AlertCircle, ChevronDown, ChevronUp, Calendar, Package, RotateCcw } from 'lucide-react';
import { approvePaymentAction } from '@/app/admin/actions';
import { approvePackagePaymentAction, revertPackagePaymentAction } from '@/app/admin/catalog/backlink-packages/actions';
import { broadcastPortalUpdate } from '@/lib/portalBroadcast';

function formatDate(d) {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function PriceCell({ project }) {
    const targets = Array.isArray(project.project_targets) ? project.project_targets : [];
    const hasTargetPrices = targets.length > 0 && targets.some(t => parseFloat(t.price) > 0);

    if (hasTargetPrices) {
        const groups = targets.reduce((acc, t) => {
            const label = t.sheet_name || (t.category && t.category !== 'NULL' ? t.category : 'Uncategorized');
            if (!acc[label]) acc[label] = { cost: 0, price: parseFloat(t.price) || 0 };
            acc[label].cost += (parseFloat(t.price) || 0) * (parseInt(t.quantity_requested) || 0);
            return acc;
        }, {});
        const total = Object.values(groups).reduce((s, g) => s + g.cost, 0);
        return (
            <div className="flex flex-col gap-0.5">
                <span className="font-black text-gray-800 tabular-nums">${total.toFixed(2)}</span>
                {Object.entries(groups).map(([label, g]) => (
                    <span key={label} className="text-[10px] text-gray-500 tabular-nums">
                        {label}: ${g.cost.toFixed(2)} (${g.price.toFixed(2)}/url)
                    </span>
                ))}
            </div>
        );
    }

    const p = parseFloat(project.price) || 0;
    if (project.price_type === 'package') return <span className="tabular-nums">${p.toFixed(2)}</span>;
    return <span className="tabular-nums">${(p * (project.total_quantity || 0)).toFixed(2)} (${p.toFixed(2)}/url)</span>;
}

// ── Project vendor card ──────────────────────────────────────────────────────

function ProjectVendorCard({ vendorName, items }) {
    const [open, setOpen] = useState(true);
    const [projects, setProjects] = useState(items);
    const [isPending, startTransition] = useTransition();

    function handleApprove(projectId) {
        startTransition(async () => {
            const result = await approvePaymentAction(projectId);
            if (!result?.success) return;
            const approvedIds = new Set(result.approvedProjectIds?.length ? result.approvedProjectIds : [projectId]);
            setProjects(prev => {
                const vendorId = prev.find(p => approvedIds.has(p.id))?.vendor_id;
                if (vendorId) broadcastPortalUpdate(vendorId);
                return prev.filter(p => !approvedIds.has(p.id));
            });
        });
    }

    if (projects.length === 0) return null;

    const currentTotal = projects.reduce((acc, p) => acc + (p._computedCost ?? 0), 0);

    return (
        <div className="bg-white rounded-xl ring-1 ring-gray-200 overflow-hidden">
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
                                    <td className="px-5 py-3 text-gray-700 text-xs"><PriceCell project={p} /></td>
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

// ── Package vendor card ──────────────────────────────────────────────────────

function PackageVendorCard({ vendorName, items }) {
    const [open, setOpen] = useState(true);
    const [packages, setPackages] = useState(items);
    const [recentlyApproved, setRecentlyApproved] = useState([]);
    const [isPending, startTransition] = useTransition();

    function handleApprove(pkg) {
        startTransition(async () => {
            const result = await approvePackagePaymentAction(pkg.id);
            if (!result?.success) return;
            setPackages(prev => prev.filter(p => p.id !== pkg.id));
            setRecentlyApproved(prev => [...prev, { ...pkg, _approvedAt: new Date() }]);
        });
    }

    function handleUndo(pkg) {
        startTransition(async () => {
            const result = await revertPackagePaymentAction(pkg.id);
            if (!result?.success) return;
            setRecentlyApproved(prev => prev.filter(p => p.id !== pkg.id));
            setPackages(prev => [...prev, pkg]);
        });
    }

    if (packages.length === 0 && recentlyApproved.length === 0) return null;

    const currentTotal = packages.reduce((acc, p) => acc + (parseFloat(p.total_price) || 0), 0);

    return (
        <div className="bg-white rounded-xl ring-1 ring-indigo-100 overflow-hidden">
            <button
                onClick={() => setOpen(v => !v)}
                className="w-full flex items-center justify-between px-5 py-4 bg-indigo-50/60 hover:bg-indigo-50 transition-colors border-b border-indigo-100"
            >
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center shrink-0">
                        <Package className="w-4 h-4 text-indigo-600" />
                    </div>
                    <div className="text-left">
                        <p className="font-bold text-gray-900 text-sm">{vendorName}</p>
                        <p className="text-xs text-gray-400">{packages.length} package{packages.length !== 1 ? 's' : ''} pending</p>
                    </div>
                </div>
                <div className="flex items-center gap-4">
                    <div className="text-right">
                        <p className="text-xs text-gray-400">Total Outstanding</p>
                        <p className="font-black text-indigo-700 text-sm">${currentTotal.toFixed(2)}</p>
                    </div>
                    {open ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                </div>
            </button>

            {open && (
                <table className="w-full text-sm">
                    <thead>
                        <tr className="border-b border-gray-100">
                            <th className="text-left px-5 py-2.5 text-xs font-semibold text-gray-400 uppercase tracking-wide">Code</th>
                            <th className="text-left px-5 py-2.5 text-xs font-semibold text-gray-400 uppercase tracking-wide">Category</th>
                            <th className="text-left px-5 py-2.5 text-xs font-semibold text-gray-400 uppercase tracking-wide">Qty</th>
                            <th className="text-left px-5 py-2.5 text-xs font-semibold text-gray-400 uppercase tracking-wide">Price</th>
                            <th className="text-left px-5 py-2.5 text-xs font-semibold text-gray-400 uppercase tracking-wide">Purchased</th>
                            <th className="px-5 py-2.5" />
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                        {packages.map(pkg => {
                            const pricePerUrl = pkg.total_quantity > 0 && pkg.total_price > 0
                                ? (parseFloat(pkg.total_price) / pkg.total_quantity).toFixed(4)
                                : null;
                            return (
                                <tr key={pkg.id} className="hover:bg-gray-50/50">
                                    <td className="px-5 py-3">
                                        <span className="font-black text-indigo-700 font-mono text-xs">{pkg.code}</span>
                                    </td>
                                    <td className="px-5 py-3">
                                        <span className="px-1.5 py-0.5 text-[9px] font-black uppercase tracking-widest rounded bg-indigo-50 text-indigo-600 border border-indigo-100">{pkg.category}</span>
                                    </td>
                                    <td className="px-5 py-3 text-gray-700 font-semibold tabular-nums">{pkg.total_quantity}</td>
                                    <td className="px-5 py-3 text-gray-700 text-xs">
                                        <div className="flex flex-col gap-0.5">
                                            <span className="font-black text-gray-800 tabular-nums">${parseFloat(pkg.total_price || 0).toFixed(2)}</span>
                                            {pricePerUrl && <span className="text-[10px] text-gray-400">${pricePerUrl}/url</span>}
                                        </div>
                                    </td>
                                    <td className="px-5 py-3 text-gray-500 text-xs">
                                        <div className="flex items-center gap-1.5">
                                            <Calendar className="w-3 h-3 text-gray-400" />
                                            <span>{formatDate(pkg.purchased_at)}</span>
                                        </div>
                                    </td>
                                    <td className="px-5 py-3 text-right">
                                        <button
                                            onClick={() => handleApprove(pkg)}
                                            disabled={isPending}
                                            className="px-3 py-1.5 text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg hover:bg-emerald-100 transition-colors disabled:opacity-50"
                                        >
                                            Approve
                                        </button>
                                    </td>
                                </tr>
                            );
                        })}

                        {/* Recently approved sub-section */}
                        {recentlyApproved.map(pkg => (
                            <tr key={`approved-${pkg.id}`} className="bg-emerald-50/40">
                                <td className="px-5 py-3">
                                    <span className="font-black text-emerald-700 font-mono text-xs">{pkg.code}</span>
                                </td>
                                <td className="px-5 py-3">
                                    <span className="px-1.5 py-0.5 text-[9px] font-black uppercase tracking-widest rounded bg-emerald-50 text-emerald-600 border border-emerald-100">{pkg.category}</span>
                                </td>
                                <td className="px-5 py-3 text-gray-500 tabular-nums">{pkg.total_quantity}</td>
                                <td className="px-5 py-3 text-emerald-700 text-xs font-black tabular-nums">
                                    ${parseFloat(pkg.total_price || 0).toFixed(2)}
                                </td>
                                <td className="px-5 py-3 text-xs text-emerald-600 font-semibold">
                                    ✓ Approved
                                </td>
                                <td className="px-5 py-3 text-right">
                                    <button
                                        onClick={() => handleUndo(pkg)}
                                        disabled={isPending}
                                        className="flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-gray-500 bg-gray-50 border border-gray-200 rounded-lg hover:bg-gray-100 transition-colors disabled:opacity-50"
                                    >
                                        <RotateCcw className="w-3 h-3" />
                                        Undo
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            )}
        </div>
    );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function PendingPaymentClient({ vendorGroups, packageGroups }) {
    const totalProjects = vendorGroups.reduce((acc, g) => acc + g.items.length, 0);
    const totalPackages = packageGroups.reduce((acc, g) => acc + g.items.length, 0);
    const grandTotal = [
        ...vendorGroups.map(g => g.totalPrice),
        ...packageGroups.map(g => g.totalPrice),
    ].reduce((a, b) => a + b, 0);

    return (
        <div>
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2">
                    <AlertCircle className="w-6 h-6 text-amber-500" />
                    <h1 className="text-2xl font-bold text-gray-900">Pending Payment</h1>
                    <span className="ml-1 px-2 py-0.5 text-xs font-bold rounded-full bg-amber-100 text-amber-700">{totalProjects + totalPackages}</span>
                </div>
                {grandTotal > 0 && (
                    <div className="text-right">
                        <p className="text-xs text-gray-400">Grand Total Outstanding</p>
                        <p className="text-xl font-black text-amber-700">${grandTotal.toFixed(2)}</p>
                    </div>
                )}
            </div>

            {totalProjects === 0 && totalPackages === 0 ? (
                <div className="text-center py-20 bg-white rounded-xl border border-dashed border-gray-200">
                    <p className="text-gray-400 text-sm">No pending payments.</p>
                </div>
            ) : (
                <div className="space-y-8">
                    {/* Projects section */}
                    {vendorGroups.length > 0 && (
                        <div>
                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-3">
                                Projects — {totalProjects} pending
                            </p>
                            <div className="space-y-4">
                                {vendorGroups.map(g => (
                                    <ProjectVendorCard key={g.vendorName} vendorName={g.vendorName} items={g.items} />
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Packages section */}
                    {packageGroups.length > 0 && (
                        <div>
                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-3">
                                Packages — {totalPackages} pending
                            </p>
                            <div className="space-y-4">
                                {packageGroups.map(g => (
                                    <PackageVendorCard key={g.vendorName} vendorName={g.vendorName} items={g.items} />
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
