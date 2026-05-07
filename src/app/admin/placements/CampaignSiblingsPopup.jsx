'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { GitBranch, X, Loader2, ExternalLink } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { getCampaignSiblingsAction } from './actions';

const STATUS_STYLE = {
    Finalized:  { bg: 'bg-emerald-100', text: 'text-emerald-700' },
    Inprogress: { bg: 'bg-amber-100',   text: 'text-amber-700'   },
    Completed:  { bg: 'bg-teal-100',    text: 'text-teal-700'    },
    Closed:     { bg: 'bg-slate-100',   text: 'text-slate-500'   },
};

function getStatusStyle(status) {
    return STATUS_STYLE[status] || STATUS_STYLE['Inprogress'];
}

function toProjectSlug(projectName) {
    return (projectName || '').toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
}

export default function CampaignSiblingsPopup({ projectId, projectName }) {
    const router = useRouter();
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [siblings, setSiblings] = useState(null);
    const [popupStyle, setPopupStyle] = useState({});
    const popupRef = useRef(null);
    const buttonRef = useRef(null);

    const reposition = useCallback(() => {
        if (!buttonRef.current) return;
        const rect = buttonRef.current.getBoundingClientRect();
        const popupWidth = 320;

        let left = rect.left + rect.width / 2 - popupWidth / 2;
        left = Math.max(8, Math.min(left, window.innerWidth - popupWidth - 8));

        const spaceBelow = window.innerHeight - rect.bottom;
        setPopupStyle({
            position: 'fixed',
            top: spaceBelow >= 280 ? rect.bottom + 6 : rect.top - 6,
            left,
            width: popupWidth,
            transform: spaceBelow < 280 ? 'translateY(-100%)' : undefined,
            zIndex: 9999,
        });
    }, []);

    useEffect(() => {
        if (!open) return;
        reposition();

        function handleClickOutside(e) {
            if (
                popupRef.current && !popupRef.current.contains(e.target) &&
                buttonRef.current && !buttonRef.current.contains(e.target)
            ) setOpen(false);
        }
        function handleKeyDown(e) { if (e.key === 'Escape') setOpen(false); }

        document.addEventListener('mousedown', handleClickOutside);
        document.addEventListener('keydown', handleKeyDown);
        window.addEventListener('scroll', reposition, true);
        window.addEventListener('resize', reposition);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('scroll', reposition, true);
            window.removeEventListener('resize', reposition);
        };
    }, [open, reposition]);

    async function handleToggle() {
        if (open) { setOpen(false); return; }
        setOpen(true);
        if (siblings !== null) return;
        setLoading(true);
        try {
            const result = await getCampaignSiblingsAction(projectId);
            setSiblings(result);
        } finally {
            setLoading(false);
        }
    }

    function handleNavigate(projectName) {
        const slug = toProjectSlug(projectName);
        setOpen(false);
        router.push(`/admin/placements#project-${slug}`);
    }

    const popup = open && (
        <div
            ref={popupRef}
            style={popupStyle}
            className="bg-white rounded-2xl border border-slate-200 shadow-2xl overflow-hidden"
        >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-slate-50">
                <div>
                    <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Campaign Plans</p>
                    <p className="text-xs font-bold text-slate-700 mt-0.5 truncate max-w-[220px]">{projectName || 'Project'}</p>
                </div>
                <button
                    onClick={() => setOpen(false)}
                    className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
                >
                    <X className="w-3.5 h-3.5" />
                </button>
            </div>

            {/* Body */}
            <div className="p-3 max-h-64 overflow-y-auto">
                {loading ? (
                    <div className="flex items-center justify-center py-6">
                        <Loader2 className="w-5 h-5 text-indigo-400 animate-spin" />
                    </div>
                ) : !siblings || siblings.length === 0 ? (
                    <p className="text-[10px] text-slate-400 italic text-center py-4">No campaign siblings found.</p>
                ) : (
                    <div className="space-y-1.5">
                        {siblings.map((s) => {
                            const style = getStatusStyle(s.status);
                            const isCurrent = s.id === projectId;
                            return (
                                <div
                                    key={s.id}
                                    className={`flex items-center gap-2 px-3 py-2 rounded-xl border transition-all ${
                                        isCurrent
                                            ? 'bg-indigo-50 border-indigo-100'
                                            : 'bg-white border-slate-100 hover:border-slate-200 hover:bg-slate-50'
                                    }`}
                                >
                                    <div className="flex-1 min-w-0">
                                        <button
                                            onClick={() => !isCurrent && handleNavigate(s.project_name)}
                                            disabled={isCurrent}
                                            className={`text-xs font-bold truncate block w-full text-left ${
                                                isCurrent
                                                    ? 'text-indigo-600 cursor-default'
                                                    : 'text-slate-800 hover:text-indigo-600 hover:underline'
                                            }`}
                                            title={s.project_name}
                                        >
                                            {s.project_name}
                                            {isCurrent && <span className="ml-1.5 text-[9px] font-black text-indigo-400 uppercase tracking-widest">(this)</span>}
                                        </button>
                                        <p className="text-[10px] text-slate-400 font-medium truncate mt-0.5">{s.vendor_name}</p>
                                    </div>
                                    <div className="flex items-center gap-1.5 shrink-0">
                                        <span className={`px-1.5 py-0.5 text-[8px] font-black uppercase tracking-widest rounded ${style.bg} ${style.text}`}>
                                            {s.status}
                                        </span>
                                        {!isCurrent && (
                                            <button
                                                onClick={() => handleNavigate(s.project_name)}
                                                title="Go to vendor in Active Placements"
                                                className="p-1 text-slate-300 hover:text-indigo-500 transition-colors"
                                            >
                                                <ExternalLink className="w-3 h-3" />
                                            </button>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );

    return (
        <div className="relative flex items-center justify-center">
            <button
                ref={buttonRef}
                type="button"
                onClick={handleToggle}
                title="View campaign siblings"
                className={`p-1.5 rounded-lg border transition-all ${
                    open
                        ? 'bg-indigo-50 text-indigo-600 border-indigo-200'
                        : 'bg-slate-50 text-slate-400 border-slate-200 hover:bg-indigo-50 hover:text-indigo-500 hover:border-indigo-200'
                } w-9 h-9 flex items-center justify-center`}
            >
                <GitBranch className="w-3.5 h-3.5" />
            </button>
            {typeof document !== 'undefined' && popup && createPortal(popup, document.body)}
        </div>
    );
}
