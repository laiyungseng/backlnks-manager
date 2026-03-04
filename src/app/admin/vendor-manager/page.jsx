'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { getVendors, saveVendors, deleteVendors } from './actions';
import { DataEditor, GridCellKind, CompactSelection } from '@glideapps/glide-data-grid';
import '@glideapps/glide-data-grid/dist/index.css';
import { Filter, UserPlus, Save, RefreshCw, Trash2, CheckCircle2 } from 'lucide-react';

export default function VendorManager() {
    const [vendors, setVendors] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [lastSavedAt, setLastSavedAt] = useState(null);
    const [feedback, setFeedback] = useState({ type: '', message: '' });
    const [isDirty, setIsDirty] = useState(false);

    // Filtering states
    const [isFilterActive, setIsFilterActive] = useState(false);
    const [filters, setFilters] = useState({ vendor_name: '', contact_email: '', website: '', status: '', remark: '' });

    // Grid states
    const [selection, setSelection] = useState(undefined);

    useEffect(() => {
        fetchVendors();
    }, []);

    // Auto-save effect
    useEffect(() => {
        if (!isDirty) return;

        const timer = setTimeout(() => {
            handleSave(true);
        }, 1500);

        return () => clearTimeout(timer);
    }, [vendors, isDirty]);

    const fetchVendors = async () => {
        const result = await getVendors();
        if (result.success) {
            setVendors(result.vendors || []);
        } else {
            showFeedback('error', result.message || 'Failed to load vendors');
        }
        setIsLoading(false);
    };

    const handleSave = async (isAutoSave = false) => {
        if (!isDirty) return;
        setIsSaving(true);
        if (!isAutoSave) setFeedback({ type: '', message: '' });

        const result = await saveVendors(vendors);

        if (result.success) {
            if (!isAutoSave) showFeedback('success', 'Changes saved successfully.');
            setLastSavedAt(new Date());
            setIsDirty(false);

            // Refresh list to grab any generated UUIDs for new records if necessary
            if (vendors.some(v => v.id.startsWith('new_'))) {
                await fetchVendors();
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
            const ranges = selection.rows.toArray(); // Array of [start, end)
            for (const [start, end] of ranges) {
                for (let i = start; i < end; i++) {
                    rowsToDelete.push(i);
                }
            }
        } else if (selection?.current) {
            // Extract row range from current rectangular selection
            const { y, height } = selection.current.range;
            for (let i = y; i < y + height; i++) {
                rowsToDelete.push(i);
            }
        }

        if (rowsToDelete.length === 0) {
            return showFeedback('error', 'Select rows to delete.');
        }

        // Map row indices to IDs
        const vendorIdsToDelete = rowsToDelete.map(idx => filteredVendors[idx]?.id).filter(Boolean);

        // If the user selects a new, unsaved row, just remove it from state locally
        const rowsRemaining = vendors.filter(v => !vendorIdsToDelete.includes(v.id));

        setIsSaving(true);
        const result = await deleteVendors(vendorIdsToDelete);

        if (result.success) {
            setVendors(rowsRemaining);
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
            vendor_name: '',
            contact_email: '',
            contact_phone: '',
            website: '',
            status: 'Active',
            remark: ''
        };
        setVendors([newRow, ...vendors]); // Add to top
        setIsDirty(true);
    };

    const showFeedback = (type, message) => {
        setFeedback({ type, message });
        if (type !== 'error') {
            setTimeout(() => setFeedback({ type: '', message: '' }), 4000);
        }
    };

    // --- Filtering Logic ---
    const uniqueOptions = useMemo(() => {
        return {
            vendor_name: [...new Set(vendors.map(v => v.vendor_name).filter(Boolean))],
            contact_email: [...new Set(vendors.map(v => v.contact_email).filter(Boolean))],
            website: [...new Set(vendors.map(v => v.website).filter(Boolean))],
            status: [...new Set(vendors.map(v => v.status).filter(Boolean))],
            remark: [...new Set(vendors.map(v => v.remark).filter(Boolean))]
        };
    }, [vendors]);

    const filteredVendors = useMemo(() => {
        if (!isFilterActive) return vendors;
        return vendors.filter(v => {
            const matchName = !filters.vendor_name || v.vendor_name === filters.vendor_name;
            const matchEmail = !filters.contact_email || v.contact_email === filters.contact_email;
            const matchWebsite = !filters.website || v.website === filters.website;
            const matchStatus = !filters.status || v.status === filters.status;
            const matchRemark = !filters.remark || v.remark === filters.remark;

            return matchName && matchEmail && matchWebsite && matchStatus && matchRemark;
        });
    }, [vendors, isFilterActive, filters]);

    const handleFilterChange = (field, value) => {
        setFilters(prev => ({ ...prev, [field]: value }));
    };

    // --- Grid Setup ---
    const columns = useMemo(() => [
        { title: "Vendor Name", id: "vendor_name", width: 250 },
        { title: "Contact Email", id: "contact_email", width: 220 },
        { title: "Contact Phone", id: "contact_phone", width: 180 },
        { title: "Website", id: "website", width: 220 },
        { title: "Status", id: "status", width: 120 },
        { title: "Remark", id: "remark", width: 300 }
    ], []);

    const getCellContent = useCallback((cell) => {
        const [col, row] = cell;
        const dataRow = filteredVendors[row];

        if (!dataRow) {
            return { kind: GridCellKind.Text, data: "", displayData: "", allowOverlay: false };
        }

        const colDef = columns[col];
        const val = dataRow[colDef.id] || "";

        // Determine readonly state for visual feedback (none in this case, all are editable)
        return {
            kind: GridCellKind.Text,
            data: val,
            displayData: val,
            allowOverlay: true
        };
    }, [filteredVendors, columns]);

    const onCellEdited = useCallback((cell, newValue) => {
        const [col, row] = cell;
        const dataRow = filteredVendors[row];
        if (!dataRow) return;

        const colDef = columns[col];
        const field = colDef.id;

        const originalIdx = vendors.findIndex(v => v.id === dataRow.id);
        if (originalIdx === -1) return;

        const valToSet = newValue.data;

        setVendors(prev => {
            const newRows = [...prev];
            newRows[originalIdx] = { ...newRows[originalIdx], [field]: valToSet };
            return newRows;
        });

        setIsDirty(true);
    }, [filteredVendors, columns, vendors]);

    const onPaste = useCallback((target, values) => {
        const [x, y] = target;
        let hasChanges = false;

        setVendors(prevRows => {
            const newRows = [...prevRows];

            for (let rIndex = 0; rIndex < values.length; rIndex++) {
                const rowData = values[rIndex];
                const targetRow = y + rIndex;

                if (targetRow >= filteredVendors.length) continue;

                const dataRow = filteredVendors[targetRow];
                const originalIdx = newRows.findIndex(v => v.id === dataRow.id);
                if (originalIdx === -1) continue;

                let updatedRow = { ...newRows[originalIdx] };
                let rowHasChanges = false;

                for (let cIndex = 0; cIndex < rowData.length; cIndex++) {
                    const valToSet = rowData[cIndex];
                    const targetCol = x + cIndex;

                    if (targetCol >= columns.length) continue;

                    const colDef = columns[targetCol];
                    const field = colDef.id;

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
    }, [filteredVendors, columns, vendors]);

    const onDelete = useCallback((selection) => {
        if (!selection || (!selection.current && !selection.rows && !selection.columns)) return true;

        setVendors(prevRows => {
            const newRows = [...prevRows];
            let hasChanges = false;

            if (selection.current && selection.current.range) {
                const { x: startCol, y: startRow, width, height } = selection.current.range;
                const endCol = startCol + width;
                const endRow = startRow + height;

                for (let rowIdx = startRow; rowIdx < endRow; rowIdx++) {
                    const dataRow = filteredVendors[rowIdx];
                    if (!dataRow) continue;

                    const originalIdx = newRows.findIndex(v => v.id === dataRow.id);
                    if (originalIdx === -1) continue;

                    let updatedRow = { ...newRows[originalIdx] };
                    let rowChanged = false;

                    for (let colIdx = startCol; colIdx < endCol; colIdx++) {
                        const colDef = columns[colIdx];
                        if (!colDef) continue;

                        updatedRow[colDef.id] = '';
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
    }, [filteredVendors, columns]);

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
                    <h1 className="text-2xl font-bold text-gray-900">Vendor Manager</h1>
                    <p className="text-gray-500 text-sm mt-1">Manage vendor details entirely inside this grid workspace.</p>
                </div>
                <div className="flex gap-3">
                    <button
                        onClick={handleAddRow}
                        className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-md font-medium text-sm hover:bg-indigo-700 transition"
                    >
                        <UserPlus className="w-4 h-4" />
                        Add Vendor
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
                <div className="px-6 py-4 border-b border-gray-200 bg-gray-50 flex items-center justify-between gap-4 shrink-0">
                    <button
                        onClick={() => setIsFilterActive(!isFilterActive)}
                        className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-semibold transition-colors border shadow-sm ${isFilterActive ? 'bg-indigo-600 text-white border-indigo-700' : 'bg-white text-gray-700 border-gray-300'}`}
                    >
                        <Filter className="w-4 h-4" />
                        {isFilterActive ? 'Filters Active' : 'Enable Filters'}
                    </button>

                    {/* Saves Stat */}
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

                {/* Filters Array */}
                {isFilterActive && (
                    <div className="px-6 py-4 border-b border-gray-200 bg-white grid grid-cols-2 lg:grid-cols-5 gap-4 shadow-inner text-sm shrink-0">
                        {/* Filter items mapping similar to requested structure */}
                        {['vendor_name', 'contact_email', 'website', 'status', 'remark'].map(field => (
                            <div key={field} className="flex flex-col gap-1.5">
                                <span className="font-semibold text-[11px] uppercase tracking-wider text-gray-500">{field.replace('_', ' ')}</span>
                                <select
                                    value={filters[field]}
                                    onChange={e => handleFilterChange(field, e.target.value)}
                                    className="px-3 py-2 bg-white border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 outline-none"
                                >
                                    <option value="">All</option>
                                    {uniqueOptions[field].map((val, i) => (
                                        <option key={i} value={val}>{val}</option>
                                    ))}
                                </select>
                            </div>
                        ))}
                    </div>
                )}

                {/* Grid Component Area */}
                <div className="flex-1 w-full bg-white relative z-0">
                    <DataEditor
                        width="100%"
                        height="100%"
                        getCellContent={getCellContent}
                        columns={columns}
                        rows={filteredVendors.length}
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
                    />
                </div>
                <div className="px-6 py-3 bg-gray-50 border-t border-gray-200 text-xs font-medium text-gray-500 shrink-0">
                    Showing {filteredVendors.length} vendors
                </div>
            </div>
        </div>
    );
}
