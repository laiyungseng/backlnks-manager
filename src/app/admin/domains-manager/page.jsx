'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { getDomains, saveDomains, deleteDomains } from './actions';
import { DataEditor, GridCellKind, CompactSelection } from '@glideapps/glide-data-grid';
import '@glideapps/glide-data-grid/dist/index.css';
import { Filter, Globe, Save, RefreshCw, Trash2, CheckCircle2 } from 'lucide-react';

export default function DomainsManager() {
    const [domains, setDomains] = useState([]);
    const [vendorOptions, setVendorOptions] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [lastSavedAt, setLastSavedAt] = useState(null);
    const [feedback, setFeedback] = useState({ type: '', message: '' });
    const [isDirty, setIsDirty] = useState(false);

    // Filtering states
    const [isFilterActive, setIsFilterActive] = useState(false);
    const [filters, setFilters] = useState({
        domain_url: '', vendor_id: '', domain_rating: '', traffic: '', domain_age: '', spam_score: '', last_checked_at: ''
    });

    // Grid states
    const [selection, setSelection] = useState(undefined);

    useEffect(() => {
        fetchDomains();
    }, []);

    // Auto-save effect
    useEffect(() => {
        if (!isDirty) return;

        const timer = setTimeout(() => {
            handleSave(true);
        }, 1500);

        return () => clearTimeout(timer);
    }, [domains, isDirty]);

    const fetchDomains = async () => {
        const result = await getDomains();
        if (result.success) {
            setDomains(result.domains || []);
            setVendorOptions(result.vendorOptions || []);
        } else {
            showFeedback('error', result.message || 'Failed to load domains');
        }
        setIsLoading(false);
    };

    const handleSave = async (isAutoSave = false) => {
        if (!isDirty) return;
        setIsSaving(true);
        if (!isAutoSave) setFeedback({ type: '', message: '' });

        const result = await saveDomains(domains);

        if (result.success) {
            if (!isAutoSave) showFeedback('success', 'Changes saved successfully.');
            setLastSavedAt(new Date());
            setIsDirty(false);

            // Refresh list to grab any generated UUIDs for new records if necessary
            if (domains.some(v => v.id && v.id.startsWith('new_'))) {
                await fetchDomains();
            }
        } else {
            showFeedback('error', result.message || 'Failed to save.');
        }
        setIsSaving(false);
    };

    const handleDeleteSelected = async () => {
        // Gather row indices based on selection
        let rowsToDelete = [];

        if (selection?.rows) {
            const ranges = selection.rows.toArray();
            for (const [start, end] of ranges) {
                for (let i = start; i < end; i++) {
                    rowsToDelete.push(i);
                }
            }
        } else if (selection?.current) {
            const { y, height } = selection.current.range;
            for (let i = y; i < y + height; i++) {
                rowsToDelete.push(i);
            }
        }

        if (rowsToDelete.length === 0) {
            return showFeedback('error', 'Select rows to delete.');
        }

        const domainIdsToDelete = rowsToDelete.map(idx => filteredDomains[idx]?.id).filter(Boolean);
        const rowsRemaining = domains.filter(d => !domainIdsToDelete.includes(d.id));

        setIsSaving(true);
        const result = await deleteDomains(domainIdsToDelete);

        if (result.success) {
            setDomains(rowsRemaining);
            setSelection(undefined);
            showFeedback('success', result.message);
        } else {
            showFeedback('error', result.message);
        }
        setIsSaving(false);
    };

    const handleAddRow = () => {
        const newRow = {
            id: `new_${Date.now()}`,
            vendor_id: null,
            vendors: null, // joined relation mock
            domain_url: '',
            domain_rating: null,
            traffic: null,
            domain_age: null,
            spam_score: null,
            last_checked_at: null
        };
        setDomains([newRow, ...domains]);
        setIsDirty(true);
    };

    const showFeedback = (type, message) => {
        setFeedback({ type, message });
        if (type !== 'error') {
            setTimeout(() => setFeedback({ type: '', message: '' }), 4000);
        }
    };

    // --- Dynamic Dropdown Options based on current Data ---
    const uniqueOptions = useMemo(() => {
        const buildUnique = (field) => {
            // Handle the joined vendor relation
            if (field === 'vendor_id') {
                return vendorOptions; // Map from state directly (contains { id, vendor_name })
            }
            return [...new Set(domains.map(d => String(d[field] ?? '')).filter(Boolean))];
        };

        return {
            domain_name: buildUnique('domain_name'),
            vendor_id: buildUnique('vendor_id'),
            da_score: buildUnique('da_score'),
            dr_score: buildUnique('dr_score'),
            traffic_monthly: buildUnique('traffic_monthly'),
            niche: buildUnique('niche'),
            price_usd: buildUnique('price_usd'),
            turnaround_days: buildUnique('turnaround_days'),
            status: buildUnique('status'),
            remark: buildUnique('remark')
        };
    }, [domains, vendorOptions]);

    const filteredDomains = useMemo(() => {
        if (!isFilterActive) return domains;
        return domains.filter(d => {
            const matches = Object.keys(filters).map(field => {
                if (!filters[field] || filters[field] === 'all') return true;

                if (field === 'vendor_id') {
                    return String(d.vendor_id || '') === filters[field];
                }

                const val = String(d[field] ?? '');
                return val === filters[field];
            });

            return matches.every(Boolean); // All dropdowns must match
        });
    }, [domains, isFilterActive, filters]);

    const handleFilterChange = (field, value) => {
        setFilters(prev => ({ ...prev, [field]: value }));
    };

    // --- Grid Setup ---
    const columns = useMemo(() => [
        { title: "Domain URL", id: "domain_url", width: 220 },
        { title: "Vendor", id: "vendor_id", width: 200 }, // Will display vendor_name via joined table
        { title: "Domain Rating", id: "domain_rating", width: 130 },
        { title: "Traffic", id: "traffic", width: 130 },
        { title: "Domain Age", id: "domain_age", width: 120 },
        { title: "Spam Score", id: "spam_score", width: 120 },
        { title: "Last Checked At", id: "last_checked_at", width: 200 }
    ], []);

    const getCellContent = useCallback((cell) => {
        const [col, row] = cell;
        const dataRow = filteredDomains[row];

        if (!dataRow) {
            return { kind: GridCellKind.Text, data: "", displayData: "", allowOverlay: false };
        }

        const colDef = columns[col];
        const field = colDef.id;

        if (field === 'vendor_id') {
            // Map the vendor_id UUID to vendor_name
            let displayVendor = '';
            let vendorId = dataRow.vendor_id;

            // Check joined data
            if (dataRow.vendors && dataRow.vendors.vendor_name) {
                displayVendor = dataRow.vendors.vendor_name;
            }
            // Check against options mapping if user just dropped down
            else if (vendorId) {
                const matchedVendor = vendorOptions.find(v => v.id === vendorId);
                if (matchedVendor) displayVendor = matchedVendor.vendor_name;
            }

            return {
                kind: GridCellKind.Text,
                allowOverlay: true,
                data: displayVendor,
                displayData: displayVendor
            };
        }

        const val = String(dataRow[field] ?? '');

        // For numbers, align them to right or left if preferred, text defaults left
        const isNumber = ['domain_rating', 'traffic', 'domain_age', 'spam_score'].includes(field);

        return {
            kind: GridCellKind.Text,
            data: val,
            displayData: val,
            allowOverlay: true,
            contentAlign: isNumber ? 'right' : 'left'
        };
    }, [filteredDomains, columns, vendorOptions]);

    const onCellEdited = useCallback((cell, newValue) => {
        const [col, row] = cell;
        const dataRow = filteredDomains[row];
        if (!dataRow) return;

        const colDef = columns[col];
        const field = colDef.id;

        const originalIdx = domains.findIndex(d => d.id === dataRow.id);
        if (originalIdx === -1) return;

        let valToSet = newValue.data;

        // If modifying vendor relationship from custom dropdown format
        if (field === 'vendor_id') {
            if (newValue.kind === GridCellKind.Custom && newValue.data.kind === 'dropdown-cell') {
                valToSet = newValue.data.value; // Getting UUID
            } else if (newValue.kind === GridCellKind.Text) {
                // Fallback if pasted raw text: find matching vendor mapping
                const matchedVendor = vendorOptions.find(v => v.vendor_name.toLowerCase() === valToSet.toLowerCase());
                if (matchedVendor) {
                    valToSet = matchedVendor.id;
                } else {
                    // pasted vendor names not matching return undefined / discard
                    return;
                }
            }
        }

        setDomains(prev => {
            const newRows = [...prev];
            let updatedRow = { ...newRows[originalIdx], [field]: valToSet };

            // Update the joined object visually for grid render without server roundtrip
            if (field === 'vendor_id') {
                const mVendor = vendorOptions.find(v => v.id === valToSet);
                updatedRow.vendors = mVendor ? { vendor_name: mVendor.vendor_name } : null;
            }

            newRows[originalIdx] = updatedRow;
            return newRows;
        });

        setIsDirty(true);
    }, [filteredDomains, columns, domains, vendorOptions]);

    const onPaste = useCallback((target, values) => {
        const [x, y] = target;
        let hasChanges = false;

        setDomains(prevRows => {
            const newRows = [...prevRows];

            for (let rIndex = 0; rIndex < values.length; rIndex++) {
                const rowData = values[rIndex];
                const targetRow = y + rIndex;

                if (targetRow >= filteredDomains.length) continue;

                const dataRow = filteredDomains[targetRow];
                const originalIdx = newRows.findIndex(d => d.id === dataRow.id);
                if (originalIdx === -1) continue;

                let updatedRow = { ...newRows[originalIdx] };
                let rowHasChanges = false;

                for (let cIndex = 0; cIndex < rowData.length; cIndex++) {
                    let valToSet = rowData[cIndex];
                    const targetCol = x + cIndex;

                    if (targetCol >= columns.length) continue;

                    const field = columns[targetCol].id;

                    if (field === 'vendor_id') {
                        const matchedVendor = vendorOptions.find(v => v.vendor_name.toLowerCase() === valToSet.toLowerCase());
                        if (matchedVendor) {
                            valToSet = matchedVendor.id;
                            updatedRow.vendors = { vendor_name: matchedVendor.vendor_name };
                        } else {
                            continue; // Skip setting if vendor mapping fails
                        }
                    }

                    updatedRow[field] = valToSet;
                    rowHasChanges = true;
                }

                if (rowHasChanges) {
                    newRows[originalIdx] = updatedRow;
                    hasChanges = true;
                }
            }
            return newRows;
        });

        if (hasChanges) setIsDirty(true);
        return true;
    }, [filteredDomains, columns, domains, vendorOptions]);

    const onDelete = useCallback((selection) => {
        if (!selection || (!selection.current && !selection.rows && !selection.columns)) return true;

        setDomains(prevRows => {
            const newRows = [...prevRows];
            let hasChanges = false;

            if (selection.current && selection.current.range) {
                const { x: startCol, y: startRow, width, height } = selection.current.range;
                const endCol = startCol + width;
                const endRow = startRow + height;

                for (let rowIdx = startRow; rowIdx < endRow; rowIdx++) {
                    const dataRow = filteredDomains[rowIdx];
                    if (!dataRow) continue;

                    const originalIdx = newRows.findIndex(d => d.id === dataRow.id);
                    if (originalIdx === -1) continue;

                    let updatedRow = { ...newRows[originalIdx] };
                    let rowChanged = false;

                    for (let colIdx = startCol; colIdx < endCol; colIdx++) {
                        const colDef = columns[colIdx];
                        if (!colDef) continue;

                        const field = colDef.id;
                        updatedRow[field] = field === 'domain_rating' || field === 'traffic' || field === 'domain_age' || field === 'spam_score' ? null : '';

                        if (field === 'vendor_id') {
                            updatedRow.vendors = null;
                        }
                        rowChanged = true;
                    }

                    if (rowChanged) {
                        newRows[originalIdx] = updatedRow;
                        hasChanges = true;
                    }
                }
            }

            if (hasChanges) setTimeout(() => setIsDirty(true), 0);
            return newRows;
        });

        return true;
    }, [filteredDomains, columns]);

    const onKeyDown = useCallback((event) => {
        if (event.key === 'Backspace' && selection && (selection.current || selection.rows || selection.columns)) {
            onDelete(selection);
        }
    }, [selection, onDelete]);

    if (isLoading) {
        return (
            <div className="flex h-64 items-center justify-center">
                <RefreshCw className="w-8 h-8 text-indigo-500 animate-spin" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Domains Manager</h1>
                    <p className="text-gray-500 text-sm mt-1">Manage all publisher domains, metrics, and map them to existing vendors.</p>
                </div>
                <div className="flex gap-3">
                    <button
                        onClick={handleAddRow}
                        className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-md font-medium text-sm hover:bg-indigo-700 transition"
                    >
                        <Globe className="w-4 h-4" />
                        Add Domain
                    </button>
                    {(selection?.rows || selection?.current) && (
                        <button
                            onClick={handleDeleteSelected}
                            disabled={isSaving}
                            className="flex items-center gap-2 px-4 py-2 bg-red-100 text-red-700 rounded-md font-medium text-sm hover:bg-red-200 transition disabled:opacity-50"
                        >
                            <Trash2 className="w-4 h-4" />
                            Delete Row(s)
                        </button>
                    )}
                </div>
            </div>

            {feedback.message && (
                <div className={`p-4 rounded-md flex items-center gap-3 text-sm font-medium ${feedback.type === 'error' ? 'bg-red-50 text-red-800' : 'bg-green-50 text-green-800'}`}>
                    {feedback.type === 'success' && <CheckCircle2 className="w-5 h-5 text-green-500" />}
                    <span>{feedback.message}</span>
                </div>
            )}

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 flex flex-col h-[700px]">
                {/* Top Toolbar */}
                <div className="px-6 py-4 border-b border-gray-200 bg-gray-50 flex flex-wrap items-center justify-between gap-4 shrink-0">
                    <button
                        onClick={() => setIsFilterActive(!isFilterActive)}
                        className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-semibold transition-colors border shadow-sm ${isFilterActive ? 'bg-indigo-600 text-white border-indigo-700' : 'bg-white text-gray-700 border-gray-300'}`}
                    >
                        <Filter className="w-4 h-4" />
                        {isFilterActive ? 'Filters Active' : 'Enable Filters'}
                    </button>

                    <div className="flex items-center gap-2 bg-white px-4 py-2 border border-gray-200 rounded-md shadow-sm">
                        {isSaving ? (
                            <>
                                <RefreshCw className="w-4 h-4 animate-spin text-indigo-500" />
                                <span className="text-sm font-medium text-indigo-700">Auto-saving...</span>
                            </>
                        ) : lastSavedAt ? (
                            <>
                                <CheckCircle2 className="w-4 h-4 text-green-500" />
                                <span className="text-sm font-medium text-green-700">
                                    Saved: {lastSavedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                                </span>
                            </>
                        ) : (
                            <span className="text-sm font-medium text-gray-400">All changes saved.</span>
                        )}
                    </div>
                </div>

                {/* Column Filters Dropdown Container */}
                {isFilterActive && (
                    <div className="px-6 py-4 border-b border-gray-200 bg-white shadow-inner text-sm shrink-0 flex flex-nowrap overflow-x-auto gap-4 custom-scrollbar">
                        {columns.map(col => (
                            <div key={col.id} className="flex flex-col gap-1.5 min-w-[150px]">
                                <span className="font-semibold text-[11px] uppercase tracking-wider text-gray-500 whitespace-nowrap">{col.title}</span>
                                <select
                                    value={filters[col.id] || 'all'}
                                    onChange={e => handleFilterChange(col.id, e.target.value)}
                                    className="px-3 py-2 bg-gray-50 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 outline-none truncate"
                                >
                                    <option value="all">All</option>
                                    {col.id === 'vendor_id' ? (
                                        // Specific logic to render vendor IDs as names in dropdown filter
                                        uniqueOptions.vendor_id.map((vOpt) => (
                                            <option key={vOpt.id} value={vOpt.id}>{vOpt.vendor_name}</option>
                                        ))
                                    ) : (
                                        // Standard fields
                                        uniqueOptions[col.id].map((val, i) => (
                                            <option key={i} value={val}>{val}</option>
                                        ))
                                    )}
                                </select>
                            </div>
                        ))}
                    </div>
                )}

                {/* Grid Content */}
                <div className="flex-1 w-full bg-white relative z-0">
                    <DataEditor
                        width="100%"
                        height="100%"
                        getCellContent={getCellContent}
                        columns={columns}
                        rows={filteredDomains.length}
                        onCellEdited={onCellEdited}
                        onDelete={onDelete}
                        onGridSelectionChange={setSelection}
                        gridSelection={selection}
                        onPaste={onPaste}
                        onKeyDown={onKeyDown}
                        smoothScrollX={true}
                        smoothScrollY={true}
                        rowMarkers="both"
                        keybindings={{ search: true }}
                        provideEditor={true} // In Glide Data Editor, custom dropdowns require this or proper cell mapping
                    />
                </div>
                <div className="px-6 py-3 bg-gray-50 border-t border-gray-200 text-xs font-medium text-gray-500 shrink-0">
                    Showing {filteredDomains.length} domains
                </div>
            </div>
        </div>
    );
}
