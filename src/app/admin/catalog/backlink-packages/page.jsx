'use client';

import { useState, useEffect, useTransition } from 'react';
import { Package, Plus, Trash2, ChevronDown, ChevronRight, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';
import { getPackagesAction, createPackageAction, deletePackageAction } from './actions';
import { getCategories } from '../categories/actions';

// ── helpers ────────────────────────────────────────────────────────────────

function deriveAbbr(category) {
    if (!category) return '';
    const words = category.trim().split(/\s+/);
    if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase();
    return category.slice(0, 2).toUpperCase();
}

function fmtDate(iso) {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function StatusBadge({ status }) {
    return status === 'Exhausted'
        ? <span className="px-2 py-0.5 text-[9px] font-black uppercase tracking-widest rounded bg-slate-100 text-slate-500">Exhausted</span>
        : <span className="px-2 py-0.5 text-[9px] font-black uppercase tracking-widest rounded bg-emerald-100 text-emerald-700">Active</span>;
}

// ── Add Package Form ────────────────────────────────────────────────────────

function AddPackageForm({ categories, onCreated }) {
    const [isPending, startTransition] = useTransition();
    const [msg, setMsg] = useState(null);
    const [catAbbr, setCatAbbr] = useState('');
    const [codePreview, setCodePreview] = useState('BK-??-001');
    const [selectedCategory, setSelectedCategory] = useState('');

    function handleCategoryChange(e) {
        const cat = e.target.value;
        setSelectedCategory(cat);
        const abbr = deriveAbbr(cat);
        setCatAbbr(abbr);
        updatePreview(abbr);
    }

    function handleAbbrChange(e) {
        const abbr = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4);
        setCatAbbr(abbr);
        updatePreview(abbr);
    }

    function updatePreview(abbr) {
        setCodePreview(abbr ? `BK-${abbr}-###` : 'BK-??-###');
    }

    function handleSubmit(e) {
        e.preventDefault();
        const fd = new FormData(e.target);
        fd.set('cat_abbr', catAbbr);
        setMsg(null);
        startTransition(async () => {
            const result = await createPackageAction(fd);
            setMsg(result);
            if (result.success) {
                e.target.reset();
                setSelectedCategory('');
                setCatAbbr('');
                setCodePreview('BK-??-###');
                onCreated();
            }
        });
    }

    return (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 mb-8">
            <div className="flex items-center gap-3 mb-5">
                <div className="w-9 h-9 bg-indigo-50 rounded-xl flex items-center justify-center border border-indigo-100">
                    <Plus className="w-4 h-4 text-indigo-600" />
                </div>
                <div>
                    <h2 className="text-sm font-black text-slate-900 uppercase tracking-widest">Add Package</h2>
                    <p className="text-[10px] text-slate-400 font-medium mt-0.5">Record a newly purchased backlink package</p>
                </div>
                {codePreview !== 'BK-??-###' && (
                    <span className="ml-auto px-3 py-1 rounded-lg bg-indigo-50 border border-indigo-100 text-xs font-black text-indigo-600 tracking-widest">
                        Code preview: {codePreview}
                    </span>
                )}
            </div>

            <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {/* Vendor */}
                <div className="flex flex-col gap-1">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Vendor Name <span className="text-red-400">*</span></label>
                    <input
                        name="vendor_name"
                        required
                        placeholder="e.g. IBETSEO"
                        className="px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-400 placeholder-slate-300"
                    />
                </div>

                {/* Category */}
                <div className="flex flex-col gap-1">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Category <span className="text-red-400">*</span></label>
                    <select
                        name="category"
                        required
                        value={selectedCategory}
                        onChange={handleCategoryChange}
                        className="px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white"
                    >
                        <option value="">Select category…</option>
                        {categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                    </select>
                </div>

                {/* Abbreviation */}
                <div className="flex flex-col gap-1">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Abbreviation <span className="text-red-400">*</span></label>
                    <input
                        name="cat_abbr"
                        required
                        maxLength={4}
                        placeholder="e.g. FR"
                        value={catAbbr}
                        onChange={handleAbbrChange}
                        className="px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-800 font-mono uppercase focus:outline-none focus:ring-2 focus:ring-indigo-400 placeholder-slate-300"
                    />
                    <p className="text-[9px] text-slate-400">Auto-derived from category, editable</p>
                </div>

                {/* Total Quantity */}
                <div className="flex flex-col gap-1">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Total Quantity <span className="text-red-400">*</span></label>
                    <input
                        name="total_quantity"
                        type="number"
                        min={1}
                        required
                        placeholder="e.g. 100"
                        className="px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-400 placeholder-slate-300"
                    />
                </div>

                {/* Purchased At */}
                <div className="flex flex-col gap-1">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Purchased At <span className="text-red-400">*</span></label>
                    <input
                        name="purchased_at"
                        type="date"
                        required
                        defaultValue={new Date().toISOString().substring(0, 10)}
                        className="px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                    />
                </div>

                {/* Notes */}
                <div className="flex flex-col gap-1">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Notes</label>
                    <input
                        name="notes"
                        placeholder="Optional notes…"
                        className="px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-400 placeholder-slate-300"
                    />
                </div>

                {/* Submit */}
                <div className="lg:col-span-3 flex items-center gap-4 pt-2">
                    <button
                        type="submit"
                        disabled={isPending}
                        className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white text-sm font-bold rounded-xl transition-colors"
                    >
                        {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                        {isPending ? 'Creating…' : 'Create Package'}
                    </button>
                    {msg && (
                        <div className={`flex items-center gap-2 text-sm font-semibold ${msg.success ? 'text-emerald-600' : 'text-red-500'}`}>
                            {msg.success ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                            {msg.message}
                        </div>
                    )}
                </div>
            </form>
        </div>
    );
}

// ── Package Row ─────────────────────────────────────────────────────────────

function PackageRow({ pkg, onDeleted }) {
    const [expanded, setExpanded] = useState(false);
    const [isPending, startTransition] = useTransition();
    const [deleteMsg, setDeleteMsg] = useState(null);

    const remainPct = pkg.total_quantity > 0 ? Math.round((pkg.remaining_quantity / pkg.total_quantity) * 100) : 0;

    function handleDelete() {
        if (!confirm(`Delete package ${pkg.code}? This cannot be undone.`)) return;
        startTransition(async () => {
            const result = await deletePackageAction(pkg.id);
            if (result.success) onDeleted();
            else setDeleteMsg(result.message);
        });
    }

    return (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="grid grid-cols-12 items-center px-5 py-4 gap-3">
                {/* Code */}
                <div className="col-span-2">
                    <span className="text-xs font-black text-indigo-700 tracking-widest font-mono">{pkg.code}</span>
                    <p className="text-[9px] text-slate-400 mt-0.5">{pkg.category}</p>
                </div>

                {/* Vendor */}
                <div className="col-span-2">
                    <span className="text-xs font-bold text-slate-800 uppercase">{pkg.vendor_name}</span>
                </div>

                {/* Quantity bars */}
                <div className="col-span-3">
                    <div className="flex items-center gap-2 mb-1">
                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest w-12">Total</span>
                        <span className="text-xs font-bold text-slate-700">{pkg.total_quantity}</span>
                    </div>
                    <div className="flex items-center gap-2 mb-1">
                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest w-12">Used</span>
                        <span className="text-xs font-semibold text-slate-600">{pkg.used_quantity}</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest w-12">Free</span>
                        <span className={`text-xs font-bold ${pkg.remaining_quantity <= 0 ? 'text-red-500' : 'text-emerald-600'}`}>
                            {pkg.remaining_quantity}
                        </span>
                        <span className="text-[9px] text-slate-400">({remainPct}%)</span>
                    </div>
                    {/* Progress bar */}
                    <div className="mt-1.5 h-1.5 bg-slate-100 rounded-full overflow-hidden w-full">
                        <div
                            className={`h-full rounded-full transition-all ${remainPct <= 10 ? 'bg-red-400' : remainPct <= 40 ? 'bg-amber-400' : 'bg-emerald-400'}`}
                            style={{ width: `${remainPct}%` }}
                        />
                    </div>
                </div>

                {/* Projects count */}
                <div className="col-span-2 flex items-center gap-2">
                    <button
                        onClick={() => setExpanded(v => !v)}
                        className="flex items-center gap-1.5 text-xs font-bold text-slate-700 hover:text-indigo-600 transition-colors"
                    >
                        {expanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                        {pkg.projects.length} {pkg.projects.length === 1 ? 'project' : 'projects'}
                    </button>
                </div>

                {/* Dates */}
                <div className="col-span-2">
                    <p className="text-[9px] text-slate-400 uppercase tracking-widest font-black">Purchased</p>
                    <p className="text-xs font-semibold text-slate-700">{fmtDate(pkg.purchased_at)}</p>
                    {pkg.finished_at && (
                        <>
                            <p className="text-[9px] text-slate-400 uppercase tracking-widest font-black mt-1">Finished</p>
                            <p className="text-xs font-semibold text-slate-700">{fmtDate(pkg.finished_at)}</p>
                        </>
                    )}
                </div>

                {/* Status + actions */}
                <div className="col-span-1 flex flex-col items-end gap-2">
                    <StatusBadge status={pkg.status} />
                    <button
                        onClick={handleDelete}
                        disabled={isPending}
                        title="Delete package"
                        className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                    >
                        {isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                    </button>
                    {deleteMsg && <p className="text-[9px] text-red-500 text-right max-w-[120px]">{deleteMsg}</p>}
                </div>
            </div>

            {/* Expanded project breakdown */}
            {expanded && pkg.projects.length > 0 && (
                <div className="border-t border-slate-100 bg-slate-50/80 px-5 py-3">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">Projects Using This Package</p>
                    <div className="space-y-1.5">
                        {pkg.projects.map(p => (
                            <div key={p.id} className="flex items-center justify-between text-xs">
                                <span className="font-semibold text-slate-700 truncate max-w-[300px]">{p.project_name}</span>
                                <div className="flex items-center gap-3 shrink-0 ml-4">
                                    <span className="text-slate-500">{p.total_quantity} used</span>
                                    <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-widest ${
                                        p.status === 'Finalized' ? 'bg-emerald-100 text-emerald-700' :
                                        p.status === 'Closed'    ? 'bg-slate-100 text-slate-500' :
                                        'bg-amber-100 text-amber-700'
                                    }`}>
                                        {p.status}
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
            {expanded && pkg.projects.length === 0 && (
                <div className="border-t border-slate-100 bg-slate-50/80 px-5 py-3">
                    <p className="text-[10px] text-slate-400 italic">No projects linked to this package yet.</p>
                </div>
            )}
        </div>
    );
}

// ── Page ───────────────────────────────────────────────────────────────────

export default function BacklinksPackagePage() {
    const [packages, setPackages] = useState([]);
    const [categories, setCategories] = useState([]);
    const [loading, setLoading] = useState(true);

    async function load() {
        setLoading(true);
        const [pkgs, cats] = await Promise.all([getPackagesAction(), getCategories()]);
        setPackages(pkgs);
        setCategories(cats?.categories || []);
        setLoading(false);
    }

    useEffect(() => { load(); }, []);

    const active    = packages.filter(p => p.status === 'Active');
    const exhausted = packages.filter(p => p.status === 'Exhausted');

    return (
        <div className="p-8 max-w-7xl mx-auto">
            {/* Header */}
            <div className="flex items-center gap-4 mb-8">
                <div className="w-12 h-12 bg-indigo-50 rounded-2xl flex items-center justify-center border border-indigo-100">
                    <Package className="w-6 h-6 text-indigo-600" />
                </div>
                <div>
                    <h1 className="text-2xl font-black text-slate-900 tracking-tight uppercase">Backlink Packages</h1>
                    <p className="text-xs text-slate-400 font-semibold mt-0.5">Manage purchased link packages and track usage across projects</p>
                </div>
                {!loading && (
                    <div className="ml-auto flex items-center gap-4">
                        <div className="text-right">
                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Active</p>
                            <p className="text-xl font-black text-emerald-600">{active.length}</p>
                        </div>
                        <div className="text-right">
                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Exhausted</p>
                            <p className="text-xl font-black text-slate-400">{exhausted.length}</p>
                        </div>
                    </div>
                )}
            </div>

            {/* Add form */}
            <AddPackageForm categories={categories} onCreated={load} />

            {/* Table header */}
            {!loading && packages.length > 0 && (
                <div className="hidden md:grid grid-cols-12 px-5 py-3 text-[9px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-200 mb-2">
                    <div className="col-span-2">Code / Category</div>
                    <div className="col-span-2">Vendor</div>
                    <div className="col-span-3">Quantity</div>
                    <div className="col-span-2">Projects</div>
                    <div className="col-span-2">Dates</div>
                    <div className="col-span-1 text-right">Status</div>
                </div>
            )}

            {/* Package list */}
            {loading ? (
                <div className="flex items-center justify-center py-20">
                    <Loader2 className="w-7 h-7 text-indigo-400 animate-spin" />
                </div>
            ) : packages.length === 0 ? (
                <div className="text-center py-20 text-slate-400">
                    <Package className="w-10 h-10 mx-auto mb-3 opacity-30" />
                    <p className="text-sm font-semibold">No packages recorded yet.</p>
                    <p className="text-xs mt-1">Use the form above to add your first package.</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {packages.map(pkg => (
                        <PackageRow key={pkg.id} pkg={pkg} onDeleted={load} />
                    ))}
                </div>
            )}
        </div>
    );
}
