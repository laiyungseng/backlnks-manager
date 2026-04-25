'use client';

import { useState } from 'react';
import { Loader, Search, X, Globe, Calendar, FileText } from 'lucide-react';
import ProjectSheetModal from '../components/ProjectSheetModal';

function getProgress(project) {
    const hub = project.projects_hub?.[0] || {};
    const stagingData = Array.isArray(hub.vendor_staging_data) ? hub.vendor_staging_data : [];
    const hubTargets = Array.isArray(hub.targets) ? hub.targets : [];
    const completed = stagingData.filter(s => s.published_url?.trim()).length;
    const total = hubTargets.length > 0
        ? hubTargets.reduce((acc, t) => acc + (parseInt(t.quantity || '0', 10)), 0)
        : (project.total_quantity || 0);
    return { completed, total, percent: total > 0 ? Math.round((completed / total) * 100) : 0 };
}

function getRemainingDays(deadline) {
    if (!deadline) return null;
    const now = new Date(); now.setHours(0, 0, 0, 0);
    const due = new Date(deadline); due.setHours(0, 0, 0, 0);
    return Math.floor((due - now) / (1000 * 60 * 60 * 24));
}

export default function ClientInProgressList({ projects, displayName }) {
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
                    <Loader className="w-5 h-5 text-emerald-600" />
                    <h1 className="text-2xl font-bold text-gray-900">In Progress</h1>
                    <span className="ml-1 px-2 py-0.5 text-xs font-bold rounded-full bg-emerald-100 text-emerald-700">{projects.length}</span>
                </div>
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                    <input
                        type="text"
                        placeholder="Filter campaigns..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        className="pl-9 pr-8 py-2 text-xs border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-emerald-400 w-56"
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
                    <p className="text-gray-400 text-sm">{q ? 'No campaigns match your search.' : 'No in-progress campaigns.'}</p>
                </div>
            ) : (
                <div className="space-y-4">
                    {filtered.map(p => {
                        const { completed, total, percent } = getProgress(p);
                        const daysLeft = getRemainingDays(p.deadline);
                        const categories = [...new Set((p.project_targets || []).map(t => t.category).filter(Boolean))];
                        return (
                            <div key={p.id} className="bg-white rounded-xl ring-1 ring-gray-200 p-5">
                                <div className="flex items-start justify-between gap-4 mb-4">
                                    <div>
                                        <h3 className="font-bold text-gray-900 text-base">{p.project_name || 'Unnamed'}</h3>
                                        <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                                            {p.country && (
                                                <span className="flex items-center gap-1"><Globe className="w-3 h-3" />{p.country}</span>
                                            )}
                                            {p.deadline && (
                                                <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />
                                                    {new Date(p.deadline).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                                                    {daysLeft !== null && daysLeft <= 3 && (
                                                        <span className={`ml-1 font-bold px-1.5 py-0.5 rounded ${daysLeft < 0 ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'}`}>
                                                            {daysLeft < 0 ? `${Math.abs(daysLeft)}d late` : daysLeft === 0 ? 'Today' : `${daysLeft}d left`}
                                                        </span>
                                                    )}
                                                </span>
                                            )}
                                        </div>
                                        {categories.length > 0 && (
                                            <div className="flex flex-wrap gap-1 mt-2">
                                                {categories.map(cat => (
                                                    <span key={cat} className="px-2 py-0.5 text-[9px] font-black uppercase tracking-widest rounded bg-gray-100 text-gray-600 border border-gray-200">{cat}</span>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-2 shrink-0">
                                        <button
                                            onClick={() => setSheetProject(p)}
                                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg hover:bg-emerald-100 transition-colors"
                                        >
                                            <FileText className="w-3.5 h-3.5" />
                                            View Sheet
                                        </button>
                                        <span className="text-2xl font-black text-emerald-600">{percent}%</span>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    <div className="flex-1 bg-gray-100 rounded-full h-2">
                                        <div className="h-2 rounded-full bg-emerald-500 transition-all duration-700" style={{ width: `${percent}%` }} />
                                    </div>
                                    <span className="text-xs text-gray-500 tabular-nums shrink-0">{completed}/{total} links</span>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {sheetProject && (
                <ProjectSheetModal
                    projectId={sheetProject.id}
                    projectName={sheetProject.project_name}
                    isCompleted={false}
                    onClose={() => setSheetProject(null)}
                />
            )}
        </div>
    );
}
