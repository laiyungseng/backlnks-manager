'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { getDomains, saveDomains, deleteDomains, uploadDomainMetrics } from './actions';
import { DataEditor, GridCellKind, CompactSelection } from '@glideapps/glide-data-grid';
import * as XLSX from 'xlsx';
import { useRef } from 'react';
import '@glideapps/glide-data-grid/dist/index.css';
import { Filter, Globe, Save, RefreshCw, Trash2, CheckCircle2, Upload } from 'lucide-react';

export default function DomainsManager() {
    const [domains, setDomains] = useState([]);
    const [vendorOptions, setVendorOptions] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [lastSavedAt, setLastSavedAt] = useState(null);
    const [feedback, setFeedback] = useState({ type: '', message: '' });

    // Edit Mode & Change Tracking
    const [isEditMode, setIsEditMode] = useState(false);
    const [dirtyRows, setDirtyRows] = useState(new Set());

    // Filtering states
    const [isFilterActive, setIsFilterActive] = useState(false);
    const [filters, setFilters] = useState({
        domain_url: '', vendor_id: '', domain_rating: '', traffic: '', domain_age: '', spam_score: '', last_checked_at: ''
    });

    // Grid states
    const [selection, setSelection] = useState(undefined);
    const fileInputRef = useRef(null);

    useEffect(() => {
        fetchDomains();
    }, []);

    const fetchDomains = async () => {
        setIsLoading(true);
        const result = await getDomains();
        if (result.success) {
            setDomains(result.domains || []);
            setVendorOptions(result.vendorOptions || []);
            setDirtyRows(new Set());
        } else {
            showFeedback('error', result.message || 'Failed to load domains');
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
        const rowsToSave = domains.filter((_, idx) => dirtyRows.has(idx));
        const result = await saveDomains(rowsToSave);

        if (result.success) {
            showFeedback('success', 'Changes saved successfully.');
            setLastSavedAt(new Date());
            setDirtyRows(new Set());
            setIsEditMode(false);

            // Refresh list to grab any generated UUIDs for new records and sync state
            await fetchDomains();
        } else {
            showFeedback('error', result.message || 'Failed to save.');
        }
        setIsSaving(false);
    };

    const handleCancelEdit = () => {
        if (dirtyRows.size > 0 && !confirm('Discard unsaved changes?')) return;
        setIsEditMode(false);
        setDirtyRows(new Set());
        fetchDomains(); // Revert to DB state
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
            const { y, height } = selection.current.range;
            for (let i = y; i < y + height; i++) {
                rowsToDelete.push(i);
            }
        }

        if (rowsToDelete.length === 0) {
            return showFeedback('error', 'Select rows to delete.');
        }

        if (!confirm(`Are you sure you want to delete ${rowsToDelete.length} row(s)?`)) return;

        // Map row indices to IDs
        const domainIdsToDelete = rowsToDelete.map(idx => filteredDomains[idx]?.id).filter(Boolean);

        // If the user selects a new, unsaved row, just remove it from state locally
        const rowsRemaining = domains.filter(v => !domainIdsToDelete.includes(v.id));

        setIsSaving(true);
        const result = await deleteDomains(domainIdsToDelete);

        if (result.success) {
            setDomains(rowsRemaining);
            setSelection(undefined);
            showFeedback('success', result.message);
            // Sync dirty rows after deletion
            setDirtyRows(new Set());
        } else {
            showFeedback('error', result.message);
        }
        setIsSaving(false);
    };

    const handleFileUpload = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsSaving(true);
        setFeedback({ type: '', message: 'Processing file...' });

        try {
            const data = await file.arrayBuffer();
            const workbook = XLSX.read(data);
            const sheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];
            
            // Raw json array of objects
            const rawData = XLSX.utils.sheet_to_json(worksheet);

            if (rawData.length === 0) {
                showFeedback('error', 'The uploaded file is empty.');
                setIsSaving(false);
                if (fileInputRef.current) fileInputRef.current.value = '';
                return;
            }

            // Normalizing mapped headers
            const mappedRows = rawData.map(row => {
                // Try multiple common header names for each column
                const getVal = (keys) => {
                    for (const key of keys) {
                        // Case insensitive search
                        const matchingKey = Object.keys(row).find(k => k.toLowerCase().trim() === key.toLowerCase());
                        if (matchingKey) return row[matchingKey];
                    }
                    return undefined;
                };

                return {
                    domain_url: getVal(['Domain URL', 'URL', 'Domain']),
                    domain_rating: getVal(['DR', 'Domain Rating']),
                    traffic: getVal(['Traffic', 'Monthly Traffic']),
                    domain_age: getVal(['Age', 'Domain Age']),
                    spam_score: getVal(['Spam Score', 'SS'])
                };
            }).filter(r => r.domain_url); // Drop rows without an explicit Domain URL

            if (mappedRows.length === 0) {
                showFeedback('error', 'No valid Domain URLs found in the uploaded file. Check your column headers (e.g., "Domain URL").');
                setIsSaving(false);
                if (fileInputRef.current) fileInputRef.current.value = '';
                return;
            }

            const result = await uploadDomainMetrics(mappedRows);
            if (result.success) {
                showFeedback('success', result.message);
                await fetchDomains(); // Reload fully
            } else {
                showFeedback('error', result.message);
            }
        } catch (error) {
            console.error("File upload error:", error);
            showFeedback('error', 'An error occurred while parsing the file.');
        } finally {
            setIsSaving(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    // Create a blank row template
    const createNewRow = () => ({
        id: `new_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        vendor_id: null,
        vendors: null,
        domain_url: '',
        domain_rating: null,
        traffic: null,
        domain_age: null,
        spam_score: null,
        last_checked_at: new Date().toISOString()
    });

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
            domain_url: buildUnique('domain_url'),
            vendor_id: buildUnique('vendor_id'),
            domain_rating: buildUnique('domain_rating'),
            traffic: buildUnique('traffic'),
            domain_age: buildUnique('domain_age'),
            spam_score: buildUnique('spam_score'),
            last_checked_at: buildUnique('last_checked_at')
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
        const colDef = columns[col];
        const field = colDef.id;

        // Trailing Row for new data entry
        if (row === filteredDomains.length) {
            return {
                kind: GridCellKind.Text,
                data: "",
                displayData: "",
                allowOverlay: true,
                readonly: false,
                placeholder: `+ Add ${colDef.title}`
            };
        }

        const dataRow = filteredDomains[row];
        if (!dataRow) {
            return { kind: GridCellKind.Text, data: "", displayData: "", allowOverlay: false, readonly: true };
        }

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
                allowOverlay: isEditMode,
                data: displayVendor,
                displayData: displayVendor,
                readonly: !isEditMode
            };
        }

        const val = String(dataRow[field] ?? '');

        // For numbers, align them to right or left if preferred, text defaults left
        const isNumber = ['domain_rating', 'traffic', 'domain_age', 'spam_score'].includes(field);

        return {
            kind: GridCellKind.Text,
            data: val,
            displayData: val,
            allowOverlay: isEditMode,
            contentAlign: isNumber ? 'right' : 'left',
            readonly: !isEditMode
        };
    }, [filteredDomains, columns, vendorOptions, isEditMode]);

    const onCellEdited = useCallback((cell, newValue) => {
        if (!isEditMode) return;
        const [col, row] = cell;
        const colDef = columns[col];
        const field = colDef.id;
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

        // Detection for new row entry (trailing row)
        if (row === filteredDomains.length) {
            const newRow = createNewRow();
            newRow[field] = valToSet;

            setDomains(prev => {
                const updated = [...prev, newRow];
                setDirtyRows(d => new Set(d).add(updated.length - 1));
                return updated;
            });
            return;
        }

        const dataRow = filteredDomains[row];
        if (!dataRow) return;

        const originalIdx = domains.findIndex(d => d.id === dataRow.id);
        if (originalIdx === -1) return;

        setDomains(prev => {
            const newRows = [...prev];
            // Auto-update Last Checked At when any field changes
            let updatedRow = {
                ...newRows[originalIdx],
                [field]: valToSet,
                last_checked_at: new Date().toISOString()
            };

            // Update the joined object visually for grid render without server roundtrip
            if (field === 'vendor_id') {
                const mVendor = vendorOptions.find(v => v.id === valToSet);
                updatedRow.vendors = mVendor ? { vendor_name: mVendor.vendor_name } : null;
            }

            newRows[originalIdx] = updatedRow;
            return newRows;
        });

        setDirtyRows(prev => {
            const next = new Set(prev);
            next.add(originalIdx);
            return next;
        });
    }, [filteredDomains, columns, domains, vendorOptions, isEditMode]);

    const onPaste = useCallback((target, values) => {
        if (!isEditMode) return false;
        const [x, y] = target;
        let hasChanges = false;
        const addedDirtyIndices = new Set();

        setDomains(prevRows => {
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
                    const dataRow = filteredDomains[targetRow] || newRows[targetRow];
                    originalIdx = newRows.findIndex(d => d.id === dataRow.id);
                }

                if (originalIdx === -1) continue;

                let updatedRow = { ...newRows[originalIdx] };
                let rowHasChanges = false;

                for (let cIndex = 0; cIndex < rowData.length; cIndex++) {
                    let valToSet = rowData[cIndex];
                    const targetCol = x + cIndex;

                    if (targetCol >= columns.length) continue;

                    const colDef = columns[targetCol];
                    const field = colDef.id;

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
    }, [filteredDomains, columns, vendorOptions, isEditMode]);

    const onDelete = useCallback((selection) => {
        if (!isEditMode) return true;
        if (!selection || (!selection.current && !selection.rows && !selection.columns)) return true;

        const addedDirtyIndices = new Set();
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

                        // Clear the cell content based on type
                        if (['domain_rating', 'traffic', 'domain_age', 'spam_score'].includes(colDef.id)) {
                            updatedRow[colDef.id] = null;
                        } else {
                            updatedRow[colDef.id] = '';
                        }

                        if (colDef.id === 'vendor_id') {
                            updatedRow.vendors = null;
                        }
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
    }, [filteredDomains, columns, isEditMode]);

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
                    <h1 className="text-4xl font-bold text-gray-900 tracking-tight">Domains Manager</h1>
                    <p className="text-gray-500 text-sm mt-1">Manage all publisher domains, metrics, and map them to existing vendors.</p>
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
                        <>
                            <input 
                                type="file" 
                                accept=".xlsx, .xls, .csv" 
                                className="hidden" 
                                ref={fileInputRef}
                                onChange={handleFileUpload}
                            />
                            <button
                                onClick={() => fileInputRef.current?.click()}
                                disabled={isSaving}
                                className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-md font-medium text-sm hover:bg-gray-50 transition disabled:opacity-50"
                            >
                                <Upload className="w-4 h-4" />
                                Upload Metrics
                            </button>

                            <button
                                onClick={() => setIsEditMode(true)}
                                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-md font-medium text-sm hover:bg-indigo-700 transition"
                            >
                                Edit Mode
                            </button>
                        </>
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
                        key={isEditMode}
                        width="100%"
                        height="100%"
                        getCellContent={getCellContent}
                        columns={columns}
                        rows={filteredDomains.length + (isEditMode ? 1 : 0)}
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
                    Showing {filteredDomains.length} domains
                </div>
            </div>
        </div>
    );
}
