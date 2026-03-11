'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { saveVendorProgress, toggleUrlEntryMode } from './actions';
import { CheckCircle2, FileSpreadsheet, RefreshCw, Filter, ChevronDown, ChevronRight, Calendar, Lock, Unlock, Link } from 'lucide-react';
import { DataEditor, GridCellKind } from '@glideapps/glide-data-grid';
import '@glideapps/glide-data-grid/dist/index.css';

export default function VendorForm({ initialRows, projectHash, dripfeedEnabled, dripfeedPeriod, urlsPerDay, isLocked = false, urlEntryEnabled = true }) {
    const [rows, setRows] = useState(initialRows || []);
    const [isSaving, setIsSaving] = useState(false);
    const [lastSavedAt, setLastSavedAt] = useState(null);
    const [isDirty, setIsDirty] = useState(false);
    const [feedback, setFeedback] = useState({ type: '', message: '' });

    // Live Toggle State
    const [localUrlEntryEnabled, setLocalUrlEntryEnabled] = useState(urlEntryEnabled);

    // Filter Features States
    const [isFilterActive, setIsFilterActive] = useState(false);
    const [filters, setFilters] = useState({ target_url: '', anchor_text: '', published_url: '', remark: '', indexed_status: '' });

    // Compute unique dropdown options from rows
    const uniqueOptions = useMemo(() => {
        return {
            target_url: [...new Set(rows.map(r => r.target_url).filter(Boolean))],
            anchor_text: [...new Set(rows.map(r => r.anchor_text).filter(Boolean))],
            remark: [...new Set(rows.map(r => r.remark || '').filter(Boolean))],
            published_url: [...new Set(rows.map(r => r.published_url).filter(Boolean))],
            indexed_status: [...new Set(rows.map(r => r.indexed_status || '').filter(Boolean))]
        };
    }, [rows]);

    // Auto-save effect
    useEffect(() => {
        if (!isDirty) return;

        const timer = setTimeout(() => {
            handleSaveProgress(true);
        }, 1000);

        return () => clearTimeout(timer);
    }, [rows, isDirty]);

    // Dripfeed specific metrics
    const [urlsSubmittedToday, setUrlsSubmittedToday] = useState(0);

    // Calculate today's submissions for Dripfeed
    useEffect(() => {
        if (dripfeedEnabled) {
            const today = new Date().toISOString().split('T')[0];
            const submittedToday = rows.filter(r => {
                if (!r.published_date) return false;
                // The app saves dates in 'YYYY-MM-DD HH:mm:ss' format (no 'T')
                return r.published_date.split(' ')[0] === today && r.published_url.trim() !== '';
            }).length;
            setUrlsSubmittedToday(submittedToday);
        }
    }, [rows, dripfeedEnabled]);

    // Helper to format ISO without T and MS (YYYY-MM-DD HH:mm:ss)
    const getISOFormat = () => {
        const now = new Date();
        return now.toISOString().replace('T', ' ').substring(0, 19);
    };

    // Helper — extract domain from a URL string
    const parseDomainUrl = (url) => {
        if (!url) return '';
        try {
            const u = new URL(url);
            return `${u.protocol}//${u.hostname}/`;
        } catch {
            return '';
        }
    };

    const handleSaveProgress = async (isAutoSave = false) => {
        setIsSaving(true);
        if (!isAutoSave) setFeedback({ type: '', message: '' });

        if (isLocked) return; // Prevent saving when locked

        const rowsToUpdate = rows.map(r => ({
            id: r.id,
            target_id: r.target_id,
            target_url: r.target_url,
            anchor_text: r.anchor_text,
            language: r.language || '',
            domain_url: r.domain_url || '',
            published_url: r.published_url || '',
            published_date: r.published_date || '',
            remark: r.remark || '',
            indexed_status: r.indexed_status || ''
        }));

        try {
            const result = await saveVendorProgress(projectHash, rowsToUpdate);

            if (result.success) {
                if (!isAutoSave) setFeedback({ type: 'success', message: result.message });
                setLastSavedAt(new Date());
                setIsDirty(false);
            } else {
                setFeedback({ type: 'error', message: result.message });
            }
        } catch (e) {
            setFeedback({ type: 'error', message: 'Network error communicating with the server.' });
        } finally {
            setIsSaving(false);
            if (!isAutoSave && feedback.type !== 'error') {
                setTimeout(() => setFeedback({ type: '', message: '' }), 4000);
            }
        }
    };

    const handleToggleUrlEntry = async () => {
        if (isLocked) return;
        const newValue = !localUrlEntryEnabled;
        setLocalUrlEntryEnabled(newValue);

        const result = await toggleUrlEntryMode(projectHash, newValue);
        if (!result.success) {
            // Revert on failure
            setLocalUrlEntryEnabled(!newValue);
            setFeedback({ type: 'error', message: result.message });
        } else {
            setFeedback({ type: 'success', message: `URL Entry Mode ${newValue ? 'Enabled' : 'Disabled'}` });
            setTimeout(() => setFeedback({ type: '', message: '' }), 4000);
        }
    };

    // Calculate Anchor Text Metrics
    const anchorMetrics = useMemo(() => {
        const metrics = {};
        rows.forEach(r => {
            if (!metrics[r.anchor_text]) {
                metrics[r.anchor_text] = { total: 0, submitted: 0 };
            }
            metrics[r.anchor_text].total += 1;
            if (r.published_url && r.published_date) {
                metrics[r.anchor_text].submitted += 1;
            }
        });
        return Object.entries(metrics).map(([anchor, data]) => ({
            anchor,
            ...data,
            progress: Math.round((data.submitted / data.total) * 100)
        }));
    }, [rows]);

    // Apply exact-match Filters for the dropdowns
    const filteredRows = useMemo(() => {
        if (!isFilterActive) return rows;
        return rows.filter(r => {
            const matchTarget = !filters.target_url || r.target_url === filters.target_url;
            const matchAnchor = !filters.anchor_text || r.anchor_text === filters.anchor_text;
            const matchPublished = !filters.published_url || r.published_url === filters.published_url;

            const rRemark = r.remark || '';
            const matchRemark = !filters.remark || rRemark === filters.remark;

            const rIndexStatus = r.indexed_status || '';
            const matchIndexStatus = !filters.indexed_status || rIndexStatus === filters.indexed_status;

            return matchTarget && matchAnchor && matchPublished && matchRemark && matchIndexStatus;
        });
    }, [rows, isFilterActive, filters]);

    const handleFilterChange = (field, value) => {
        setFilters(prev => ({ ...prev, [field]: value }));
    };

    const completedCount = rows.filter(r => r.published_url && r.published_date).length;
    const [showMetrics, setShowMetrics] = useState(false);
    const [isMounted, setIsMounted] = useState(false);
    const [selection, setSelection] = useState(undefined);

    useEffect(() => {
        setIsMounted(true);
    }, []);

    const progressPercent = rows.length > 0 ? Math.round((completedCount / rows.length) * 100) : 0;

    const columns = useMemo(() => [
        { title: "Domain URL", id: "domain_url", width: 220 },
        { title: "Target URL", id: "target_url", width: 250 },
        { title: "Anchor Text", id: "anchor_text", width: 200 },
        { title: "Language", id: "language", width: 100 },
        { title: "Remark", id: "remark", width: 150 },
        { title: "Published URL", id: "published_url", width: 300 },
        { title: "Published Date", id: "published_date", width: 180 },
        { title: "Index Status", id: "indexed_status", width: 180 }
    ], []);

    const getCellContent = useCallback((cell) => {
        const [col, row] = cell;
        const dataRow = filteredRows[row];

        if (!dataRow) {
            return {
                kind: GridCellKind.Text,
                data: "",
                displayData: "",
                allowOverlay: false
            };
        }

        const colDef = columns[col];

        switch (colDef.id) {
            case "domain_url":
                const displayDomain = !localUrlEntryEnabled && dataRow.published_url
                    ? parseDomainUrl(dataRow.published_url)
                    : (dataRow.domain_url || "");
                return {
                    kind: GridCellKind.Text,
                    data: displayDomain,
                    displayData: displayDomain,
                    allowOverlay: true,
                    readonly: !localUrlEntryEnabled || isLocked
                };
            case "target_url":
                return {
                    kind: GridCellKind.Text,
                    data: dataRow.target_url || "",
                    displayData: dataRow.target_url || "",
                    allowOverlay: true,
                    readonly: true
                };
            case "anchor_text":
                return {
                    kind: GridCellKind.Text,
                    data: dataRow.anchor_text || "",
                    displayData: dataRow.anchor_text || "",
                    allowOverlay: true,
                    readonly: true
                };
            case "language":
                return {
                    kind: GridCellKind.Text,
                    data: dataRow.language || "",
                    displayData: dataRow.language || "",
                    allowOverlay: true,
                    readonly: true
                };
            case "remark":
                return {
                    kind: GridCellKind.Text,
                    data: dataRow.remark || "",
                    displayData: dataRow.remark || "",
                    allowOverlay: !isLocked,
                    readonly: isLocked
                };
            case "published_url":
                return {
                    kind: GridCellKind.Text,
                    data: dataRow.published_url || "",
                    displayData: dataRow.published_url || "",
                    allowOverlay: !isLocked,
                    readonly: isLocked
                };
            case "published_date":
                return {
                    kind: GridCellKind.Text,
                    data: dataRow.published_date || "",
                    displayData: dataRow.published_date || "",
                    allowOverlay: true,
                    readonly: true
                };
            case "indexed_status":
                return {
                    kind: GridCellKind.Text,
                    data: dataRow.indexed_status || "",
                    displayData: dataRow.indexed_status || "",
                    allowOverlay: !isLocked,
                    readonly: isLocked
                };
            default:
                return {
                    kind: GridCellKind.Text,
                    data: "",
                    displayData: "",
                    allowOverlay: false
                };
        }
    }, [filteredRows, columns]);

    const onCellEdited = useCallback((cell, newValue) => {
        if (isLocked) return; // Block edits when locked
        const [col, row] = cell;
        const dataRow = filteredRows[row];
        if (!dataRow) return;

        const colDef = columns[col];
        const field = colDef.id;

        if (field === 'domain_url' && !localUrlEntryEnabled) return; // Block explicit edits if toggle is off

        const originalIdx = rows.findIndex(r => r.id === dataRow.id);
        if (originalIdx === -1) return;

        let valToSet = newValue.data;

        // If manual URL entry is enabled, ensure typed/pasted URLs into domain_url are cleanly parsed
        if (field === 'domain_url') {
            valToSet = parseDomainUrl(valToSet) || valToSet;
        }

        setRows(prevRows => {
            const newRows = [...prevRows];
            const updatedRow = { ...newRows[originalIdx], [field]: valToSet };

            // AUTO-LOGIC: Published URL & Date & Auto-Domain
            if (field === 'published_url') {
                if (valToSet && valToSet.trim() !== '') {
                    if (!updatedRow.published_date) {
                        updatedRow.published_date = getISOFormat();
                    }
                    if (!localUrlEntryEnabled) {
                        updatedRow.domain_url = parseDomainUrl(valToSet);
                    }
                } else {
                    updatedRow.published_date = '';
                    if (!localUrlEntryEnabled) {
                        updatedRow.domain_url = '';
                    }
                }
            }

            newRows[originalIdx] = updatedRow;
            return newRows;
        });

        setIsDirty(true);
    }, [filteredRows, columns, rows]);

    const onPaste = useCallback((target, values) => {
        if (isLocked) return false;
        const [x, y] = target;

        let hasChanges = false;

        setRows(prevRows => {
            const newRows = [...prevRows];

            for (let rIndex = 0; rIndex < values.length; rIndex++) {
                const rowData = values[rIndex];
                const targetRow = y + rIndex;

                if (targetRow >= filteredRows.length) continue;

                const dataRow = filteredRows[targetRow];
                const originalIdx = newRows.findIndex(r => r.id === dataRow.id);
                if (originalIdx === -1) continue;

                let updatedRow = { ...newRows[originalIdx] };
                let rowHasChanges = false;

                for (let cIndex = 0; cIndex < rowData.length; cIndex++) {
                    const valToSet = rowData[cIndex];
                    const targetCol = x + cIndex;

                    if (targetCol >= columns.length) continue;

                    const colDef = columns[targetCol];
                    const field = colDef.id;

                    // Only map allowed editable columns
                    const allowedEditFields = ["remark", "published_url", "indexed_status"];
                    if (localUrlEntryEnabled) allowedEditFields.push("domain_url");

                    if (allowedEditFields.includes(field)) {
                        // If manually pasting directly into domain_url, parse it cleanly
                        let finalVal = valToSet;
                        if (field === 'domain_url') {
                            finalVal = parseDomainUrl(finalVal) || finalVal;
                        }

                        updatedRow[field] = finalVal;
                        rowHasChanges = true;

                        // Apply Auto-logic
                        if (field === 'published_url') {
                            if (valToSet && valToSet.trim() !== '') {
                                if (!updatedRow.published_date) {
                                    updatedRow.published_date = getISOFormat();
                                }
                                if (!localUrlEntryEnabled) {
                                    updatedRow.domain_url = parseDomainUrl(valToSet);
                                }
                            } else {
                                updatedRow.published_date = '';
                                if (!localUrlEntryEnabled) {
                                    updatedRow.domain_url = '';
                                }
                            }
                        }
                    }
                }

                if (rowHasChanges) {
                    newRows[originalIdx] = updatedRow;
                    hasChanges = true;
                }
            }

            return newRows;
        });

        if (hasChanges) {
            setIsDirty(true);
        }

        return true;
    }, [filteredRows, columns, isLocked]);


    const onDelete = useCallback((selection) => {
        if (isLocked) return true; // Block deletion when locked
        if (!selection || (!selection.current && !selection.rows && !selection.columns)) return true;

        setRows(prevRows => {
            const newRows = [...prevRows];
            let hasChanges = false;

            if (selection.current && selection.current.range) {
                const { x: startCol, y: startRow, width, height } = selection.current.range;
                const endCol = startCol + width;
                const endRow = startRow + height;

                for (let rowIdx = startRow; rowIdx < endRow; rowIdx++) {
                    const dataRow = filteredRows[rowIdx];
                    if (!dataRow) continue;

                    const originalIdx = newRows.findIndex(r => r.id === dataRow.id);
                    if (originalIdx === -1) continue;

                    let updatedRow = { ...newRows[originalIdx] };
                    let rowChanged = false;

                    for (let colIdx = startCol; colIdx < endCol; colIdx++) {
                        const colDef = columns[colIdx];
                        if (!colDef) continue;

                        const field = colDef.id;

                        // Only allow clearing editable data columns
                        const allowedClearFields = ['published_url', 'remark', 'indexed_status'];
                        if (localUrlEntryEnabled) allowedClearFields.push("domain_url");

                        if (allowedClearFields.includes(field)) {
                            updatedRow[field] = '';
                            rowChanged = true;

                            if (field === 'published_url') {
                                updatedRow.published_date = '';
                                if (!localUrlEntryEnabled) {
                                    updatedRow.domain_url = '';
                                }
                            }
                        }
                    }

                    if (rowChanged) {
                        newRows[originalIdx] = updatedRow;
                        hasChanges = true;
                    }
                }
            }

            if (hasChanges) {
                setTimeout(() => setIsDirty(true), 0);
                return newRows;
            }

            return prevRows;
        });

        return true;
    }, [filteredRows, columns, setIsDirty]);

    const onKeyDown = useCallback((event) => {
        if (event.key === 'Backspace' && selection && (selection.current || selection.columns || selection.rows)) {
            // Trigger the multi-delete logic manually
            onDelete(selection);
        }
    }, [selection, onDelete]);

    if (rows.length === 0) {
        return (
            <div className="flex items-center justify-center p-12 bg-white rounded-xl shadow-sm border border-gray-200 mt-8">
                <div className="text-center">
                    <h3 className="text-lg font-medium text-gray-900 mb-2">No Active Targets</h3>
                    <p className="text-gray-500 text-sm">
                        This workflow environment has not been provisioned with target links. Please contact your administrator.
                    </p>
                </div>
            </div>
        )
    }

    return (
        <div className="mt-8 space-y-6">

            {/* Lock Banner */}
            {isLocked && (
                <div className="flex items-center gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl shadow-sm">
                    <Lock className="w-5 h-5 text-amber-600 flex-shrink-0" />
                    <div>
                        <p className="text-sm font-semibold text-amber-900">This project is locked</p>
                        <p className="text-xs text-amber-700">Editing is disabled. Contact your administrator to unlock this project.</p>
                    </div>
                </div>
            )}

            {/* Dripfeed Progress Banner (Conditional) */}
            {dripfeedEnabled && (
                <div className="bg-gradient-to-r from-amber-50 to-amber-100/50 border border-amber-200 rounded-xl p-4 sm:p-6 mb-2 shadow-sm">
                    <div className="max-w-4xl mx-auto flex flex-col md:flex-row gap-6 items-center justify-between">
                        <div>
                            <h3 className="text-lg font-bold text-amber-900 flex items-center gap-2">
                                <Calendar className="w-5 h-5 text-amber-600" />
                                Drip Feed Schedule Active
                            </h3>
                            <p className="text-sm text-amber-700 mt-1">Please adhere to the daily submission limits required by the client.</p>
                        </div>
                        <div className="flex gap-4">
                            <div className="bg-white/80 backdrop-blur border border-amber-200/60 rounded-lg p-3 text-center min-w-[120px] shadow-sm">
                                <span className="block text-[10px] font-bold text-amber-600 uppercase tracking-wider mb-1">Today's Quota</span>
                                <div className="flex items-baseline justify-center gap-1">
                                    <span className={`text-2xl font-black ${urlsSubmittedToday >= urlsPerDay ? 'text-green-600' : 'text-amber-900'}`}>{urlsSubmittedToday}</span>
                                    <span className="text-amber-500 font-medium text-sm">/ {urlsPerDay}</span>
                                </div>
                            </div>
                            <div className="bg-white/80 backdrop-blur border border-amber-200/60 rounded-lg p-3 text-center min-w-[120px] shadow-sm">
                                <span className="block text-[10px] font-bold text-amber-600 uppercase tracking-wider mb-1">Total Period</span>
                                <div className="text-2xl font-black text-amber-900">{dripfeedPeriod} <span className="text-sm font-medium text-amber-600">Days</span></div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Header Block: Project Progress with Collapsible Anchor Metrics */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                    <div>
                        <div className="inline-flex items-center gap-2 text-sm font-semibold text-indigo-600 mb-2">
                            <FileSpreadsheet className="w-4 h-4" /> Project Progress
                        </div>
                        <p className="text-gray-600 text-sm max-w-2xl">
                            You can paste a list of URLs directly from Excel or Google Sheets into any row, and the system will automatically flow them downwards.
                        </p>
                    </div>

                    <div className="shrink-0 flex flex-col md:items-end w-full md:w-auto relative">
                        <div className="text-sm font-medium text-gray-500 mb-1 w-full text-right">Overall Fulfillment Progress</div>
                        <div className="flex items-center gap-3">
                            <div className="text-2xl font-bold text-gray-900 w-24 text-right">
                                {completedCount} <span className="text-gray-400 text-lg">/ {rows.length}</span>
                            </div>
                            <div className="w-32 bg-gray-100 rounded-full h-2.5 overflow-hidden border border-gray-200">
                                <div className="bg-indigo-600 h-2.5 transition-all duration-500" style={{ width: `${progressPercent}%` }}></div>
                            </div>
                        </div>
                        {anchorMetrics.length > 0 && (
                            <button
                                onClick={() => setShowMetrics(!showMetrics)}
                                className="mt-2 text-gray-400 hover:text-indigo-600 transition-colors flex items-center justify-end w-full"
                                title="Toggle Anchor Sub-Metrics"
                            >
                                {showMetrics ? <ChevronDown className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
                            </button>
                        )}
                    </div>
                </div>

                {/* Submetrics Panel - Collapses down just like the UI mock */}
                {showMetrics && anchorMetrics.length > 0 && (
                    <div className="w-full pt-6 tracking-wide mt-2 border-t border-gray-100">
                        <div className="text-[11px] font-bold text-gray-500 uppercase tracking-widest mb-4">
                            Anchor Sub-Metrics
                        </div>
                        <div className="flex flex-wrap gap-4">
                            {anchorMetrics.map((metric, idx) => (
                                <div key={idx} className="flex items-center justify-between gap-4 bg-white border border-gray-200 rounded-lg px-4 py-3 min-w-[220px] shadow-sm">
                                    <div className="text-xs font-mono font-medium text-gray-700 truncate max-w-[120px]" title={metric.anchor}>
                                        {metric.anchor}
                                    </div>
                                    <div className="flex flex-col items-end shrink-0">
                                        <div className="flex items-baseline gap-1 mb-1">
                                            <span className="text-sm font-bold text-gray-900">{metric.submitted}</span>
                                            <span className="text-xs text-gray-400 font-medium">/ {metric.total}</span>
                                        </div>
                                        <div className="w-16 bg-gray-100 rounded-full h-1 overflow-hidden">
                                            <div
                                                className={`h-1 rounded-full ${metric.progress === 100 ? 'bg-indigo-400' : 'bg-indigo-600'}`}
                                                style={{ width: `${metric.progress}%` }}
                                            ></div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* Notification Banner */}
            {feedback.message && (
                <div className={`p-4 rounded-md flex items-center gap-3 text-sm font-medium ${feedback.type === 'error' ? 'bg-red-50 text-red-800 border border-red-200' : 'bg-green-50 text-green-800 border border-green-200'
                    }`}>
                    {feedback.type === 'success' && <CheckCircle2 className="w-5 h-5 text-green-500" />}
                    <span>{feedback.message}</span>
                </div>
            )}

            {/* Clean Spreadsheet Component */}
            <div className="bg-white rounded-md shadow-sm border border-gray-200 overflow-hidden flex flex-col h-[700px] max-h-[75vh]">

                {/* Top Action Strip (Auto-Save Status & Filter Toggle) */}
                <div className="px-6 py-4 border-b border-gray-200 bg-gray-50 flex flex-col sm:flex-row items-center justify-between gap-4 shrink-0">
                    <button
                        onClick={() => setIsFilterActive(!isFilterActive)}
                        className={`flex items-center justify-center sm:justify-start w-full sm:w-auto gap-2 px-4 py-2 rounded-md text-sm font-semibold transition-colors border shadow-sm ${isFilterActive ? 'bg-indigo-600 text-white border-indigo-700' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                            }`}
                    >
                        <Filter className="w-4 h-4" />
                        {isFilterActive ? 'Filters Active' : 'Enable Filters'}
                    </button>

                    <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">

                        {/* URL Entry Mode Toggle */}
                        <div className="flex items-center gap-3 bg-white px-4 py-2 border border-gray-200 rounded-md shadow-sm">
                            <Link className={`w-4 h-4 ${localUrlEntryEnabled ? 'text-indigo-600' : 'text-gray-400'}`} />
                            <span className="text-sm font-semibold tracking-wide text-gray-700">URL Entry</span>
                            <label className="inline-flex items-center cursor-pointer ml-1">
                                <input
                                    type="checkbox"
                                    className="sr-only peer"
                                    checked={localUrlEntryEnabled}
                                    onChange={handleToggleUrlEntry}
                                    disabled={isLocked}
                                />
                                <div className="relative w-9 h-5 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600"></div>
                            </label>
                        </div>

                        {/* Lock / Editable Status Badge */}
                        <div className={`flex items-center justify-center gap-2 px-4 py-2 rounded-md shadow-sm border ${isLocked ? 'bg-amber-100/50 text-amber-800 border-amber-200' : 'bg-green-50 text-green-700 border-green-200'}`}>
                            {isLocked ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
                            <span className="text-sm font-semibold tracking-wide">
                                {isLocked ? 'LOCKED (READ-ONLY)' : 'EDITABLE'}
                            </span>
                        </div>

                        {/* Auto Save Status Indicator */}
                        <div className="flex items-center gap-2 bg-white px-4 py-2 border border-gray-200 rounded-md shadow-sm min-w-[200px] w-full sm:w-auto justify-center">
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
                </div>

                {/* Filters Array Expansion */}
                {isFilterActive && (
                    <div className="px-6 py-4 border-b border-gray-200 bg-white grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 shadow-inner text-sm shrink-0">
                        <div className="flex flex-col gap-1.5">
                            <span className="font-semibold text-[11px] uppercase tracking-wider text-gray-500">Target Authority</span>
                            <select
                                value={filters.target_url}
                                onChange={(e) => handleFilterChange('target_url', e.target.value)}
                                className="px-3 py-2 bg-white border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-shadow"
                            >
                                <option value="">All Targets</option>
                                {uniqueOptions.target_url.map((val, i) => (
                                    <option key={i} value={val}>{val}</option>
                                ))}
                            </select>
                        </div>
                        <div className="flex flex-col gap-1.5">
                            <span className="font-semibold text-[11px] uppercase tracking-wider text-gray-500">Anchor Text</span>
                            <select
                                value={filters.anchor_text}
                                onChange={(e) => handleFilterChange('anchor_text', e.target.value)}
                                className="px-3 py-2 bg-white border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-shadow"
                            >
                                <option value="">All Anchors</option>
                                {uniqueOptions.anchor_text.map((val, i) => (
                                    <option key={i} value={val}>{val}</option>
                                ))}
                            </select>
                        </div>
                        <div className="flex flex-col gap-1.5">
                            <span className="font-semibold text-[11px] uppercase tracking-wider text-amber-600">Remark</span>
                            <select
                                value={filters.remark}
                                onChange={(e) => handleFilterChange('remark', e.target.value)}
                                className="px-3 py-2 bg-amber-50/50 border border-amber-300 rounded-md focus:ring-2 focus:ring-amber-500 focus:border-amber-500 text-amber-900 outline-none transition-shadow"
                            >
                                <option value="">All Remarks</option>
                                {uniqueOptions.remark.map((val, i) => (
                                    <option key={i} value={val}>{val}</option>
                                ))}
                            </select>
                        </div>
                        <div className="flex flex-col gap-1.5">
                            <span className="font-semibold text-[11px] uppercase tracking-wider text-indigo-600">Published URL</span>
                            <select
                                value={filters.published_url}
                                onChange={(e) => handleFilterChange('published_url', e.target.value)}
                                className="px-3 py-2 bg-indigo-50/50 border border-indigo-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-indigo-900 outline-none transition-shadow"
                            >
                                <option value="">All Published URLs</option>
                                {uniqueOptions.published_url.map((val, i) => (
                                    <option key={i} value={val}>{val}</option>
                                ))}
                            </select>
                        </div>
                        <div className="flex flex-col gap-1.5">
                            <span className="font-semibold text-[11px] uppercase tracking-wider text-emerald-600">Index Status</span>
                            <select
                                value={filters.indexed_status}
                                onChange={(e) => handleFilterChange('indexed_status', e.target.value)}
                                className="px-3 py-2 bg-emerald-50/50 border border-emerald-300 rounded-md focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-emerald-900 outline-none transition-shadow"
                            >
                                <option value="">All Statuses</option>
                                {uniqueOptions.indexed_status.map((val, i) => (
                                    <option key={i} value={val}>{val}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                )}

                <div className="flex-1 w-full bg-white relative z-0">
                    {isMounted && (
                        <DataEditor
                            width="100%"
                            height="100%"
                            getCellContent={getCellContent}
                            columns={columns}
                            rows={filteredRows.length}
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
                    )}
                </div>
                {/* Fixed Footer below the scroll area */}
                <div className="px-6 py-3 bg-gray-50 border-t border-gray-200 text-xs font-medium text-gray-500 shrink-0 flex justify-between z-10 relative">
                    <span>Showing {filteredRows.length} of {rows.length} rows</span>
                    {isFilterActive && <span>Filters refer to Target Authority, Anchor Text, Last Published, and Remarks</span>}
                </div>
            </div>
        </div>
    );
}
