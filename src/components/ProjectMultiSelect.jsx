'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Filter, X, ChevronDown } from 'lucide-react';

/**
 * Searchable multi-select project filter.
 *
 * @param {string[]} options          - all selectable project names
 * @param {string[]} value            - currently selected project names
 * @param {(next: string[]) => void} onChange - called with the new selection
 * @param {string} [placeholder]
 */
export default function ProjectMultiSelect({ options, value, onChange, placeholder = 'Search projects…' }) {
    const [query, setQuery] = useState('');
    const [open, setOpen] = useState(false);
    const wrapRef = useRef(null);
    const inputRef = useRef(null);

    // Close dropdown on outside click.
    useEffect(() => {
        function onDocMouseDown(e) {
            if (wrapRef.current && !wrapRef.current.contains(e.target)) {
                setOpen(false);
            }
        }
        document.addEventListener('mousedown', onDocMouseDown);
        return () => document.removeEventListener('mousedown', onDocMouseDown);
    }, []);

    const selectedSet = useMemo(() => new Set(value), [value]);

    const filteredOptions = useMemo(() => {
        const q = query.trim().toLowerCase();
        return options.filter(
            name => !selectedSet.has(name) && (q === '' || name.toLowerCase().includes(q))
        );
    }, [options, selectedSet, query]);

    function add(name) {
        if (selectedSet.has(name)) return;
        onChange([...value, name]);
        setQuery('');
        setOpen(true);
        inputRef.current?.focus();
    }

    function remove(name) {
        onChange(value.filter(n => n !== name));
    }

    function clearAll() {
        onChange([]);
        setQuery('');
    }

    function onInputKeyDown(e) {
        if (e.key === 'Backspace' && query === '' && value.length > 0) {
            remove(value[value.length - 1]);
        } else if (e.key === 'Escape') {
            setOpen(false);
        } else if (e.key === 'Enter' && filteredOptions.length > 0) {
            e.preventDefault();
            add(filteredOptions[0]);
        }
    }

    return (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
            <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                    <Filter className="w-3.5 h-3.5 text-slate-400" />
                    <span className="text-xs font-black uppercase tracking-widest text-slate-400">Filter by Project</span>
                </div>
                {value.length > 0 && (
                    <button
                        onClick={clearAll}
                        className="text-xs font-semibold text-slate-400 hover:text-slate-600 transition-colors"
                    >
                        Clear all
                    </button>
                )}
            </div>

            <div ref={wrapRef} className="relative">
                {/* Tags + input */}
                <div
                    className="flex flex-wrap items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 focus-within:border-indigo-400 focus-within:ring-2 focus-within:ring-indigo-100 transition-colors cursor-text"
                    onClick={() => { setOpen(true); inputRef.current?.focus(); }}
                >
                    {value.map(name => (
                        <span
                            key={name}
                            className="inline-flex items-center gap-1 rounded-full bg-indigo-600 text-white text-xs font-semibold pl-2.5 pr-1 py-1"
                        >
                            {name}
                            <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); remove(name); }}
                                className="rounded-full hover:bg-indigo-500 p-0.5 transition-colors"
                                aria-label={`Remove ${name}`}
                            >
                                <X className="w-3 h-3" />
                            </button>
                        </span>
                    ))}
                    <input
                        ref={inputRef}
                        value={query}
                        onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
                        onFocus={() => setOpen(true)}
                        onKeyDown={onInputKeyDown}
                        placeholder={value.length === 0 ? placeholder : ''}
                        className="flex-1 min-w-[120px] bg-transparent text-sm text-slate-700 placeholder:text-slate-400 outline-none py-0.5"
                    />
                    <ChevronDown
                        className={`w-4 h-4 text-slate-400 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
                    />
                </div>

                {/* Dropdown */}
                {open && (
                    <div className="absolute z-20 mt-1 w-full rounded-lg border border-slate-200 bg-white shadow-lg max-h-60 overflow-y-auto">
                        {filteredOptions.length === 0 ? (
                            <div className="px-3 py-2.5 text-xs text-slate-400">
                                {query.trim() ? 'No matching projects' : 'All projects selected'}
                            </div>
                        ) : (
                            filteredOptions.map(name => (
                                <button
                                    key={name}
                                    type="button"
                                    onClick={() => add(name)}
                                    className="block w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-indigo-50 hover:text-indigo-700 transition-colors"
                                >
                                    {name}
                                </button>
                            ))
                        )}
                    </div>
                )}
            </div>

            {value.length === 0 && (
                <p className="text-[11px] text-slate-400 mt-2">Showing all projects. Select one or more to filter.</p>
            )}
        </div>
    );
}
