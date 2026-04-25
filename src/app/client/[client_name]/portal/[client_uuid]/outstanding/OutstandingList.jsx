'use client';

import { useState } from 'react';
import { AlertCircle, Search, X, Calendar, Clock } from 'lucide-react';

function formatDate(d) {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function OutstandingList({ projects }) {
    const [search, setSearch] = useState('');

    const q = search.toLowerCase().trim();
    const filtered = q
        ? projects.filter(p => (p.project_name || '').toLowerCase().includes(q))
        : projects;

    return (
        <div>
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2">
                    <AlertCircle className="w-5 h-5 text-amber-600" />
                    <h1 className="text-2xl font-bold text-gray-900">Outstanding</h1>
                    <span className="ml-1 px-2 py-0.5 text-xs font-bold rounded-full bg-amber-100 text-amber-700">{projects.length}</span>
                </div>
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                    <input
                        type="text"
                        placeholder="Filter campaigns..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        className="pl-9 pr-8 py-2 text-xs border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-amber-400 w-56"
                    />
                    {search && (
                        <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700">
                            <X className="w-3.5 h-3.5" />
                        </button>
                    )}
                </div>
            </div>

            {/* Notice banner */}
            <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl mb-6 text-sm text-amber-800">
                <Clock className="w-4 h-4 mt-0.5 shrink-0 text-amber-500" />
                <p>These campaigns are awaiting payment confirmation. Start and end dates will be finalised once payment is received.</p>
            </div>

            {filtered.length === 0 ? (
                <div className="text-center py-16 bg-white rounded-xl border border-dashed border-gray-200">
                    <p className="text-gray-400 text-sm">{q ? 'No campaigns match your search.' : 'No outstanding payments.'}</p>
                </div>
            ) : (
                <div className="space-y-6">
                    {filtered.map(p => {
                        const hubTargets = Array.isArray(p.projects_hub?.[0]?.targets) ? p.projects_hub[0].targets : [];
                        const categories = [...new Set((p.project_targets || []).map(t => t.category).filter(Boolean))];

                        return (
                            <div key={p.id} className="bg-white rounded-xl ring-1 ring-amber-200 overflow-hidden">
                                {/* Project header */}
                                <div className="px-5 py-4 bg-amber-50 border-b border-amber-100 flex flex-wrap items-center justify-between gap-3">
                                    <div>
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <h3 className="font-bold text-gray-900">{p.project_name || 'Unnamed'}</h3>
                                            <span className="px-2 py-0.5 text-[10px] font-black uppercase tracking-widest rounded-full bg-amber-200 text-amber-800">Pending Payment</span>
                                        </div>
                                        {categories.length > 0 && (
                                            <div className="flex flex-wrap gap-1 mt-1.5">
                                                {categories.map(cat => (
                                                    <span key={cat} className="px-2 py-0.5 text-[9px] font-black uppercase tracking-widest rounded bg-white text-amber-700 border border-amber-200">{cat}</span>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-4 text-xs text-gray-500 shrink-0">
                                        <div className="flex items-center gap-1.5">
                                            <Calendar className="w-3.5 h-3.5" />
                                            <span className="font-medium">{formatDate(p.start_date)}</span>
                                            <span className="text-gray-300">→</span>
                                            <span className="font-medium">{formatDate(p.deadline)}</span>
                                        </div>
                                        <span className="font-bold text-gray-700">{p.total_quantity || 0} links</span>
                                    </div>
                                </div>

                                {/* Targets table */}
                                {hubTargets.length > 0 ? (
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-sm">
                                            <thead>
                                                <tr className="border-b border-gray-100 bg-white">
                                                    <th className="text-left px-5 py-2.5 text-xs font-semibold text-gray-400 uppercase tracking-wide w-8">#</th>
                                                    <th className="text-left px-5 py-2.5 text-xs font-semibold text-gray-400 uppercase tracking-wide">Anchor Text</th>
                                                    <th className="text-left px-5 py-2.5 text-xs font-semibold text-gray-400 uppercase tracking-wide">Target URL</th>
                                                    <th className="text-left px-5 py-2.5 text-xs font-semibold text-gray-400 uppercase tracking-wide">Qty</th>
                                                    <th className="text-left px-5 py-2.5 text-xs font-semibold text-gray-400 uppercase tracking-wide">Index Status</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-50">
                                                {hubTargets.map((t, idx) => (
                                                    <tr key={t.id || idx} className="hover:bg-gray-50/50">
                                                        <td className="px-5 py-3 text-xs text-gray-400 tabular-nums">{idx + 1}</td>
                                                        <td className="px-5 py-3 text-xs text-gray-700">{t.anchor_text || '—'}</td>
                                                        <td className="px-5 py-3 text-xs text-gray-600 max-w-[260px] truncate">{t.target_url || '—'}</td>
                                                        <td className="px-5 py-3 text-xs font-semibold text-gray-700 tabular-nums">{t.quantity ?? t.ratio ?? '—'}</td>
                                                        <td className="px-5 py-3">
                                                            <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-amber-100 text-amber-700">Pending Payment</span>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                ) : (
                                    <div className="px-5 py-4 text-xs text-gray-400 italic">No target details available.</div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
