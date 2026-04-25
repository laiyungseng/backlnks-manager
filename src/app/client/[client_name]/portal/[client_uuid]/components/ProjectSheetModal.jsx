'use client';

import { useState, useEffect } from 'react';
import { X, Copy, Check, ExternalLink } from 'lucide-react';
import { getProjectSheet } from '@/app/client/actions';

function CopyCell({ text }) {
    const [copied, setCopied] = useState(false);
    const copy = async () => {
        if (!text) return;
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
    };
    return (
        <div className="flex items-center gap-1.5 min-w-0">
            <span className="truncate text-xs text-gray-700 max-w-[180px]" title={text}>{text || '—'}</span>
            {text && (
                <button onClick={copy} className="shrink-0 text-gray-400 hover:text-emerald-600 transition-colors">
                    {copied ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                </button>
            )}
        </div>
    );
}

export default function ProjectSheetModal({ projectId, projectName, isCompleted, onClose }) {
    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        setError(null);
        getProjectSheet(projectId, isCompleted).then(result => {
            if (cancelled) return;
            if (result.error) {
                setError(result.error);
            } else {
                setRows(result.rows || []);
            }
            setLoading(false);
        });
        return () => { cancelled = true; };
    }, [projectId, isCompleted]);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden">
                {/* Header */}
                <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between shrink-0">
                    <div>
                        <h3 className="font-bold text-gray-900 text-base">{projectName || 'Project Sheet'}</h3>
                        <p className="text-xs text-gray-500 mt-0.5">
                            {isCompleted ? 'Completed placements' : 'Submitted links'}{!loading && ` · ${rows.length} rows`}
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-50 transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-auto">
                    {loading && (
                        <div className="flex items-center justify-center py-20 text-sm text-gray-400">
                            Loading...
                        </div>
                    )}
                    {!loading && error && (
                        <div className="flex items-center justify-center py-20 text-sm text-red-500">
                            {error}
                        </div>
                    )}
                    {!loading && !error && rows.length === 0 && (
                        <div className="flex items-center justify-center py-20 text-sm text-gray-400">
                            No data submitted yet.
                        </div>
                    )}
                    {!loading && !error && rows.length > 0 && (
                        <table className="w-full text-sm">
                            <thead className="sticky top-0 bg-gray-50 border-b border-gray-100">
                                <tr>
                                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide w-10">#</th>
                                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Anchor Text</th>
                                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Target URL</th>
                                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Published URL</th>
                                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Index Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {rows.map((row, idx) => (
                                    <tr key={row.id || idx} className="hover:bg-gray-50/50">
                                        <td className="px-4 py-3 text-xs text-gray-400 tabular-nums">{idx + 1}</td>
                                        <td className="px-4 py-3">
                                            <CopyCell text={row.anchor_text} />
                                        </td>
                                        <td className="px-4 py-3">
                                            <CopyCell text={row.target_url} />
                                        </td>
                                        <td className="px-4 py-3">
                                            {row.published_url ? (
                                                <a
                                                    href={row.published_url}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="flex items-center gap-1 text-xs text-emerald-600 hover:text-emerald-800 max-w-[200px]"
                                                >
                                                    <ExternalLink className="w-3 h-3 shrink-0" />
                                                    <span className="truncate">{row.published_url}</span>
                                                </a>
                                            ) : (
                                                <span className="text-xs text-gray-400">—</span>
                                            )}
                                        </td>
                                        <td className="px-4 py-3">
                                            {row.indexed_status ? (
                                                <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-teal-100 text-teal-700">{row.indexed_status}</span>
                                            ) : (
                                                <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-gray-100 text-gray-500">Pending</span>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-gray-100 flex justify-end shrink-0">
                    <button
                        onClick={onClose}
                        className="px-5 py-2 text-xs font-bold text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
}
