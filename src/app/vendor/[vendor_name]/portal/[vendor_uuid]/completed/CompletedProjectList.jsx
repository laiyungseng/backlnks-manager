'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Lock, ExternalLink, CheckCircle2, Search } from 'lucide-react';

function getTotal(project) {
    const hub = project.projects_hub?.[0] || {};
    const hubTargets = Array.isArray(hub.targets) ? hub.targets : [];
    return hubTargets.length > 0
        ? hubTargets.reduce((acc, t) => acc + (parseInt(t.quantity || '0', 10)), 0)
        : (project.total_quantity || 0);
}

function formatLanguages(project) {
    if (project.project_languages && project.project_languages.length > 0) {
        return project.project_languages.map(l => `${l.lang_code} (${l.ratio}%)`).join(', ');
    }
    return project.language ? `${project.language} (100%)` : '—';
}

export default function CompletedProjectList({ projects, vendorName, displayName }) {
    const [search, setSearch] = useState('');

    const filtered = search.trim()
        ? projects.filter(p => (p.project_name || '').toLowerCase().includes(search.toLowerCase().trim()))
        : projects;

    return (
        <div>
            {/* Header — title left, search right */}
            <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Completed Projects</h1>
                    <p className="mt-2 text-sm text-gray-500">
                        Finalized assignments for <span className="font-semibold text-indigo-600">{displayName}</span>
                    </p>
                </div>
                <div className="relative w-full sm:w-64 mt-1">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Search className="h-4 w-4 text-gray-400" />
                    </div>
                    <input
                        type="text"
                        placeholder="Search projects..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        className="block w-full pl-9 pr-3 py-2.5 border border-gray-200 rounded-xl text-sm bg-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-gray-900"
                    />
                </div>
            </div>

            <div className="space-y-6">
                {filtered.length > 0 ? (
                    filtered.map((project) => {
                        const hash = project.projects_hub?.[0]?.hash;
                        const isLocked = project.projects_hub?.[0]?.is_locked || false;
                        const category = project.project_targets?.[0]?.category;

                        return (
                            <div key={project.id} className="bg-white rounded-xl shadow-sm ring-1 ring-gray-200 overflow-hidden">
                                <div className="px-6 py-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2">
                                            <h2 className="text-lg font-bold text-gray-900">{project.project_name || 'Unnamed Project'}</h2>
                                            <span className="flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold rounded bg-green-50 text-green-700 border border-green-200">
                                                <CheckCircle2 className="w-3 h-3" /> Finalized
                                            </span>
                                        </div>
                                        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs">
                                            {project.country && (
                                                <div>
                                                    <span className="text-gray-400">Country: </span>
                                                    <span className="font-semibold text-gray-700 uppercase">{project.country}</span>
                                                </div>
                                            )}
                                            <div>
                                                <span className="text-gray-400">Language: </span>
                                                <span className="font-semibold text-gray-700 uppercase">{formatLanguages(project)}</span>
                                            </div>
                                            {category && (
                                                <div>
                                                    <span className="text-gray-400">Category: </span>
                                                    <span className="font-semibold text-purple-700">{category}</span>
                                                </div>
                                            )}
                                            <div>
                                                <span className="text-gray-400">Qty: </span>
                                                <span className="font-semibold text-gray-700">{getTotal(project)}</span>
                                            </div>
                                            <div>
                                                <span className="text-gray-400">Target Domain: </span>
                                                {(() => {
                                                    const hubTargets = project.projects_hub?.[0]?.targets || [];
                                                    const safeHostname = (url) => { try { return new URL(url).hostname; } catch { return url; } };
                                                    if (hubTargets.length === 0) return <span className="italic text-gray-400">No Targets</span>;
                                                    if (hubTargets.length === 1) return <span className="font-semibold text-indigo-600 truncate max-w-[200px] inline-block align-bottom">{safeHostname(hubTargets[0].target_url)}</span>;
                                                    return <span className="font-semibold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded text-xs">{hubTargets.length} Target URLs</span>;
                                                })()}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-3 shrink-0">
                                        <span className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded ${isLocked
                                            ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                            : 'bg-blue-50 text-blue-700 border border-blue-200'
                                        }`}>
                                            {isLocked ? <Lock className="w-3.5 h-3.5" /> : <ExternalLink className="w-3.5 h-3.5" />}
                                            {isLocked ? 'Locked' : 'Editable'}
                                        </span>

                                        {hash && !isLocked && (
                                            <Link
                                                href={`/vendor/${vendorName}/${hash}`}
                                                className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 text-white text-sm font-bold rounded-lg hover:bg-indigo-700 transition-colors shadow-sm"
                                            >
                                                <ExternalLink className="w-4 h-4" />
                                                Open
                                            </Link>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })
                ) : (
                    <div className="text-center py-20 bg-white rounded-xl border border-dashed border-gray-300">
                        <p className="text-gray-500">
                            {search.trim() ? 'No projects match your search.' : 'No completed projects yet.'}
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}
