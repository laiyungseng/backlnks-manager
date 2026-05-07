'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Info, X, Link2, Type, Loader2 } from 'lucide-react';
import { getAnchorInfoAction } from './actions';

export default function AnchorInfoPopup({ projectId, projectName }) {
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [data, setData] = useState(null);
    const [popupStyle, setPopupStyle] = useState({});
    const popupRef = useRef(null);
    const buttonRef = useRef(null);

    // Recalculate popup position anchored to the button
    const reposition = useCallback(() => {
        if (!buttonRef.current) return;
        const rect = buttonRef.current.getBoundingClientRect();
        const popupWidth = 288; // w-72 = 18rem = 288px

        let left = rect.left + rect.width / 2 - popupWidth / 2;
        // Clamp so it doesn't overflow viewport edges
        left = Math.max(8, Math.min(left, window.innerWidth - popupWidth - 8));

        // Prefer below; flip above if not enough room
        const spaceBelow = window.innerHeight - rect.bottom;
        setPopupStyle({
            position: 'fixed',
            top: spaceBelow >= 260 ? rect.bottom + 6 : rect.top - 6,
            left,
            width: popupWidth,
            transform: spaceBelow < 260 ? 'translateY(-100%)' : undefined,
            zIndex: 9999,
        });
    }, []);

    useEffect(() => {
        if (!open) return;

        reposition();

        function handleClickOutside(e) {
            if (
                popupRef.current &&
                !popupRef.current.contains(e.target) &&
                buttonRef.current &&
                !buttonRef.current.contains(e.target)
            ) {
                setOpen(false);
            }
        }

        function handleKeyDown(e) {
            if (e.key === 'Escape') setOpen(false);
        }

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
        if (open) {
            setOpen(false);
            return;
        }
        setOpen(true);
        if (data) return; // already fetched

        setLoading(true);
        try {
            const result = await getAnchorInfoAction(projectId);
            setData(result);
        } finally {
            setLoading(false);
        }
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
                    <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Placement Info</p>
                    <p className="text-xs font-bold text-slate-700 mt-0.5 truncate max-w-[180px]">{projectName || 'Project'}</p>
                </div>
                <button
                    onClick={() => setOpen(false)}
                    className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
                >
                    <X className="w-3.5 h-3.5" />
                </button>
            </div>

            {/* Body */}
            <div className="p-4 space-y-4">
                {loading ? (
                    <div className="flex items-center justify-center py-6">
                        <Loader2 className="w-5 h-5 text-indigo-400 animate-spin" />
                    </div>
                ) : (
                    <>
                        {/* Anchor Texts */}
                        <div>
                            <div className="flex items-center gap-1.5 mb-2">
                                <Type className="w-3 h-3 text-indigo-400" />
                                <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">
                                    Anchor Texts ({data?.anchorTexts?.length ?? 0})
                                </span>
                            </div>
                            {data?.anchorTexts?.length > 0 ? (
                                <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto">
                                    {data.anchorTexts.map((text, i) => (
                                        <span
                                            key={i}
                                            className="px-2 py-1 bg-indigo-50 text-indigo-700 text-[10px] font-semibold rounded-lg border border-indigo-100 max-w-[220px] truncate"
                                            title={text}
                                        >
                                            {text}
                                        </span>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-[10px] text-slate-400 italic">No anchor texts recorded yet.</p>
                            )}
                        </div>

                        {/* Target URLs */}
                        <div>
                            <div className="flex items-center gap-1.5 mb-2">
                                <Link2 className="w-3 h-3 text-emerald-500" />
                                <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">
                                    Target URLs ({data?.targetUrls?.length ?? 0})
                                </span>
                            </div>
                            {data?.targetUrls?.length > 0 ? (
                                <div className="space-y-1 max-h-28 overflow-y-auto">
                                    {data.targetUrls.map((url, i) => (
                                        <a
                                            key={i}
                                            href={url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="flex items-center gap-1.5 text-[10px] text-emerald-600 hover:text-emerald-800 font-medium truncate hover:underline"
                                            title={url}
                                        >
                                            <Link2 className="w-2.5 h-2.5 shrink-0" />
                                            <span className="truncate">{url}</span>
                                        </a>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-[10px] text-slate-400 italic">No target URLs recorded.</p>
                            )}
                        </div>
                    </>
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
                title="View anchor texts & target URLs"
                className={`p-1.5 rounded-lg border transition-all ${
                    open
                        ? 'bg-indigo-50 text-indigo-600 border-indigo-200'
                        : 'bg-slate-50 text-slate-400 border-slate-200 hover:bg-indigo-50 hover:text-indigo-500 hover:border-indigo-200'
                } w-9 h-9 flex items-center justify-center`}
            >
                <Info className="w-3.5 h-3.5" />
            </button>

            {typeof document !== 'undefined' && popup && createPortal(popup, document.body)}
        </div>
    );
}
