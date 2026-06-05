'use client';

import { useState, useTransition } from 'react';
import { getVendorAuditLog } from './actions';
import { ChevronDown, ChevronRight } from 'lucide-react';

const ACTION_LABELS = {
    vendor_project_view: 'Page View',
    vendor_save: 'Data Save',
    vendor_data_deletion: 'Field Deletion',
    vendor_finalized_sync: 'Finalized Sync',
    vendor_session_start: 'Session Start',
    url_entry_toggled: 'URL Toggle',
};

const ACTION_COLORS = {
    vendor_project_view: 'bg-blue-100 text-blue-700',
    vendor_save: 'bg-green-100 text-green-700',
    vendor_data_deletion: 'bg-red-100 text-red-700',
    vendor_finalized_sync: 'bg-purple-100 text-purple-700',
    vendor_session_start: 'bg-slate-100 text-slate-600',
    url_entry_toggled: 'bg-amber-100 text-amber-700',
};

function MetaExpander({ meta }) {
    const [open, setOpen] = useState(false);
    if (!meta) return null;
    const deletions = meta.deletions;
    if (!deletions?.length) return <span className="text-xs text-slate-400 italic">meta</span>;
    return (
        <div>
            <button
                onClick={() => setOpen(v => !v)}
                className="flex items-center gap-1 text-xs text-indigo-600 hover:underline"
            >
                {open ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                {deletions.length} field{deletions.length > 1 ? 's' : ''} cleared
            </button>
            {open && (
                <ul className="mt-1 space-y-0.5 pl-4 border-l-2 border-red-200">
                    {deletions.map((d, i) => (
                        <li key={i} className="text-xs text-slate-600">
                            <span className="font-mono text-red-600">{d.field}</span>
                            {' '}was{' '}
                            <span className="font-mono bg-slate-100 px-1 rounded">{String(d.oldValue).slice(0, 80)}</span>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}

export default function VendorLogClient({ initialLogs, initialTotal, initialProjectNames, vendors }) {
    const [logs, setLogs] = useState(initialLogs);
    const [total, setTotal] = useState(initialTotal);
    const [projectNames, setProjectNames] = useState(initialProjectNames);
    const [selectedVendorId, setSelectedVendorId] = useState('');
    const [actorType, setActorType] = useState('');
    const [page, setPage] = useState(0);
    const [isPending, startTransition] = useTransition();

    const LIMIT = 50;

    const vendorNameMap = Object.fromEntries(vendors.map(v => [v.id, v.vendor_name]));

    const load = (vendorId, p, aType) => {
        startTransition(async () => {
            const res = await getVendorAuditLog({ page: p, limit: LIMIT, vendorId: vendorId || null, actorType: aType || null });
            if (res.success) {
                setLogs(res.logs);
                setTotal(res.total);
                setProjectNames(res.projectNames);
            }
        });
    };

    const handleVendorChange = (id) => {
        setSelectedVendorId(id);
        setPage(0);
        load(id, 0, actorType);
    };

    const handleActorTypeChange = (aType) => {
        setActorType(aType);
        setPage(0);
        load(selectedVendorId, 0, aType);
    };

    const handlePage = (p) => {
        setPage(p);
        load(selectedVendorId, p, actorType);
    };

    const totalPages = Math.ceil(total / LIMIT);

    return (
        <div>
            {/* Filters */}
            <div className="flex flex-wrap items-center gap-3 mb-5">
                <label className="text-sm font-semibold text-slate-600 whitespace-nowrap">Filter by Vendor:</label>
                <select
                    value={selectedVendorId}
                    onChange={e => handleVendorChange(e.target.value)}
                    className="border border-slate-300 rounded-md px-3 py-1.5 text-sm text-slate-700 focus:ring-indigo-500 focus:border-indigo-500"
                >
                    <option value="">All Vendors</option>
                    {vendors.map(v => (
                        <option key={v.id} value={v.id}>{v.vendor_name}</option>
                    ))}
                </select>
                <div className="flex items-center gap-1.5">
                    {[
                        { value: '', label: 'All' },
                        { value: 'admin', label: 'Admin' },
                        { value: 'vendor', label: 'Vendor' },
                    ].map(pill => (
                        <button
                            key={pill.value}
                            onClick={() => handleActorTypeChange(pill.value)}
                            className={`px-3 py-1 rounded-full text-xs font-semibold border transition-colors ${actorType === pill.value ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-500 border-slate-300 hover:border-slate-400'}`}
                        >
                            {pill.label}
                        </button>
                    ))}
                </div>
                <span className="text-xs text-slate-400">{total} record{total !== 1 ? 's' : ''}</span>
                {isPending && <span className="text-xs text-indigo-500 animate-pulse">Loading…</span>}
            </div>

            {/* Table */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead className="bg-slate-50 border-b border-slate-200">
                            <tr>
                                <th className="px-4 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Time</th>
                                <th className="px-4 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Action</th>
                                <th className="px-4 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Vendor</th>
                                <th className="px-4 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Project</th>
                                <th className="px-4 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Detail</th>
                                <th className="px-4 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Meta</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {logs.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="px-4 py-8 text-center text-slate-400">No activity logs found.</td>
                                </tr>
                            ) : logs.map(log => (
                                <tr key={log.id} className="hover:bg-slate-50">
                                    <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap font-mono">
                                        {new Date(log.created_at).toLocaleString()}
                                    </td>
                                    <td className="px-4 py-3">
                                        <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${ACTION_COLORS[log.action] || 'bg-slate-100 text-slate-600'}`}>
                                            {ACTION_LABELS[log.action] || log.action}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 text-xs text-slate-700">
                                        {log.actor === 'Admin'
                                            ? <span className="inline-block px-2 py-0.5 rounded-full text-xs font-semibold bg-indigo-100 text-indigo-700">Admin</span>
                                            : log.actor_id ? (vendorNameMap[log.actor_id] || <span className="font-mono text-slate-400">{log.actor_id.slice(0, 8)}…</span>) : '—'
                                        }
                                    </td>
                                    <td className="px-4 py-3 text-xs text-slate-700 max-w-[180px] truncate">
                                        {log.target_id ? (projectNames[log.target_id] || <span className="font-mono text-slate-400">{log.target_id.slice(0, 8)}…</span>) : '—'}
                                    </td>
                                    <td className="px-4 py-3 text-xs text-slate-500 max-w-[200px] truncate">{log.detail || '—'}</td>
                                    <td className="px-4 py-3"><MetaExpander meta={log.meta} /></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                    <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 bg-slate-50">
                        <span className="text-xs text-slate-500">Page {page + 1} of {totalPages}</span>
                        <div className="flex gap-2">
                            <button
                                onClick={() => handlePage(page - 1)}
                                disabled={page === 0 || isPending}
                                className="px-3 py-1 text-xs font-semibold border border-slate-300 rounded-md hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                                Prev
                            </button>
                            <button
                                onClick={() => handlePage(page + 1)}
                                disabled={page >= totalPages - 1 || isPending}
                                className="px-3 py-1 text-xs font-semibold border border-slate-300 rounded-md hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                                Next
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
