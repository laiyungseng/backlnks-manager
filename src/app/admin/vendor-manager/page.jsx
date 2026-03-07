'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { getVendors, saveVendors, deleteVendors, getLinkedDomains } from './actions';
import { DataEditor, GridCellKind, CompactSelection } from '@glideapps/glide-data-grid';
import '@glideapps/glide-data-grid/dist/index.css';
import { Filter, UserPlus, Save, RefreshCw, Trash2, CheckCircle2 } from 'lucide-react';

export default function VendorManager() {
    const [vendors, setVendors] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [lastSavedAt, setLastSavedAt] = useState(null);
    const [feedback, setFeedback] = useState({ type: '', message: '' });

    // Delete Confirmation Modal State
    const [deleteModalState, setDeleteModalState] = useState({
        isOpen: false,
        linkedDomains: [],
        vendorIdsToDelete: [],
        isLoading: false
    });

    // Edit Mode & Change Tracking
    const [isEditMode, setIsEditMode] = useState(false);
    const [dirtyRows, setDirtyRows] = useState(new Set());

    // Filtering states
    const [isFilterActive, setIsFilterActive] = useState(false);
    const [filters, setFilters] = useState({
        vendor_name: '',
        contact: '',
        product_types: '',
        performance: '',
        price: '',
        quality: '',
        option_stock: '',
        max_discount_pct: ''
    });

    // Grid states
    const [selection, setSelection] = useState(undefined);

    useEffect(() => {
        fetchVendors();
    }, []);

    const fetchVendors = async () => {
        setIsLoading(true);
        const result = await getVendors();
        if (result.success) {
            setVendors(result.vendors || []);
            setDirtyRows(new Set());
        } else {
            showFeedback('error', result.message || 'Failed to load vendors');
        }
        setIsLoading(false);
    };

    const handleSave = async () => {
        if (dirtyRows.size === 0) {
            setIsEditMode(false);
            return;
        }

        setIsSaving(true);
        setFeedback({ type: '', message: '' });

        // Only save rows that were actually modified
        const rowsToSave = vendors.filter((_, idx) => dirtyRows.has(idx));
        const result = await saveVendors(rowsToSave);

        if (result.success) {
            showFeedback('success', 'Changes saved successfully.');
            setLastSavedAt(new Date());
            setDirtyRows(new Set());
            setIsEditMode(false);

            // Refresh list to grab any generated UUIDs for new records and sync state
            await fetchVendors();
        } else {
            showFeedback('error', result.message || 'Failed to save.');
        }
        setIsSaving(false);
    };

    const handleCancelEdit = () => {
        if (dirtyRows.size > 0 && !confirm('Discard unsaved changes?')) return;
        setIsEditMode(false);
        setDirtyRows(new Set());
        fetchVendors(); // Revert to DB state
    };

    const handleDeleteSelected = async () => {
        // Gather row indices based on selection
        let rowsToDelete = [];

        if (selection?.rows) {
            const indices = selection.rows.toArray();
            for (const idx of indices) {
                rowsToDelete.push(idx);
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

        if (vendorIdsToDelete.length === 0) return;

        // Check for linked domains before deleting
        setIsSaving(true);
        const linkCheck = await getLinkedDomains(vendorIdsToDelete);
        setIsSaving(false);

        if (linkCheck.success && linkCheck.domains && linkCheck.domains.length > 0) {
            // Unsaved row ids will just be ignored by DB but we can show modal still
            setDeleteModalState({
                isOpen: true,
                linkedDomains: linkCheck.domains,
                vendorIdsToDelete,
                isLoading: false
            });
            return;
        }

        // Standard delete if no linked domains
        if (!confirm(`Are you sure you want to delete ${rowsToDelete.length} row(s)?`)) return;
        executeDelete(vendorIdsToDelete);
    };

    const executeDelete = async (vendorIds) => {
        setDeleteModalState(prev => ({ ...prev, isLoading: true }));
        setIsSaving(true);
        const result = await deleteVendors(vendorIds);

        if (result.success) {
            setVendors(prev => prev.filter(v => !vendorIds.includes(v.id)));
            setSelection(undefined);
            showFeedback('success', result.message);
            setDirtyRows(new Set());
        } else {
            showFeedback('error', result.message);
        }

        setIsSaving(false);
        setDeleteModalState({ isOpen: false, linkedDomains: [], vendorIdsToDelete: [], isLoading: false });
    };

    // Create a blank row template
    const createNewRow = () => ({
        id: `new_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        vendor_name: '',
        contact: '',
        product_types: '',
        performance: '',
        price: '',
        quality: '',
        option_stock: '',
        max_discount_pct: ''
    });

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
            contact: [...new Set(vendors.map(v => v.contact).filter(Boolean))],
            product_types: [...new Set(vendors.map(v => v.product_types).filter(Boolean))],
            performance: [...new Set(vendors.map(v => v.performance).filter(Boolean))],
            price: [...new Set(vendors.map(v => v.price).filter(Boolean))],
            quality: [...new Set(vendors.map(v => v.quality).filter(Boolean))],
            option_stock: [...new Set(vendors.map(v => v.option_stock).filter(Boolean))],
            max_discount_pct: [...new Set(vendors.map(v => v.max_discount_pct).filter(Boolean))]
        };
    }, [vendors]);

    const filteredVendors = useMemo(() => {
        if (!isFilterActive) return vendors;
        return vendors.filter(v => {
            const matchName = !filters.vendor_name || v.vendor_name === filters.vendor_name;
            const matchContact = !filters.contact || v.contact === filters.contact;
            const matchProducts = !filters.product_types || v.product_types === filters.product_types;
            const matchPerf = !filters.performance || v.performance === filters.performance;
            const matchPrice = !filters.price || v.price === filters.price;
            const matchQuality = !filters.quality || v.quality === filters.quality;
            const matchStock = !filters.option_stock || v.option_stock === filters.option_stock;
            const matchDiscount = !filters.max_discount_pct || v.max_discount_pct === filters.max_discount_pct;

            return matchName && matchContact && matchProducts && matchPerf && matchPrice && matchQuality && matchStock && matchDiscount;
        });
    }, [vendors, isFilterActive, filters]);

    const handleFilterChange = (field, value) => {
        setFilters(prev => ({ ...prev, [field]: value }));
    };

    // --- Grid Setup ---
    const columns = useMemo(() => [
        { title: "Vendor Name", id: "vendor_name", width: 220 },
        { title: "Contact", id: "contact", width: 200 },
        { title: "Product Types", id: "product_types", width: 180 },
        { title: "Performance", id: "performance", width: 180 },
        { title: "Price", id: "price", width: 120 },
        { title: "Quality", id: "quality", width: 120 },
        { title: "Option Stock", id: "option_stock", width: 150 },
        { title: "Max Discount %", id: "max_discount_pct", width: 150 }
    ], []);

    const getCellContent = useCallback((cell) => {
        const [col, row] = cell;
        const colDef = columns[col];

        // Trailing Row for new data entry
        if (row === filteredVendors.length) {
            return {
                kind: GridCellKind.Text,
                data: "",
                displayData: "",
                allowOverlay: true,
                readonly: false,
                placeholder: `+ Add ${colDef.title}`
            };
        }

        const dataRow = filteredVendors[row];
        if (!dataRow) {
            return { kind: GridCellKind.Text, data: "", displayData: "", allowOverlay: false, readonly: true };
        }

        const val = dataRow[colDef.id] || "";

        return {
            kind: GridCellKind.Text,
            data: val,
            displayData: val,
            allowOverlay: isEditMode,
            readonly: !isEditMode
        };
    }, [filteredVendors, columns, isEditMode]);

    const onCellEdited = useCallback((cell, newValue) => {
        if (!isEditMode) return;
        const [col, row] = cell;
        const colDef = columns[col];
        const field = colDef.id;
        const valToSet = newValue.data;

        // Detection for new row entry (trailing row)
        if (row === filteredVendors.length) {
            const newRow = createNewRow();
            newRow[field] = valToSet;

            setVendors(prev => {
                const updated = [...prev, newRow];
                setDirtyRows(d => new Set(d).add(updated.length - 1));
                return updated;
            });
            return;
        }

        const dataRow = filteredVendors[row];
        if (!dataRow) return;

        const originalIdx = vendors.findIndex(v => v.id === dataRow.id);
        if (originalIdx === -1) return;

        setVendors(prev => {
            const newRows = [...prev];
            newRows[originalIdx] = { ...newRows[originalIdx], [field]: valToSet };
            return newRows;
        });

        setDirtyRows(prev => {
            const next = new Set(prev);
            next.add(originalIdx);
            return next;
        });
    }, [filteredVendors, columns, vendors, isEditMode]);

    const onPaste = useCallback((target, values) => {
        if (!isEditMode) return false;
        const [x, y] = target;
        let hasChanges = false;
        const addedDirtyIndices = new Set();

        setVendors(prevRows => {
            const newRows = [...prevRows];

            for (let rIndex = 0; rIndex < values.length; rIndex++) {
                const rowData = values[rIndex];
                const targetRow = y + rIndex;

                let originalIdx;

                // If the paste goes beyond current rows, auto-expand
                if (targetRow >= newRows.length) {
                    const newRow = createNewRow();
                    newRows.push(newRow);
                    originalIdx = newRows.length - 1;
                } else {
                    const dataRow = filteredVendors[targetRow] || newRows[targetRow];
                    originalIdx = newRows.findIndex(v => v.id === dataRow.id);
                }

                if (originalIdx === -1) continue;

                let updatedRow = { ...newRows[originalIdx] };
                let rowHasChanges = false;

                for (let cIndex = 0; cIndex < rowData.length; cIndex++) {
                    const valToSet = rowData[cIndex];
                    const targetCol = x + cIndex;

                    if (targetCol >= columns.length) continue;

                    const colDef = columns[targetCol];
                    updatedRow[colDef.id] = valToSet;
                    rowHasChanges = true;
                }

                if (rowHasChanges) {
                    newRows[originalIdx] = updatedRow;
                    hasChanges = true;
                    addedDirtyIndices.add(originalIdx);
                }
            }
            return newRows;
        });

        if (hasChanges) {
            setDirtyRows(prev => {
                const next = new Set(prev);
                addedDirtyIndices.forEach(idx => next.add(idx));
                return next;
            });
        }
        return true;
    }, [filteredVendors, columns, isEditMode]);

    const onDelete = useCallback((selection) => {
        if (!isEditMode) return true;
        if (!selection || (!selection.current && !selection.rows && !selection.columns)) return true;

        const addedDirtyIndices = new Set();
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
                        addedDirtyIndices.add(originalIdx);
                    }
                }
            }

            return newRows;
        });

        if (addedDirtyIndices.size > 0) {
            setDirtyRows(prev => {
                const next = new Set(prev);
                addedDirtyIndices.forEach(idx => next.add(idx));
                return next;
            });
        }

        return true;
    }, [filteredVendors, columns, isEditMode]);

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
                    <h1 className="text-4xl font-bold text-gray-900 tracking-tight">Vendor Manager</h1>
                    <p className="text-gray-500 text-sm mt-1">Manage vendor details entirely inside this grid workspace.</p>
                </div>
                <div className="flex gap-3">
                    {isEditMode ? (
                        <>
                            <button
                                onClick={handleCancelEdit}
                                className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-md font-medium text-sm hover:bg-gray-50 transition"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSave}
                                disabled={isSaving}
                                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-md font-medium text-sm hover:bg-green-700 transition disabled:opacity-50"
                            >
                                <Save className="w-4 h-4" />
                                {isSaving ? 'Saving...' : 'Save Changes'}
                            </button>
                        </>
                    ) : (
                        <button
                            onClick={() => setIsEditMode(true)}
                            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-md font-medium text-sm hover:bg-indigo-700 transition"
                        >
                            Edit Mode
                        </button>
                    )}
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

            {
                feedback.message && (
                    <div className={`p-4 rounded-md flex items-center gap-3 text-sm font-medium ${feedback.type === 'error' ? 'bg-red-50 text-red-800' : 'bg-green-50 text-green-800'}`}>
                        {feedback.type === 'success' && <CheckCircle2 className="w-5 h-5 text-green-500" />}
                        <span>{feedback.message}</span>
                    </div>
                )
            }

            {/* Delete Confirmation Modal */}
            {deleteModalState.isOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                    <div className="bg-white rounded-xl shadow-xl max-w-lg w-full overflow-hidden flex flex-col">
                        <div className="p-5 border-b border-gray-100 bg-red-50 text-red-800 flex items-center gap-3">
                            <Trash2 className="w-5 h-5" />
                            <h2 className="font-bold text-lg">⚠️ Linked Domains Detected</h2>
                        </div>
                        <div className="p-6">
                            <p className="text-gray-700 font-medium mb-3">
                                Deleting this vendor will <span className="text-red-600 font-bold">automatically unlink</span> the following {deleteModalState.linkedDomains.length} domain(s):
                            </p>
                            <div className="bg-gray-50 border border-gray-200 rounded-md p-3 max-h-48 overflow-y-auto mb-4">
                                <ul className="list-disc list-inside text-sm text-gray-600 space-y-1">
                                    {deleteModalState.linkedDomains.map(d => (
                                        <li key={d.id} className="truncate">{d.url}</li>
                                    ))}
                                </ul>
                            </div>
                            <p className="text-sm text-gray-500">
                                The domains will remain in the database but will no longer be associated with any vendor. This action cannot be undone.
                            </p>
                        </div>
                        <div className="p-4 border-t border-gray-100 bg-gray-50 flex justify-end gap-3">
                            <button
                                onClick={() => setDeleteModalState({ isOpen: false, linkedDomains: [], vendorIdsToDelete: [], isLoading: false })}
                                disabled={deleteModalState.isLoading}
                                className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 bg-gray-100 rounded-md transition disabled:opacity-50"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => executeDelete(deleteModalState.vendorIdsToDelete)}
                                disabled={deleteModalState.isLoading}
                                className="px-4 py-2 text-sm font-medium text-white hover:bg-red-700 bg-red-600 rounded-md transition flex items-center gap-2 disabled:opacity-50"
                            >
                                {deleteModalState.isLoading && <RefreshCw className="w-4 h-4 animate-spin" />}
                                {deleteModalState.isLoading ? 'Deleting...' : 'Unlink & Delete Vendor'}
                            </button>
                        </div>
                    </div>
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

                    {/* Status Badge */}
                    <div className="flex items-center gap-4">
                        {isEditMode && (
                            <span className="text-xs font-bold text-indigo-600 uppercase tracking-widest animate-pulse">
                                Edit Mode Active ({dirtyRows.size} changes)
                            </span>
                        )}
                        <div className="flex items-center gap-2 bg-white px-4 py-2 border border-gray-200 rounded-md shadow-sm">
                            {isSaving ? (
                                <>
                                    <RefreshCw className="w-4 h-4 animate-spin text-indigo-500" />
                                    <span className="text-sm font-medium text-indigo-700">Saving...</span>
                                </>
                            ) : lastSavedAt ? (
                                <>
                                    <CheckCircle2 className="w-4 h-4 text-green-500" />
                                    <span className="text-sm font-medium text-green-700">
                                        Last Saved: {lastSavedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                                    </span>
                                </>
                            ) : (
                                <span className="text-sm font-medium text-gray-400">Database Synced</span>
                            )}
                        </div>
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
                        key={isEditMode}
                        width="100%"
                        height="100%"
                        getCellContent={getCellContent}
                        columns={columns}
                        rows={filteredVendors.length + (isEditMode ? 1 : 0)}
                        onCellEdited={onCellEdited}
                        onDelete={onDelete}
                        onGridSelectionChange={setSelection}
                        gridSelection={selection}
                        onPaste={onPaste}
                        onKeyDown={onKeyDown}
                        smoothScrollX={true}
                        smoothScrollY={true}
                        rowMarkers="both"
                    />
                </div>
                <div className="px-6 py-3 bg-gray-50 border-t border-gray-200 text-xs font-medium text-gray-500 shrink-0">
                    Showing {filteredVendors.length} vendors
                </div>
            </div>
        </div >
    );
}
