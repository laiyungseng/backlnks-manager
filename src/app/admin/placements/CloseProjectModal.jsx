'use client';

import { useState } from 'react';
import { XCircle, AlertTriangle, X } from 'lucide-react';

const TIER_STYLES = {
    'NO RESPONSE':                 { bg: 'bg-orange-100',  text: 'text-orange-700',  border: 'border-orange-300',  dot: 'bg-orange-500'  },
    'POTENTIAL FRAUD':             { bg: 'bg-red-100',     text: 'text-red-600',     border: 'border-red-300',     dot: 'bg-red-400'     },
    'POTENTIAL FRAUD — HIGH RISK': { bg: 'bg-red-200',     text: 'text-red-800',     border: 'border-red-400',     dot: 'bg-red-600'     },
    'CLOSED':                      { bg: 'bg-slate-100',   text: 'text-slate-600',   border: 'border-slate-300',   dot: 'bg-slate-400'   },
};

function computeLocalTier(latestActivityIso, createdDateIso) {
    const base = latestActivityIso
        ? new Date(latestActivityIso)
        : createdDateIso
            ? new Date(createdDateIso)
            : null;

    if (!base) return 'CLOSED';
    const days = Math.floor((Date.now() - base.getTime()) / 86400000);
    if (days >= 30) return 'POTENTIAL FRAUD — HIGH RISK';
    if (days >= 14) return 'POTENTIAL FRAUD';
    if (days >= 7)  return 'NO RESPONSE';
    return 'CLOSED';
}

export default function CloseProjectModal({
    project,
    vendorLastActivity, // ISO string — MAX last_activity_at across vendor's projects (passed from parent)
    onClose,
    onConfirm,
    isSubmitting,
}) {
    const [reason, setReason] = useState('');

    const tier = computeLocalTier(vendorLastActivity, project?.created_date);
    const tierStyle = TIER_STYLES[tier] || TIER_STYLES['CLOSED'];

    function handleConfirm() {
        if (!reason.trim()) return;
        onConfirm(reason.trim());
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
                onClick={onClose}
            />

            {/* Modal */}
            <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md border border-slate-200 overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 bg-red-50 rounded-xl flex items-center justify-center border border-red-100">
                            <XCircle className="w-5 h-5 text-red-500" />
                        </div>
                        <div>
                            <h2 className="text-sm font-black text-slate-900 uppercase tracking-widest">Close Project</h2>
                            <p className="text-[10px] text-slate-400 font-semibold truncate max-w-[220px]">
                                {project?.project_name || 'Unnamed Project'}
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>

                {/* Body */}
                <div className="px-6 py-5 space-y-4">
                    {/* Warning */}
                    <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl p-4">
                        <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
                        <p className="text-xs font-semibold text-amber-800 leading-relaxed">
                            This will permanently close the project and lock it from further vendor submissions.
                            The vendor's risk status will be updated in Vendor Manager.
                        </p>
                    </div>

                    {/* Risk Tier Badge */}
                    <div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Computed Vendor Risk Tier</p>
                        <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border ${tierStyle.bg} ${tierStyle.border}`}>
                            <div className={`w-2 h-2 rounded-full ${tierStyle.dot}`} />
                            <span className={`text-[10px] font-black uppercase tracking-widest ${tierStyle.text}`}>{tier}</span>
                        </div>
                        <p className="text-[10px] text-slate-400 mt-1.5">
                            Based on the most recent activity across all of this vendor's active projects.
                        </p>
                    </div>

                    {/* Reason input */}
                    <div>
                        <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">
                            Reason for Closing <span className="text-red-500">*</span>
                        </label>
                        <textarea
                            value={reason}
                            onChange={e => setReason(e.target.value)}
                            placeholder="e.g. Vendor unresponsive after 3 weeks, suspected fraud, order placed but no delivery..."
                            rows={3}
                            className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl bg-slate-50 focus:outline-none focus:ring-2 focus:ring-red-400 focus:border-red-400 resize-none text-slate-800 placeholder-slate-400 font-medium"
                        />
                    </div>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-100 bg-slate-50">
                    <button
                        onClick={onClose}
                        disabled={isSubmitting}
                        className="px-4 py-2 text-[11px] font-black uppercase tracking-widest text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-100 transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleConfirm}
                        disabled={isSubmitting || !reason.trim()}
                        className="px-4 py-2 text-[11px] font-black uppercase tracking-widest text-white bg-red-500 border border-red-500 rounded-xl hover:bg-red-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                        <XCircle className="w-3.5 h-3.5" />
                        {isSubmitting ? 'Closing...' : 'Confirm Close'}
                    </button>
                </div>
            </div>
        </div>
    );
}
