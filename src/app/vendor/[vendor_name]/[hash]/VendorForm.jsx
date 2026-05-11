'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { saveVendorProgressDelta, toggleUrlEntryMode } from './actions';
import { parseDomainUrl } from '../../../../lib/utils';
import NextLink from 'next/link';
import { CheckCircle2, FileSpreadsheet, RefreshCw, Filter, ChevronDown, ChevronRight, Calendar, Lock, Unlock, Link, AlertCircle } from 'lucide-react';
// Univer is loaded dynamically inside the mount effect — its modules touch
// browser-only globals (e.g. Path2D) at import time and break SSR if statically imported.
import '@univerjs/presets/lib/styles/preset-sheets-core.css';
import '@univerjs/presets/lib/styles/preset-sheets-data-validation.css';

// ---------------------------------------------------------------------------
// Module-level constants (stable, never change)
// ---------------------------------------------------------------------------
const COLS = ['domain_url', 'target_url', 'anchor_text', 'language', 'remark', 'published_url', 'published_date', 'indexed_status', 'indexed_datetime'];
const HEADERS = ['Domain URL', 'Target URL', 'Anchor Text', 'Language', 'Remark', 'Published URL', 'Published Date', 'Index Status', 'Index Checked At'];
const COL_WIDTHS = [220, 250, 200, 100, 150, 300, 180, 180, 200];
// Columns that are always read-only (by col index): target_url=1, anchor_text=2, language=3, published_date=6, indexed_datetime=8
const ALWAYS_READONLY = new Set([1, 2, 3, 6, 8]);
const MUTATION_ID = 'sheet.mutation.set-range-values';
const READONLY_STYLE = 'readonly';
const INDEXED_STATUS_OPTIONS = ['page indexed', 'page not indexed', 'domain not indexed'];

function normalizeIndexStatus(raw) {
    const v = (raw || '').toLowerCase().trim();
    if (!v) return '';
    if (v === 'page indexed' || v === 'indexed') return 'page indexed';
    if (v === 'page not indexed' || v === 'not indexed') return 'page not indexed';
    if (v === 'domain not indexed') return 'domain not indexed';
    if (v.includes('domain')) return 'domain not indexed';
    if (v.includes('not')) return 'page not indexed';
    if (v.includes('index')) return 'page indexed';
    return '';
}

function formatDateDisplay(raw) {
    if (!raw) return '';
    try {
        return new Date(raw.replace(' ', 'T')).toLocaleString(undefined, {
            year: 'numeric', month: '2-digit', day: '2-digit',
            hour: '2-digit', minute: '2-digit', hour12: false,
        });
    } catch { return raw; }
}

function formatIndexedDatetime(raw) {
    if (!raw) return '';
    try {
        return new Date(raw).toLocaleString(undefined, {
            year: 'numeric', month: '2-digit', day: '2-digit',
            hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
        });
    } catch { return raw; }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export default function VendorForm({ initialRows, projectHash, siblingPlans = [], vendorName = '', vendorUuid = '', dripfeedEnabled, dripfeedPeriod, urlsPerDay, isLocked = false, isFinalized = false, urlEntryEnabled = true, initialVersion = 1 }) {
    const buildHashHref = useCallback((h) => vendorUuid
        ? `/vendor/${vendorName}/portal/${vendorUuid}/project/${h}`
        : `/vendor/${vendorName}/${h}`, [vendorName, vendorUuid]);
    const [rows, setRows] = useState(initialRows || []);
    const [isSaving, setIsSaving] = useState(false);
    const [lastSavedAt, setLastSavedAt] = useState(null);
    const [isDirty, setIsDirty] = useState(false);
    const [feedback, setFeedback] = useState({ type: '', message: '' });
    const [version, setVersion] = useState(initialVersion);
    const isDirtyRef = useRef(isDirty);
    const lastSavedRowsRef = useRef(initialRows || []);

    // Local Cache State
    const [hasUnsavedCache, setHasUnsavedCache] = useState(false);
    const [cachedRows, setCachedRows] = useState(null);

    // Live Toggle State
    const [localUrlEntryEnabled, setLocalUrlEntryEnabled] = useState(urlEntryEnabled);

    // Filter Features States
    const [isFilterActive, setIsFilterActive] = useState(false);
    const [filters, setFilters] = useState({ target_url: '', anchor_text: '', published_url: '', remark: '', indexed_status: '' });

    // Univer refs
    const univerAPIRef = useRef(null);
    const univerInstanceRef = useRef(null);
    const rowIdMapRef = useRef([]);
    const isWritingBackRef = useRef(0); // counter: >0 means programmatic write in flight
    const isInitializedRef = useRef(false);
    const prevFilteredLengthRef = useRef(0);

    // Snapshot of row IDs present at mount — anything not in this set was added by the user
    // via Univer typing and should bypass readonly on target_url / anchor_text / language cols.
    const initialRowIdsRef = useRef(new Set((initialRows || []).map(r => r.id)));
    const isUserAddedRow = (rowId) => rowId && !initialRowIdsRef.current.has(rowId);

    // Mutable-value refs (used inside stable Univer command handler)
    const rowsRef = useRef(rows);
    const localUrlEntryEnabledRef = useRef(localUrlEntryEnabled);
    useEffect(() => { rowsRef.current = rows; }, [rows]);
    useEffect(() => { localUrlEntryEnabledRef.current = localUrlEntryEnabled; }, [localUrlEntryEnabled]);

    // Compute unique dropdown options from rows
    const uniqueOptions = useMemo(() => ({
        target_url: [...new Set(rows.map(r => r.target_url).filter(Boolean))],
        anchor_text: [...new Set(rows.map(r => r.anchor_text).filter(Boolean))],
        remark: [...new Set(rows.map(r => r.remark || '').filter(Boolean))],
        published_url: [...new Set(rows.map(r => r.published_url).filter(Boolean))],
        indexed_status: [...new Set(rows.map(r => r.indexed_status || '').filter(Boolean))],
    }), [rows]);

    // Dripfeed specific metrics
    const [urlsSubmittedToday, setUrlsSubmittedToday] = useState(0);
    useEffect(() => {
        if (dripfeedEnabled) {
            const today = new Date().toISOString().split('T')[0];
            const submittedToday = rows.filter(r => {
                if (!r.published_date) return false;
                return r.published_date.split(' ')[0] === today && r.published_url.trim() !== '';
            }).length;
            setUrlsSubmittedToday(submittedToday);
        }
    }, [rows, dripfeedEnabled]);

    // Helper — ISO without T and MS
    const getISOFormat = () => {
        const now = new Date();
        return now.toISOString().replace('T', ' ').substring(0, 19);
    };

    // Auto-Recovery from Local Cache
    useEffect(() => {
        try {
            const cacheKey = `df_vendor_cache_${projectHash}`;
            const cachedDataStr = localStorage.getItem(cacheKey);
            if (cachedDataStr) {
                const cachedData = JSON.parse(cachedDataStr);
                if (cachedData?.rows && JSON.stringify(cachedData.rows) !== JSON.stringify(initialRows)) {
                    setHasUnsavedCache(true);
                    setCachedRows(cachedData.rows);
                } else {
                    localStorage.removeItem(cacheKey);
                }
            }
        } catch (e) { console.error('Failed to read local cache', e); }
    }, [projectHash, initialRows]);

    // Immediate Local Cache Writing
    useEffect(() => {
        if (!isDirty || !projectHash) return;
        try {
            const cacheKey = `df_vendor_cache_${projectHash}`;
            localStorage.setItem(cacheKey, JSON.stringify({ timestamp: new Date().toISOString(), version, rows }));
        } catch (e) { console.error('Failed to write to local cache', e); }
    }, [rows, isDirty, projectHash, version]);

    const handleSaveProgress = useCallback(async (isAutoSave = false) => {
        setIsSaving(true);
        if (!isAutoSave) setFeedback({ type: '', message: '' });
        try {
            const lastSavedMap = new Map(lastSavedRowsRef.current.map(r => [r.id, r]));
            const isUserAddedAtSave = (rowId) => rowId && !initialRowIdsRef.current.has(rowId);

            // For user-added rows: drop entirely if completely empty; warn if partially filled
            // (has placement data but missing target_url or anchor_text)
            let warnPartial = false;
            const delta = rows
                .filter(r => {
                    if (isUserAddedAtSave(r.id)) {
                        const hasAnyField = (r.target_url || r.anchor_text || r.published_url || r.domain_url || r.remark);
                        if (!hasAnyField) return false; // skip empty stub silently
                        if (!r.target_url || !r.anchor_text) warnPartial = true;
                    }
                    const saved = lastSavedMap.get(r.id);
                    return !saved || JSON.stringify(r) !== JSON.stringify(saved);
                })
                .map(r => ({
                    id: r.id, target_id: r.target_id, target_url: r.target_url,
                    anchor_text: r.anchor_text, language: r.language || '',
                    domain_url: r.domain_url || '', published_url: r.published_url || '',
                    published_date: r.published_date || '', remark: r.remark || '',
                    indexed_status: r.indexed_status || '', indexed_datetime: r.indexed_datetime || '',
                }));

            if (warnPartial && !isAutoSave) {
                setFeedback({ type: 'error', message: 'New rows need both Target URL and Anchor Text to be useful.' });
                setTimeout(() => setFeedback({ type: '', message: '' }), 5000);
            }

            if (delta.length === 0) {
                setIsDirty(false);
                isDirtyRef.current = false;
                return;
            }

            const currentCompletedCount = rows.filter(r => r.published_url?.trim() && r.published_date?.trim()).length;
            const result = await saveVendorProgressDelta(projectHash, delta, currentCompletedCount, version);

            if (result.conflict) {
                setFeedback({ type: 'error', message: 'Another session saved simultaneously. Refreshing to latest data...' });
                setTimeout(() => window.location.reload(), 2000);
                return;
            }
            if (result.success) {
                if (!isAutoSave) setFeedback({ type: 'success', message: result.message });
                setLastSavedAt(new Date());
                setIsDirty(false);
                isDirtyRef.current = false;
                setVersion(v => v + 1);
                lastSavedRowsRef.current = [...rows];
                try { localStorage.removeItem(`df_vendor_cache_${projectHash}`); } catch (e) {}
            } else {
                setFeedback({ type: 'error', message: result.message });
            }
        } catch (e) {
            setFeedback({ type: 'error', message: 'Network error communicating with the server.' });
        } finally {
            setIsSaving(false);
            if (!isAutoSave && feedback.type !== 'error') setTimeout(() => setFeedback({ type: '', message: '' }), 4000);
        }
    }, [rows, projectHash, feedback.type, version]);

    useEffect(() => { isDirtyRef.current = isDirty; }, [isDirty]);

    // Auto-save — 3s debounce
    useEffect(() => {
        if (!isDirty) return;
        const timer = setTimeout(() => handleSaveProgress(true), 1000);
        return () => clearTimeout(timer);
    }, [rows, isDirty, handleSaveProgress]);

    // Keep a ref to the latest save function so the unmount-flush effect can call
    // it without re-binding (which would clear & recreate the cleanup on every render).
    const handleSaveProgressRef = useRef(handleSaveProgress);
    useEffect(() => { handleSaveProgressRef.current = handleSaveProgress; }, [handleSaveProgress]);

    // Flush pending save when tab closes (full unload) AND when component unmounts
    // (Next.js client-side navigation — beforeunload does not fire for these).
    useEffect(() => {
        const handleBeforeUnload = () => { if (isDirtyRef.current) handleSaveProgressRef.current(true); };
        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => {
            window.removeEventListener('beforeunload', handleBeforeUnload);
            if (isDirtyRef.current) handleSaveProgressRef.current(true);
        };
    }, []);

    const handleToggleUrlEntry = async () => {
        if (isLocked) return;
        const newValue = !localUrlEntryEnabled;
        setLocalUrlEntryEnabled(newValue);
        const result = await toggleUrlEntryMode(projectHash, newValue);
        if (!result.success) {
            setLocalUrlEntryEnabled(!newValue);
            setFeedback({ type: 'error', message: result.message });
        } else {
            setFeedback({ type: 'success', message: `URL Entry Mode ${newValue ? 'Enabled' : 'Disabled'}` });
            setTimeout(() => setFeedback({ type: '', message: '' }), 4000);
        }
    };

    // Anchor Text Metrics
    const anchorMetrics = useMemo(() => {
        const metrics = {};
        rows.forEach(r => {
            if (!metrics[r.anchor_text]) metrics[r.anchor_text] = { total: 0, submitted: 0 };
            metrics[r.anchor_text].total += 1;
            if (r.published_url && r.published_date) metrics[r.anchor_text].submitted += 1;
        });
        return Object.entries(metrics).map(([anchor, data]) => ({
            anchor, ...data, progress: Math.round((data.submitted / data.total) * 100),
        }));
    }, [rows]);

    const [showBulkIndexModal, setShowBulkIndexModal] = useState(false);
    const [bulkIndexText, setBulkIndexText] = useState('');
    const [bulkIndexMode, setBulkIndexMode] = useState('empty');

    const handleBulkIndexApply = useCallback(() => {
        if (isLocked) return;
        const values = bulkIndexText.split('\n').map(v => normalizeIndexStatus(v));
        if (values.length === 0) return;
        setRows(prevRows => {
            const newRows = [...prevRows];
            const targets = bulkIndexMode === 'empty'
                ? newRows.map((r, idx) => ({ r, idx })).filter(({ r }) => !r.indexed_status?.trim())
                : newRows.map((r, idx) => ({ r, idx }));
            values.forEach((val, i) => {
                if (i >= targets.length) return;
                const { idx } = targets[i];
                newRows[idx] = { ...newRows[idx], indexed_status: val, indexed_datetime: val ? new Date().toISOString() : '' };
            });
            return newRows;
        });
        setIsDirty(true);
        isDirtyRef.current = true;
        setShowBulkIndexModal(false);
        setBulkIndexText('');
        const filled = values.filter(v => v).length;
        setFeedback({ type: 'success', message: `${filled} index status value(s) applied.` });
        setTimeout(() => setFeedback({ type: '', message: '' }), 3000);
    }, [bulkIndexText, bulkIndexMode, isLocked]);

    // ---- Sibling plan tabs (Workbench) — switch between plans of the same campaign ----
    const hasSiblings = Array.isArray(siblingPlans) && siblingPlans.length > 1;
    // Recompute the *active* plan's live status from current row state so the icon updates as user types
    const liveSiblingPlans = useMemo(() => {
        if (!Array.isArray(siblingPlans) || siblingPlans.length === 0) return [];
        return siblingPlans.map(p => {
            if (p.hash !== projectHash) return p;
            const total = rows.length || p.total || 0;
            const completed = rows.filter(r => r.published_url && r.published_url.trim().length > 0).length;
            let status = 'pending';
            if (total > 0 && completed >= total) status = 'done';
            else if (completed > 0) status = 'progress';
            return { ...p, total, completed, status };
        });
    }, [siblingPlans, projectHash, rows]);

    const activeSibling = useMemo(
        () => liveSiblingPlans.find(p => p.hash === projectHash) || null,
        [liveSiblingPlans, projectHash]
    );

    // Sticky context bar info — anchors/targets for the current plan
    const activePlanContext = useMemo(() => {
        const anchors = [...new Set(rows.map(r => r.anchor_text).filter(Boolean))];
        const targets = [...new Set(rows.map(r => r.target_url).filter(Boolean))];
        return { anchors, targets };
    }, [rows]);

    // Filter logic — only the user-managed filters; row scope is already this plan's hash
    const filteredRows = useMemo(() => {
        if (!isFilterActive) return rows;
        return rows.filter(r => {
            const matchFilter = (fieldValue, filterValue) => {
                const val = fieldValue || '';
                if (!filterValue) return true;
                if (filterValue === '__BLANK__') return val.trim() === '';
                return val === filterValue;
            };
            return matchFilter(r.target_url, filters.target_url)
                && matchFilter(r.anchor_text, filters.anchor_text)
                && matchFilter(r.published_url, filters.published_url)
                && matchFilter(r.remark, filters.remark)
                && matchFilter(r.indexed_status, filters.indexed_status);
        });
    }, [rows, isFilterActive, filters]);

    // Save & Next — flush, then return the URL of the next non-done sibling (parent <Link> handles nav)
    const nextSiblingHref = useMemo(() => {
        if (!hasSiblings || !vendorName) return null;
        const idx = liveSiblingPlans.findIndex(p => p.hash === projectHash);
        const forward = liveSiblingPlans.slice(idx + 1);
        const back = liveSiblingPlans.slice(0, idx);
        const next = [...forward, ...back].find(p => p.status !== 'done');
        return next ? buildHashHref(next.hash) : null;
    }, [hasSiblings, liveSiblingPlans, projectHash, vendorName, buildHashHref]);

    const handleSaveBeforeNav = useCallback(async () => {
        if (isDirtyRef.current && handleSaveProgressRef.current) {
            await handleSaveProgressRef.current(false);
        }
    }, []);

    const handleFilterChange = (field, value) => setFilters(prev => ({ ...prev, [field]: value }));

    const completedCount = rows.filter(r => r.published_url && r.published_date).length;
    const [showMetrics, setShowMetrics] = useState(false);
    const [isMounted, setIsMounted] = useState(false);
    useEffect(() => { setIsMounted(true); }, []);

    const progressPercent = rows.length > 0 ? Math.round((completedCount / rows.length) * 100) : 0;

    // ---------------------------------------------------------------------------
    // Univer helpers
    // ---------------------------------------------------------------------------
    const buildCellValue = useCallback((row) => {
        const userAdded = isUserAddedRow(row.id);
        return COLS.map((field, col) => {
            let val = '';
            if (field === 'domain_url') {
                val = !localUrlEntryEnabledRef.current && row.published_url
                    ? (parseDomainUrl(row.published_url) || '')
                    : (row.domain_url || '');
            } else if (field === 'published_date') {
                val = formatDateDisplay(row.published_date);
            } else if (field === 'indexed_datetime') {
                val = formatIndexedDatetime(row.indexed_datetime);
            } else {
                val = row[field] || '';
            }
            // User-added rows can edit target_url (1), anchor_text (2), language (3)
            const bypassReadonly = userAdded && (col === 1 || col === 2 || col === 3);
            const isReadonlyCell = (ALWAYS_READONLY.has(col) && !bypassReadonly)
                || (field === 'domain_url' && !localUrlEntryEnabledRef.current);
            const cell = { v: val, t: 1 }; // t:1 = CellValueType.STRING (t:2 is NUMBER → coerces strings to NaN/0)
            if (isReadonlyCell) cell.s = READONLY_STYLE;
            return cell;
        });
    }, []);

    const buildWorkbookData = useCallback((displayRows) => {
        const cellData = {};
        cellData[0] = {};
        HEADERS.forEach((h, col) => { cellData[0][col] = { v: h, t: 1 }; });
        displayRows.forEach((row, rowIdx) => {
            cellData[rowIdx + 1] = {};
            buildCellValue(row).forEach((cell, col) => { cellData[rowIdx + 1][col] = cell; });
        });
        const columnData = {};
        COL_WIDTHS.forEach((w, col) => { columnData[col] = { w }; });
        const rowCount = Math.max(displayRows.length + 2, 50);
        return {
            id: `wb-${projectHash}`,
            sheetOrder: ['sheet1'],
            sheets: {
                sheet1: {
                    id: 'sheet1',
                    name: 'Placements',
                    rowCount,
                    columnCount: COLS.length,
                    cellData,
                    columnData,
                    freeze: { startRow: 1, startColumn: 0, ySplit: 1, xSplit: 0 },
                },
            },
            locale: 'enUS',
            name: 'Placements',
            appVersion: '0.21.0',
            styles: {
                [READONLY_STYLE]: { bg: { rgb: '#F9FAFB' }, cl: { rgb: '#9CA3AF' } },
            },
        };
    }, [buildCellValue, projectHash]);

    // Update Univer sheet cells in place (for filter / data changes)
    const updateUniverSheet = useCallback((displayRows) => {
        const workbook = univerAPIRef.current?.getActiveWorkbook();
        if (!workbook) return;
        const sheet = workbook.getActiveSheet();
        if (!sheet) return;

        isWritingBackRef.current += 1;
        if (displayRows.length > 0) {
            const values = displayRows.map(row => buildCellValue(row));
            sheet.getRange(1, 0, displayRows.length, COLS.length).setValues(values);
        }
        // Clear extra rows from previous (longer) filter
        const prevLen = prevFilteredLengthRef.current;
        if (prevLen > displayRows.length) {
            const extraRows = prevLen - displayRows.length;
            const empty = Array(extraRows).fill(null).map(() => COLS.map(() => ({ v: '' })));
            sheet.getRange(displayRows.length + 1, 0, extraRows, COLS.length).setValues(empty);
        }
        prevFilteredLengthRef.current = displayRows.length;
        rowIdMapRef.current = displayRows.map(r => r.id);
        // queueMicrotask ensures the guard stays active for any async mutation dispatches
        queueMicrotask(() => { isWritingBackRef.current = Math.max(0, isWritingBackRef.current - 1); });
    }, [buildCellValue]);

    // ---------------------------------------------------------------------------
    // Univer mount / unmount (runs once when isMounted becomes true)
    // ---------------------------------------------------------------------------
    useEffect(() => {
        if (!isMounted || isInitializedRef.current) return;
        isInitializedRef.current = true;

        const containerId = `univer-${projectHash}`;
        let cancelled = false;
        let disposable = null;
        let univerInstance = null;

        (async () => {
            const [{ createUniver, defaultTheme, LocaleType, merge }, { UniverSheetsCorePreset }, { UniverSheetsDataValidationPreset }, enUSModule] = await Promise.all([
                import('@univerjs/presets'),
                import('@univerjs/presets/preset-sheets-core'),
                import('@univerjs/presets/preset-sheets-data-validation'),
                import('@univerjs/presets/preset-sheets-core/locales/en-US'),
            ]);
            if (cancelled) return;
            const enUS = enUSModule.default || enUSModule;

            const { univer, univerAPI } = createUniver({
                locale: LocaleType.EN_US,
                locales: { [LocaleType.EN_US]: merge({}, enUS) },
                theme: defaultTheme,
                presets: [
                    UniverSheetsCorePreset({
                        container: containerId,
                        footer: false,     // hide sheet tabs
                        formulaBar: false, // hide formula bar
                    }),
                    UniverSheetsDataValidationPreset(),
                ],
            });

            univerAPIRef.current = univerAPI;
            univerInstanceRef.current = univer;
            univerInstance = univer;

        // Snapshot of filteredRows at mount time (read from ref won't work here; use closure capture)
        // We'll call updateUniverSheet after createWorkbook to get the right data
        const initialFilteredRows = rowsRef.current; // no filter active at mount
        univerAPI.createWorkbook(buildWorkbookData(initialFilteredRows));
        rowIdMapRef.current = initialFilteredRows.map(r => r.id);
        prevFilteredLengthRef.current = initialFilteredRows.length;

        // Apply indexed_status list dropdown to the entire data column (col 7)
        try {
            const fWorkbook = univerAPI.getActiveWorkbook();
            const fSheet = fWorkbook?.getActiveSheet();
            if (fSheet && univerAPI.newDataValidation) {
                const totalRows = Math.max(initialFilteredRows.length + 1, 50);
                const rule = univerAPI.newDataValidation()
                    .requireValueInList(INDEXED_STATUS_OPTIONS)
                    .build();
                fSheet.getRange(1, 7, totalRows, 1).setDataValidation(rule);
            }
        } catch (e) {
            console.warn('[VendorForm] Data validation setup failed:', e);
        }

        // Register cell-edit listener
        disposable = univerAPI.onCommandExecuted((command) => {
            if (isWritingBackRef.current > 0) return;
            if (command.id !== MUTATION_ID) return;
            if (isLocked) return;

            const { cellValue } = command.params || {};
            if (!cellValue) return;

            // Sort entries by univerRow so contiguous new-row detection works for multi-row paste
            const sortedEntries = Object.entries(cellValue)
                .map(([rowStr, cols]) => [parseInt(rowStr), cols])
                .filter(([univerRow]) => univerRow > 0)
                .sort((a, b) => a[0] - b[0]);

            // Phase 1 — detect and stage new rows for any univerRow past the current data range.
            // Only contiguous-next is allowed (no gaps); skip is silent.
            const newRowsForThisCommand = [];
            let extendedLength = rowsRef.current.length;
            for (const [univerRow] of sortedEntries) {
                const dataIdx = univerRow - 1;
                if (rowIdMapRef.current[dataIdx]) continue;
                if (dataIdx !== extendedLength) continue;
                const newId = `new-${typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Date.now() + '-' + Math.random().toString(36).slice(2, 10)}`;
                newRowsForThisCommand.push({
                    id: newId, target_id: 'extra',
                    target_url: '', anchor_text: '', language: '',
                    domain_url: '', published_url: '', published_date: '',
                    remark: '', indexed_status: '', indexed_datetime: '',
                });
                rowIdMapRef.current[dataIdx] = newId;
                extendedLength += 1;
            }

            // Combined lookup so edits on freshly-created rows can find their stub
            const lookupRows = newRowsForThisCommand.length > 0
                ? [...rowsRef.current, ...newRowsForThisCommand]
                : rowsRef.current;

            // Phase 2 — group edits by rowId
            const rowEdits = new Map();
            for (const [univerRow, cols] of sortedEntries) {
                const rowId = rowIdMapRef.current[univerRow - 1];
                if (!rowId) continue;
                Object.entries(cols).forEach(([colStr, cellData]) => {
                    const col = parseInt(colStr);
                    const field = COLS[col];
                    if (!field) return;
                    const newValue = String(cellData?.v ?? '');
                    if (!rowEdits.has(rowId)) rowEdits.set(rowId, { univerRow, edits: [] });
                    rowEdits.get(rowId).edits.push({ col, field, newValue });
                });
            }

            // Phase 3 — per-row processing (collect updates instead of calling setRows per row)
            const updates = new Map();

            for (const [rowId, { univerRow, edits }] of rowEdits) {
                const existingRow = lookupRows.find(r => r.id === rowId);
                if (!existingRow) continue;
                const userAdded = isUserAddedRow(existingRow.id);

                let updatedRow = { ...existingRow };
                let hasValidChange = false;
                const cellWrites = []; // cells to write back to Univer (reverts + computed values)

                for (const { col, field, newValue } of edits) {
                    const bypassReadonly = userAdded && (col === 1 || col === 2 || col === 3);
                    const isReadOnlyCol = (ALWAYS_READONLY.has(col) && !bypassReadonly)
                        || (field === 'domain_url' && !localUrlEntryEnabledRef.current);

                    if (isReadOnlyCol) {
                        let revertVal = existingRow[field] || '';
                        if (field === 'published_date') revertVal = formatDateDisplay(existingRow.published_date);
                        if (field === 'indexed_datetime') revertVal = formatIndexedDatetime(existingRow.indexed_datetime);
                        cellWrites.push({ row: univerRow, col, val: revertVal });
                        continue;
                    }

                    if (field === 'domain_url') {
                        updatedRow.domain_url = parseDomainUrl(newValue) || newValue;
                        hasValidChange = true;
                    } else if (field === 'published_url') {
                        const trimmedUrl = newValue.trim();
                        if (trimmedUrl && !trimmedUrl.startsWith('http://') && !trimmedUrl.startsWith('https://')) {
                            cellWrites.push({ row: univerRow, col, val: existingRow.published_url || '' });
                            setFeedback({ type: 'error', message: 'Published URL must include the full protocol, e.g. https://example.com' });
                            setTimeout(() => setFeedback({ type: '', message: '' }), 5000);
                            continue;
                        }
                        updatedRow.published_url = newValue;
                        hasValidChange = true;
                        if (trimmedUrl) {
                            if (!updatedRow.published_date) updatedRow.published_date = getISOFormat();
                            if (!localUrlEntryEnabledRef.current) updatedRow.domain_url = parseDomainUrl(trimmedUrl) || '';
                        } else {
                            updatedRow.published_date = '';
                            if (!localUrlEntryEnabledRef.current) updatedRow.domain_url = '';
                        }
                        cellWrites.push({ row: univerRow, col: 6, val: formatDateDisplay(updatedRow.published_date) });
                        if (!localUrlEntryEnabledRef.current) {
                            cellWrites.push({ row: univerRow, col: 0, val: updatedRow.domain_url || '' });
                        }
                    } else if (field === 'indexed_status') {
                        const trimmedStatus = newValue.trim();
                        const normalized = trimmedStatus ? normalizeIndexStatus(trimmedStatus) : '';
                        if (trimmedStatus && !normalized) {
                            cellWrites.push({ row: univerRow, col, val: existingRow.indexed_status || '' });
                            setFeedback({ type: 'error', message: `Invalid index status. Use: ${INDEXED_STATUS_OPTIONS.join(' / ')}` });
                            setTimeout(() => setFeedback({ type: '', message: '' }), 5000);
                            continue;
                        }
                        updatedRow.indexed_status = normalized;
                        updatedRow.indexed_datetime = normalized ? new Date().toISOString() : '';
                        hasValidChange = true;
                        if (normalized !== newValue) {
                            cellWrites.push({ row: univerRow, col, val: normalized });
                        }
                        cellWrites.push({ row: univerRow, col: 8, val: formatIndexedDatetime(updatedRow.indexed_datetime) });
                    } else {
                        updatedRow[field] = newValue;
                        hasValidChange = true;
                    }
                }

                // Flush all computed/revert cell writes atomically under one guard increment
                if (cellWrites.length > 0) {
                    isWritingBackRef.current += 1;
                    const sheet = univerAPIRef.current?.getActiveWorkbook()?.getActiveSheet();
                    if (sheet) {
                        cellWrites.forEach(({ row, col, val }) => {
                            sheet.getRange(row, col, 1, 1).setValues([[{ v: val, t: 1 }]]);
                        });
                    }
                    queueMicrotask(() => { isWritingBackRef.current = Math.max(0, isWritingBackRef.current - 1); });
                }

                if (hasValidChange) {
                    updates.set(rowId, updatedRow);
                }
            }

            // Phase 4 — single batched commit: append new rows + apply updates
            if (newRowsForThisCommand.length > 0 || updates.size > 0) {
                setRows(prevRows => {
                    const next = [...prevRows];
                    // Append new rows (with edits already applied if any)
                    for (const stub of newRowsForThisCommand) {
                        next.push(updates.get(stub.id) || stub);
                    }
                    // Apply updates to existing rows (skip new rows already pushed)
                    const newIds = new Set(newRowsForThisCommand.map(r => r.id));
                    for (const [id, updatedRow] of updates) {
                        if (newIds.has(id)) continue;
                        const idx = next.findIndex(r => r.id === id);
                        if (idx !== -1) next[idx] = updatedRow;
                    }
                    return next;
                });
                setIsDirty(true);
                isDirtyRef.current = true;
            }
        });
        })();

        return () => {
            cancelled = true;
            const d = disposable;
            const u = univerInstance;
            disposable = null;
            univerInstance = null;
            univerAPIRef.current = null;
            univerInstanceRef.current = null;
            isInitializedRef.current = false;
            // Defer dispose — Univer internally unmounts its own React root, which
            // React 19 forbids during the parent's render phase.
            setTimeout(() => {
                try { d?.dispose?.(); } catch (e) { /* noop */ }
                try { u?.dispose?.(); } catch (e) { /* noop */ }
            }, 0);
        };
    }, [isMounted]); // eslint-disable-line react-hooks/exhaustive-deps

    // Sync filteredRows to Univer whenever filter or rows change
    useEffect(() => {
        if (!isInitializedRef.current) return;
        updateUniverSheet(filteredRows);
    }, [filteredRows, updateUniverSheet]);

    // ---------------------------------------------------------------------------
    // Guard — no rows
    // ---------------------------------------------------------------------------
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
        );
    }

    // ---------------------------------------------------------------------------
    // Render
    // ---------------------------------------------------------------------------
    return (
        <div className="mt-8 space-y-6">

            {/* Local Cache Recovery Banner */}
            {hasUnsavedCache && (
                <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 p-4 bg-blue-50 border border-blue-200 rounded-xl shadow-sm">
                    <div className="flex items-center gap-3">
                        <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0" />
                        <div>
                            <p className="text-sm font-semibold text-blue-900">Unsaved changes found</p>
                            <p className="text-xs text-blue-700">We found unsaved data from your last session that wasn't uploaded.</p>
                        </div>
                    </div>
                    <div className="flex gap-2 w-full md:w-auto">
                        <button onClick={() => {
                            setRows(cachedRows);
                            setIsDirty(true);
                            isDirtyRef.current = true;
                            setHasUnsavedCache(false);
                            setFeedback({ type: 'success', message: 'Cached data restored. It will be uploaded shortly.' });
                        }} className="flex-1 md:flex-none px-4 py-2 text-xs font-bold text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors shadow-sm">
                            Restore Data
                        </button>
                        <button onClick={() => {
                            try { localStorage.removeItem(`df_vendor_cache_${projectHash}`); } catch (e) {}
                            setHasUnsavedCache(false);
                            setCachedRows(null);
                        }} className="flex-1 md:flex-none px-4 py-2 text-xs font-bold text-blue-700 bg-blue-100 rounded-md hover:bg-blue-200 transition-colors border border-blue-200">
                            Discard
                        </button>
                    </div>
                </div>
            )}

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

            {/* Dripfeed + Project Progress — single horizontal row */}
            <div className="flex flex-col lg:flex-row gap-3 mb-2">
                {dripfeedEnabled && (
                    <div className="lg:w-1/3 bg-gradient-to-r from-amber-50 to-amber-100/50 border border-amber-200 rounded-xl p-4 shadow-sm flex items-center justify-between gap-3">
                        <div className="min-w-0">
                            <h3 className="text-sm font-bold text-amber-900 flex items-center gap-2">
                                <Calendar className="w-4 h-4 text-amber-600 shrink-0" />
                                Drip Feed Active
                            </h3>
                            <p className="text-[11px] text-amber-700 mt-0.5">Daily submission limits apply.</p>
                        </div>
                        <div className="flex gap-2 shrink-0">
                            <div className="bg-white/80 backdrop-blur border border-amber-200/60 rounded-lg px-3 py-1.5 text-center shadow-sm">
                                <span className="block text-[9px] font-bold text-amber-600 uppercase tracking-wider">Today</span>
                                <div className="flex items-baseline justify-center gap-0.5">
                                    <span className={`text-base font-black ${urlsSubmittedToday >= urlsPerDay ? 'text-green-600' : 'text-amber-900'}`}>{urlsSubmittedToday}</span>
                                    <span className="text-amber-500 font-medium text-xs">/{urlsPerDay}</span>
                                </div>
                            </div>
                            <div className="bg-white/80 backdrop-blur border border-amber-200/60 rounded-lg px-3 py-1.5 text-center shadow-sm">
                                <span className="block text-[9px] font-bold text-amber-600 uppercase tracking-wider">Period</span>
                                <div className="text-base font-black text-amber-900">{dripfeedPeriod}<span className="text-[10px] font-medium text-amber-600 ml-0.5">d</span></div>
                            </div>
                        </div>
                    </div>
                )}

                <div className="flex-1 bg-white rounded-xl shadow-sm border border-gray-200 p-4">
                    <div className="flex items-center justify-between gap-4">
                        <div className="inline-flex items-center gap-2 text-sm font-semibold text-indigo-600 shrink-0">
                            <FileSpreadsheet className="w-4 h-4" /> Project Progress
                        </div>
                        <div className="flex items-center gap-3 flex-1 justify-end">
                            <div className="text-lg font-bold text-gray-900 whitespace-nowrap">
                                {completedCount} <span className="text-gray-400 text-sm">/ {rows.length}</span>
                            </div>
                            <div className="flex-1 max-w-[280px] bg-gray-100 rounded-full h-2 overflow-hidden border border-gray-200">
                                <div className="bg-indigo-600 h-2 transition-all duration-500" style={{ width: `${progressPercent}%` }} />
                            </div>
                            {anchorMetrics.length > 0 && (
                                <button
                                    onClick={() => setShowMetrics(!showMetrics)}
                                    className="text-gray-400 hover:text-indigo-600 transition-colors shrink-0"
                                    title={showMetrics ? 'Hide anchor metrics' : 'Show anchor metrics'}
                                >
                                    {showMetrics ? <ChevronDown className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
                                </button>
                            )}
                        </div>
                    </div>
                    {showMetrics && anchorMetrics.length > 0 && (
                        <div className="w-full pt-4 mt-3 border-t border-gray-100">
                            <div className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-3">Anchor Sub-Metrics</div>
                            <div className="flex flex-wrap gap-2">
                                {anchorMetrics.map((metric, idx) => (
                                    <div key={idx} className="flex items-center justify-between gap-3 bg-white border border-gray-200 rounded-lg px-3 py-2 min-w-[200px] shadow-sm">
                                        <div className="text-xs font-mono font-medium text-gray-700 truncate max-w-[110px]" title={metric.anchor}>{metric.anchor}</div>
                                        <div className="flex flex-col items-end shrink-0">
                                            <div className="flex items-baseline gap-1">
                                                <span className="text-sm font-bold text-gray-900">{metric.submitted}</span>
                                                <span className="text-xs text-gray-400 font-medium">/ {metric.total}</span>
                                            </div>
                                            <div className="w-14 bg-gray-100 rounded-full h-1 overflow-hidden mt-1">
                                                <div className={`h-1 rounded-full ${metric.progress === 100 ? 'bg-indigo-400' : 'bg-indigo-600'}`} style={{ width: `${metric.progress}%` }} />
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Notification Banner */}
            {feedback.message && (
                <div className={`p-4 rounded-md flex items-center gap-3 text-sm font-medium ${feedback.type === 'error' ? 'bg-red-50 text-red-800 border border-red-200' : 'bg-green-50 text-green-800 border border-green-200'}`}>
                    {feedback.type === 'success' && <CheckCircle2 className="w-5 h-5 text-green-500" />}
                    <span>{feedback.message}</span>
                </div>
            )}

            {/* Spreadsheet */}
            <div className="bg-white rounded-md shadow-sm border border-gray-200 overflow-hidden flex flex-col h-[700px] max-h-[75vh]">

                {/* Top Action Strip */}
                <div className="px-6 py-4 border-b border-gray-200 bg-gray-50 flex flex-col sm:flex-row items-center justify-between gap-4 shrink-0">
                    <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                        <button
                            onClick={() => setIsFilterActive(!isFilterActive)}
                            className={`flex items-center justify-center sm:justify-start gap-2 px-4 py-2 rounded-md text-sm font-semibold transition-colors border shadow-sm ${isFilterActive ? 'bg-indigo-600 text-white border-indigo-700' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'}`}
                        >
                            <Filter className="w-4 h-4" />
                            {isFilterActive ? 'Filters Active' : 'Enable Filters'}
                        </button>
                        <button
                            onClick={() => setShowBulkIndexModal(true)}
                            disabled={isLocked}
                            className="flex items-center justify-center sm:justify-start gap-2 px-4 py-2 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-md text-sm font-bold hover:bg-emerald-100 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <FileSpreadsheet className="w-4 h-4" />
                            Paste Index Status
                        </button>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
                        <div className="flex items-center gap-3 bg-white px-4 py-2 border border-gray-200 rounded-md shadow-sm">
                            <Link className={`w-4 h-4 ${localUrlEntryEnabled ? 'text-indigo-600' : 'text-gray-400'}`} />
                            <span className="text-sm font-semibold tracking-wide text-gray-700">URL Entry</span>
                            <label className="inline-flex items-center cursor-pointer ml-1">
                                <input type="checkbox" className="sr-only peer" checked={localUrlEntryEnabled} onChange={handleToggleUrlEntry} disabled={isLocked} />
                                <div className="relative w-9 h-5 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600" />
                            </label>
                        </div>
                        <div className={`flex items-center justify-center gap-2 px-4 py-2 rounded-md shadow-sm border ${isLocked ? 'bg-amber-100/50 text-amber-800 border-amber-200' : 'bg-green-50 text-green-700 border-green-200'}`}>
                            {isLocked ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
                            <span className="text-sm font-semibold tracking-wide">{isLocked ? 'LOCKED (READ-ONLY)' : 'EDITABLE'}</span>
                        </div>
                        <div className="flex items-center gap-2 bg-white px-4 py-2 border border-gray-200 rounded-md shadow-sm min-w-[200px] w-full sm:w-auto justify-center">
                            {isSaving ? (
                                <><RefreshCw className="w-4 h-4 animate-spin text-indigo-500" /><span className="text-sm font-medium text-indigo-700">Auto-saving...</span></>
                            ) : lastSavedAt ? (
                                <><CheckCircle2 className="w-4 h-4 text-green-500" /><span className="text-sm font-medium text-green-700">Saved: {lastSavedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span></>
                            ) : (
                                <span className="text-sm font-medium text-gray-400">All changes saved.</span>
                            )}
                        </div>
                    </div>
                </div>

                {/* Filter Row */}
                {isFilterActive && (
                    <div className="px-6 py-4 border-b border-gray-200 bg-white grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 shadow-inner text-sm shrink-0">
                        <div className="flex flex-col gap-1.5">
                            <span className="font-semibold text-[11px] uppercase tracking-wider text-gray-500">Target Authority</span>
                            <select value={filters.target_url} onChange={(e) => handleFilterChange('target_url', e.target.value)} className="px-3 py-2 bg-white border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-shadow">
                                <option value="">All Targets</option>
                                <option value="__BLANK__">(Blank)</option>
                                {uniqueOptions.target_url.map((val, i) => <option key={i} value={val}>{val}</option>)}
                            </select>
                        </div>
                        <div className="flex flex-col gap-1.5">
                            <span className="font-semibold text-[11px] uppercase tracking-wider text-gray-500">Anchor Text</span>
                            <select value={filters.anchor_text} onChange={(e) => handleFilterChange('anchor_text', e.target.value)} className="px-3 py-2 bg-white border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-shadow">
                                <option value="">All Anchors</option>
                                <option value="__BLANK__">(Blank)</option>
                                {uniqueOptions.anchor_text.map((val, i) => <option key={i} value={val}>{val}</option>)}
                            </select>
                        </div>
                        <div className="flex flex-col gap-1.5">
                            <span className="font-semibold text-[11px] uppercase tracking-wider text-amber-600">Remark</span>
                            <select value={filters.remark} onChange={(e) => handleFilterChange('remark', e.target.value)} className="px-3 py-2 bg-amber-50/50 border border-amber-300 rounded-md focus:ring-2 focus:ring-amber-500 focus:border-amber-500 text-amber-900 outline-none transition-shadow">
                                <option value="">All Remarks</option>
                                <option value="__BLANK__">(Blank)</option>
                                {uniqueOptions.remark.map((val, i) => <option key={i} value={val}>{val}</option>)}
                            </select>
                        </div>
                        <div className="flex flex-col gap-1.5">
                            <span className="font-semibold text-[11px] uppercase tracking-wider text-indigo-600">Published URL</span>
                            <select value={filters.published_url} onChange={(e) => handleFilterChange('published_url', e.target.value)} className="px-3 py-2 bg-indigo-50/50 border border-indigo-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-indigo-900 outline-none transition-shadow">
                                <option value="">All Published URLs</option>
                                <option value="__BLANK__">(Blank)</option>
                                {uniqueOptions.published_url.map((val, i) => <option key={i} value={val}>{val}</option>)}
                            </select>
                        </div>
                        <div className="flex flex-col gap-1.5">
                            <span className="font-semibold text-[11px] uppercase tracking-wider text-emerald-600">Index Status</span>
                            <select value={filters.indexed_status} onChange={(e) => handleFilterChange('indexed_status', e.target.value)} className="px-3 py-2 bg-emerald-50/50 border border-emerald-300 rounded-md focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-emerald-900 outline-none transition-shadow">
                                <option value="">All Statuses</option>
                                <option value="__BLANK__">(Blank)</option>
                                {uniqueOptions.indexed_status.map((val, i) => <option key={i} value={val}>{val}</option>)}
                            </select>
                        </div>
                    </div>
                )}

                {/* Sibling Plan Tabs (Workbench) — switch between plans of the same campaign */}
                {hasSiblings && (
                    <div className="border-b border-gray-200 bg-white px-3 pt-3 shrink-0">
                        <div className="flex items-end gap-1 overflow-x-auto">
                            {liveSiblingPlans.map((p) => {
                                const active = p.hash === projectHash;
                                const icon = p.status === 'done' ? '✅' : p.status === 'progress' ? '⏳' : '⚪';
                                const formatCompact = (d) => {
                                    if (!d) return '—';
                                    const x = new Date(d);
                                    return `${String(x.getMonth() + 1).padStart(2, '0')}.${String(x.getDate()).padStart(2, '0')}`;
                                };
                                const tab = (
                                    <div
                                        className={`group flex flex-col gap-0.5 px-4 py-2.5 rounded-t-lg border border-b-0 whitespace-nowrap transition-colors min-w-[160px] ${
                                            active
                                                ? 'bg-indigo-50 text-indigo-800 border-indigo-200 shadow-[0_-2px_0_0_#4f46e5_inset]'
                                                : 'bg-gray-50 text-gray-500 border-gray-200 hover:bg-white hover:text-gray-800'
                                        }`}
                                    >
                                        <div className="flex items-center gap-2 text-sm font-bold">
                                            <span className="text-base leading-none">{icon}</span>
                                            <span>{p.label}</span>
                                            {p.isPriority && <span className="text-amber-500" title="Priority">★</span>}
                                            <span className={`ml-auto text-[11px] font-mono tabular-nums ${active ? 'text-indigo-600' : 'text-gray-400'}`}>
                                                {p.completed}/{p.total}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-2 text-[11px] font-medium">
                                            {p.category && (
                                                <span className={`px-1.5 py-0.5 rounded font-semibold ${active ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-100 text-gray-600 group-hover:bg-gray-200'}`}>
                                                    {p.category}
                                                </span>
                                            )}
                                            {(p.startDate || p.deadline) && (
                                                <span className="flex items-center gap-1 font-mono tabular-nums text-gray-500">
                                                    <Calendar className="w-3 h-3" />
                                                    {formatCompact(p.startDate)}<span className="text-gray-300">→</span>{formatCompact(p.deadline)}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                );
                                return active ? (
                                    <div key={p.hash} aria-current="page">{tab}</div>
                                ) : (
                                    <NextLink
                                        key={p.hash}
                                        href={buildHashHref(p.hash)}
                                        scroll={false}
                                        onClick={handleSaveBeforeNav}
                                        className="block"
                                    >
                                        {tab}
                                    </NextLink>
                                );
                            })}
                            <div className="ml-auto pb-1.5 flex items-center gap-2">
                                {nextSiblingHref ? (
                                    <NextLink
                                        href={nextSiblingHref}
                                        scroll={false}
                                        onClick={handleSaveBeforeNav}
                                        className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white text-xs font-bold rounded-md hover:bg-indigo-700 transition-colors shadow-sm"
                                        title="Save current progress and advance to the next incomplete plan"
                                    >
                                        <CheckCircle2 className="w-3.5 h-3.5" />
                                        Save & Next
                                    </NextLink>
                                ) : (
                                    <button
                                        disabled
                                        className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white text-xs font-bold rounded-md opacity-40 cursor-not-allowed"
                                        title="All plans complete"
                                    >
                                        <CheckCircle2 className="w-3.5 h-3.5" />
                                        Save & Next
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* Sticky Context Bar — keeps anchor + target visible while scrolling */}
                {activeSibling && activePlanContext && (activePlanContext.anchors.length > 0 || activePlanContext.targets.length > 0) && (
                    <div className="sticky top-0 z-20 bg-amber-50/90 backdrop-blur-sm border-b border-amber-200 px-4 py-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs shrink-0">
                        <span className="font-bold text-amber-900 uppercase tracking-wider text-[10px]">{activeSibling.label} Context</span>
                        {activePlanContext.anchors.length > 0 && (
                            <span className="text-gray-700">
                                <span className="font-semibold text-gray-500">Anchor:</span>{' '}
                                {activePlanContext.anchors.length === 1 ? (
                                    <span className="font-mono text-gray-900">{activePlanContext.anchors[0]}</span>
                                ) : (
                                    <span className="font-mono text-gray-900" title={activePlanContext.anchors.join(' · ')}>{activePlanContext.anchors.length} anchors</span>
                                )}
                            </span>
                        )}
                        {activePlanContext.targets.length > 0 && (
                            <span className="text-gray-700 truncate max-w-[40ch]">
                                <span className="font-semibold text-gray-500">Target:</span>{' '}
                                {activePlanContext.targets.length === 1 ? (
                                    <a href={activePlanContext.targets[0]} target="_blank" rel="noreferrer" className="font-mono text-indigo-700 hover:underline">{activePlanContext.targets[0]}</a>
                                ) : (
                                    <span className="font-mono text-gray-900" title={activePlanContext.targets.join(' · ')}>{activePlanContext.targets.length} targets</span>
                                )}
                            </span>
                        )}
                        <span className="ml-auto font-mono tabular-nums text-amber-800">
                            {activeSibling.completed}/{activeSibling.total} done
                        </span>
                    </div>
                )}

                {/* Univer Spreadsheet Container */}
                <div className="flex-1 w-full relative overflow-hidden min-h-0">
                    {isMounted && (
                        <div id={`univer-${projectHash}`} className="w-full h-full" />
                    )}
                </div>

                {/* Footer */}
                <div className="px-6 py-3 bg-gray-50 border-t border-gray-200 text-xs font-medium text-gray-500 shrink-0 flex justify-between z-10 relative">
                    <span>Showing {filteredRows.length} of {rows.length} rows</span>
                    {isFilterActive && <span>Filters apply to Target Authority, Anchor Text, Published URL, Remarks, and Index Status</span>}
                </div>
            </div>

            {/* Bulk Index Status Paste Modal */}
            {showBulkIndexModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4">
                    <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden">
                        <div className="px-6 py-4 border-b border-slate-100 bg-slate-50">
                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-0.5">Bulk Fill</p>
                            <p className="text-sm font-bold text-slate-800">Paste Index Status from Sheet</p>
                        </div>
                        <div className="px-6 py-5 space-y-4">
                            <div className="flex flex-wrap gap-1.5">
                                {['page indexed', 'page not indexed', 'domain not indexed'].map(v => (
                                    <span key={v} className="px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded text-[10px] font-bold uppercase tracking-widest">{v}</span>
                                ))}
                            </div>
                            <p className="text-[10px] text-slate-400">Values are matched case-insensitively. Blank lines are skipped.</p>
                            <div className="flex gap-2">
                                {[{ val: 'empty', label: 'Empty rows only' }, { val: 'all', label: 'Overwrite all rows' }].map(opt => (
                                    <button key={opt.val} onClick={() => setBulkIndexMode(opt.val)} className={`flex-1 py-2 rounded-lg border text-[11px] font-black uppercase tracking-widest transition-colors ${bulkIndexMode === opt.val ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'}`}>
                                        {opt.label}
                                    </button>
                                ))}
                            </div>
                            <textarea value={bulkIndexText} onChange={e => setBulkIndexText(e.target.value)} placeholder={"page indexed\npage not indexed\ndomain not indexed\n..."} rows={8} className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm font-mono text-slate-700 resize-none focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 bg-slate-50" />
                            {bulkIndexText.trim() && (
                                <p className="text-[11px] text-slate-500 font-semibold">{bulkIndexText.split('\n').filter(v => v.trim()).length} row(s) will be applied</p>
                            )}
                        </div>
                        <div className="px-6 py-4 border-t border-slate-100 flex gap-3 justify-end">
                            <button onClick={() => { setShowBulkIndexModal(false); setBulkIndexText(''); }} className="px-4 py-2 text-sm font-bold text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">Cancel</button>
                            <button onClick={handleBulkIndexApply} disabled={!bulkIndexText.trim()} className="px-4 py-2 text-sm font-black text-white bg-emerald-600 border border-emerald-600 rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">Apply</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
