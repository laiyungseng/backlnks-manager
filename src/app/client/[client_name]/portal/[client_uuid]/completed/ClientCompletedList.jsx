'use client';

import { useState } from 'react';
import { CheckCircle2, Search, X, Globe, FileText } from 'lucide-react';
import ProjectSheetModal from '../components/ProjectSheetModal';

function getProgress(project) {
    const hub = project.projects_hub?.[0] || {};
    const stagingData = Array.isArray(hub.vendor_staging_data) ? hub.vendor_staging_data : [];
    const hubTargets = Array.isArray(hub.targets) ? hub.targets : [];
    const completed = stagingData.filter(s => s.published_url?.trim()).length;
    const indexedCount = stagingData.filter(s => s.indexed_status?.trim()).length;
    const total = hubTargets.length > 0
        ? hubTargets.reduce((acc, t) => acc + (parseInt(t.quantity || '0', 10)), 0)
        : (project.total_quantity || 0);
    return { completed, indexedCount, total };
}

export default function ClientCompletedList({ projects, displayName }) {
    const [search, setSearch] = useState('');
    const [sheetProject, setSheetProject] = useState(null);

    const q = search.toLowerCase().trim();
    const filtered = q
        ? projects.filter(p => (p.project_name || '').toLowerCase().includes(q) || (p.country || '').toLowerCase().includes(q))
        : projects;

    return (
        <div>
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5 text-teal-600" />
                    <h1 className="text-2xl font-bold text-gray-900">Completed</h1>
                    <span className="ml-1 px-2 py-0.5 text-xs font-bold rounded-full bg-teal-100 text-teal-700">{projects.length}</span>
                </div>
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                    <input
                        type="text"
                        placeholder="Filter campaigns..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        className="pl-9 pr-8 py-2 text-xs border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-teal-400 w-56"
                    />
                    {search && (
                        <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700">
                            <X className="w-3.5 h-3.5" />
                        </button>
                    )}
                </div>
            </div>

            {filtered.length === 0 ? (
                <div className="text-center py-16 bg-white rounded-xl border border-dashed border-gray-200">
                    <p className="text-gray-400 text-sm">{q ? 'No campaigns match your search.' : 'No completed campaigns yet.'}</p>
                </div>
            ) : (
                <div className="bg-white rounded-xl ring-1 ring-gray-200 overflow-hidden">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="bg-gray-50 border-b border-gray-100">
                                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Campaign</th>
                                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Country</th>
                                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Links</th>
                                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Indexed</th>
                                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Completed</th>
                                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Sheet</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {filtered.map(p => {
                                const { completed, indexedCount, total } = getProgress(p);
                                const categories = [...new Set((p.project_targets || []).map(t => t.category).filter(Boolean))];
                                return (
                                    <tr key={p.id} className="hover:bg-gray-50/50">
                                        <td className="px-4 py-3">
                                            <p className="font-semibold text-gray-900">{p.project_name || 'Unnamed'}</p>
                                            {categories.length > 0 && (
                                                <div className="flex flex-wrap gap-1 mt-1">
                                                    {categories.map(cat => (
                                                        <span key={cat} className="px-1.5 py-0.5 text-[9px] font-black uppercase tracking-widest rounded bg-gray-100 text-gray-500">{cat}</span>
                                                    ))}
                                                </div>
                                            )}
                                        </td>
                                        <td className="px-4 py-3 text-gray-500">
                                            {p.country && <span className="flex items-center gap-1"><Globe className="w-3 h-3" />{p.country}</span>}
                                        </td>
                                        <td className="px-4 py-3 text-gray-700 font-semibold tabular-nums">{completed}/{total}</td>
                                        <td className="px-4 py-3 text-gray-500 tabular-nums">{indexedCount}/{total}</td>
                                        <td className="px-4 py-3 text-gray-500">
                                            {p.completed_date
                                                ? new Date(p.completed_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
                                                : '—'}
                                        </td>
                                        <td className="px-4 py-3">
                                            <button
                                                onClick={() => setSheetProject(p)}
                                                className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-teal-700 bg-teal-50 border border-teal-200 rounded-lg hover:bg-teal-100 transition-colors"
                                            >
                                                <FileText className="w-3.5 h-3.5" />
                                                View
                                            </button>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}

            {sheetProject && (
                <ProjectSheetModal
                    projectId={sheetProject.id}
                    projectName={sheetProject.project_name}
                    isCompleted={true}
                    onClose={() => setSheetProject(null)}
                />
            )}
        </div>
    );
}
