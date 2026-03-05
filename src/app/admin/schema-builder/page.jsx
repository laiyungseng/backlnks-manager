'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';

function genId() {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
        const r = Math.random() * 16 | 0;
        return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    });
}
import Link from 'next/link';
import {
    Plus, Trash2, Copy, Check, Table2, Send, X,
    ChevronDown, ChevronRight, Lock, AlertCircle,
    CheckCircle2, Loader2, Code2, Database,
} from 'lucide-react';
import { getCredentialStatusAction, executeSupabaseSQLAction } from './actions';

// ─── Constants ────────────────────────────────────────────────────────────────

const COLUMN_TYPES = [
    'TEXT', 'VARCHAR(255)', 'INTEGER', 'BIGINT', 'BOOLEAN',
    'UUID', 'TIMESTAMPTZ', 'DATE', 'JSONB', 'NUMERIC', 'FLOAT8',
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeLockedCol(name, type, defaultVal, isPK = false) {
    return { id: genId(), name, type, nullable: false, defaultVal, unique: false, locked: true, isPK };
}

function makeUserCol() {
    return { id: genId(), name: '', type: 'TEXT', nullable: true, defaultVal: '', unique: false, locked: false, isPK: false, isFk: false, fkTable: '', fkColumn: 'id' };
}

function makeTable() {
    return {
        id: genId(),
        name: '',
        enableRLS: true,
        publicRead: false,
        collapsed: false,
        columns: [
            makeLockedCol('id', 'UUID', 'gen_random_uuid()', true),
            makeUserCol(),
            makeLockedCol('created_at', 'TIMESTAMPTZ', 'NOW()'),
        ],
    };
}

function sanitizeName(raw) {
    return (raw || 'unnamed_table').trim().toLowerCase().replace(/[^a-z0-9_]/g, '_');
}

const NO_QUOTE_DEFAULTS = ['NOW()', 'CURRENT_TIMESTAMP', 'TRUE', 'FALSE', 'NULL', 'GEN_RANDOM_UUID()'];

function buildColDef(col) {
    if (!col.name.trim()) return null;
    let def = `  ${col.name.trim()}`;

    if (col.isPK) {
        def += ` UUID PRIMARY KEY DEFAULT gen_random_uuid()`;
    } else {
        def += ` ${col.type}`;
        if (!col.nullable) def += ` NOT NULL`;
        const dv = col.defaultVal?.trim();
        if (dv) {
            if (NO_QUOTE_DEFAULTS.includes(dv.toUpperCase())) {
                def += ` DEFAULT ${dv}`;
            } else {
                def += ` DEFAULT '${dv}'`;
            }
        }
        if (col.unique) def += ` UNIQUE`;
        if (col.isFk && col.fkTable?.trim()) {
            const refCol = col.fkColumn?.trim() || 'id';
            def += ` REFERENCES public.${sanitizeName(col.fkTable)}(${refCol})`;
        }
    }
    return def;
}

function generateSQL(tables) {
    if (!tables.length) return '-- Add tables above to generate SQL.';

    return tables
        .map((table) => {
            const name = sanitizeName(table.name);
            const colDefs = table.columns.map(buildColDef).filter(Boolean);
            if (!colDefs.length) return `-- Table "${name}" has no defined columns yet.`;

            let sql = `-- Table: ${name}\nCREATE TABLE IF NOT EXISTS public.${name} (\n${colDefs.join(',\n')}\n);`;

            if (table.enableRLS) {
                sql += `\n\nALTER TABLE public.${name}\n  ENABLE ROW LEVEL SECURITY;`;
            }

            if (table.publicRead) {
                sql += `\n\nCREATE POLICY "allow_public_read_${name}"\n  ON public.${name}\n  FOR SELECT\n  USING (true);`;
            }

            return sql;
        })
        .join('\n\n-- ─────────────────────────────────────────\n\n');
}

// ─── Credential Modal ─────────────────────────────────────────────────────────

function CredentialModal({ onClose, onExecute }) {
    const [status, setStatus] = useState(null); // null = loading | { exists, maskedUrl, maskedAnonKey }
    const [isExecuting, setIsExecuting] = useState(false);
    const [result, setResult] = useState(null);

    useEffect(() => {
        async function check() {
            const session = JSON.parse(localStorage.getItem('df_admin_session') || '{}');
            const adminUserId = session?.user?.id;
            const res = await getCredentialStatusAction(adminUserId);
            setStatus(res);
        }
        check();
    }, []);

    async function handleExecute() {
        setIsExecuting(true);
        setResult(null);
        const res = await onExecute();
        setResult(res);
        setIsExecuting(false);
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                    <div className="flex items-center gap-2.5">
                        <div className="p-1.5 bg-indigo-100 rounded-md">
                            <Send className="w-4 h-4 text-indigo-600" />
                        </div>
                        <h3 className="text-base font-semibold text-gray-900">Send to Supabase via API</h3>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-gray-600 transition-colors rounded-md p-1 hover:bg-gray-100"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Body */}
                <div className="px-6 py-5 space-y-4">
                    {status === null ? (
                        <div className="flex items-center gap-2.5 text-sm text-gray-500 py-2">
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Checking credentials...
                        </div>
                    ) : (
                        <>
                            {/* Credential display */}
                            <div className="space-y-3 bg-gray-50 rounded-lg p-4 border border-gray-200">
                                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                                    Connection Credential
                                </p>
                                <div>
                                    <span className="text-xs text-gray-500 font-medium">Supabase Project URL</span>
                                    <div className={`mt-1 px-3 py-2 rounded-md border font-mono text-sm ${status.exists ? 'bg-white border-gray-200 text-gray-800' : 'bg-white border-gray-200 text-gray-400 italic'}`}>
                                        {status.exists ? status.maskedUrl : 'Not configured'}
                                    </div>
                                </div>
                                <div>
                                    <span className="text-xs text-gray-500 font-medium">Publishable Key</span>
                                    <div className={`mt-1 px-3 py-2 rounded-md border font-mono text-sm tracking-widest ${status.exists ? 'bg-white border-gray-200 text-gray-800' : 'bg-white border-gray-200 text-gray-400 italic'}`}>
                                        {status.exists ? status.maskedAnonKey : 'Not configured'}
                                    </div>
                                </div>
                            </div>

                            {/* No credential notification */}
                            {!status.exists && (
                                <div className="flex items-start gap-2 text-sm text-red-600 font-medium">
                                    <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                                    <span>
                                        No API credentials recorded.{' '}
                                        <Link href="/admin/settings" className="underline hover:text-red-800">
                                            Add them in Settings
                                        </Link>{' '}
                                        before executing.
                                    </span>
                                </div>
                            )}

                            {/* Execution result */}
                            {result && (
                                <div className={`flex items-start gap-2 text-sm px-3 py-2.5 rounded-lg border ${result.success ? 'bg-green-50 border-green-200 text-green-800' : 'bg-red-50 border-red-200 text-red-700'}`}>
                                    {result.success
                                        ? <CheckCircle2 className="w-4 h-4 mt-0.5 flex-shrink-0 text-green-600" />
                                        : <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0 text-red-500" />
                                    }
                                    <span>{result.message}</span>
                                </div>
                            )}
                        </>
                    )}
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-gray-100 bg-gray-50 flex justify-end gap-3">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                        {result?.success ? 'Done' : 'Cancel'}
                    </button>
                    {!result?.success && (
                        <button
                            onClick={handleExecute}
                            disabled={!status?.exists || isExecuting}
                            className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shadow-sm"
                        >
                            {isExecuting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                            {isExecuting ? 'Executing...' : 'Execute SQL'}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}

// ─── Column Row ───────────────────────────────────────────────────────────────

function ColumnRow({ col, onChange, onRemove }) {
    if (col.locked) {
        return (
            <div className="flex items-center gap-3 px-3 py-2 bg-gray-50 rounded-lg border border-gray-200 opacity-70">
                <Lock className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                <span className="font-mono text-sm text-gray-600 w-36">{col.name}</span>
                <span className="font-mono text-xs text-gray-500 w-28">{col.type}</span>
                <span className="text-xs text-gray-400 flex-1">DEFAULT {col.defaultVal}{col.isPK ? ' · PK' : ' · NOT NULL'}</span>
            </div>
        );
    }

    return (
        <div className="flex items-center gap-2 px-3 py-2 bg-white rounded-lg border border-gray-200 hover:border-indigo-300 transition-colors group">
            {/* Column name */}
            <input
                type="text"
                placeholder="column_name"
                value={col.name}
                onChange={(e) => onChange({ ...col, name: e.target.value })}
                className="font-mono text-sm text-gray-900 border border-gray-200 rounded px-2 py-1 w-36 focus:ring-1 focus:ring-indigo-400 focus:border-indigo-400 outline-none"
            />

            {/* Type */}
            <select
                value={col.type}
                onChange={(e) => onChange({ ...col, type: e.target.value })}
                className="font-mono text-xs text-gray-700 border border-gray-200 rounded px-2 py-1 w-32 bg-white focus:ring-1 focus:ring-indigo-400 outline-none"
            >
                {COLUMN_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>

            {/* Default value */}
            <input
                type="text"
                placeholder="default (optional)"
                value={col.defaultVal}
                onChange={(e) => onChange({ ...col, defaultVal: e.target.value })}
                className="font-mono text-xs text-gray-700 border border-gray-200 rounded px-2 py-1 flex-1 focus:ring-1 focus:ring-indigo-400 outline-none"
            />

            {/* Nullable toggle */}
            <label className="flex items-center gap-1.5 cursor-pointer select-none text-xs text-gray-500 shrink-0">
                <input
                    type="checkbox"
                    checked={col.nullable}
                    onChange={(e) => onChange({ ...col, nullable: e.target.checked })}
                    className="w-3.5 h-3.5 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500"
                />
                Null
            </label>

            {/* Unique toggle */}
            <label className="flex items-center gap-1.5 cursor-pointer select-none text-xs text-gray-500 shrink-0">
                <input
                    type="checkbox"
                    checked={col.unique}
                    onChange={(e) => onChange({ ...col, unique: e.target.checked })}
                    className="w-3.5 h-3.5 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500"
                />
                Uniq
            </label>

            {/* FK toggle */}
            <label className="flex items-center gap-1.5 cursor-pointer select-none text-xs text-gray-500 shrink-0" title="Foreign Key">
                <input
                    type="checkbox"
                    checked={col.isFk}
                    onChange={(e) => onChange({ ...col, isFk: e.target.checked })}
                    className="w-3.5 h-3.5 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500"
                />
                FK
            </label>

            {/* FK reference inputs */}
            {col.isFk && (
                <>
                    <input
                        type="text"
                        placeholder="ref_table"
                        value={col.fkTable}
                        onChange={(e) => onChange({ ...col, fkTable: e.target.value })}
                        className="font-mono text-xs text-gray-700 border border-indigo-300 rounded px-2 py-1 w-24 focus:ring-1 focus:ring-indigo-400 outline-none bg-indigo-50"
                        title="Referenced table"
                    />
                    <input
                        type="text"
                        placeholder="ref_col"
                        value={col.fkColumn}
                        onChange={(e) => onChange({ ...col, fkColumn: e.target.value })}
                        className="font-mono text-xs text-gray-700 border border-indigo-300 rounded px-2 py-1 w-20 focus:ring-1 focus:ring-indigo-400 outline-none bg-indigo-50"
                        title="Referenced column (default: id)"
                    />
                </>
            )}

            {/* Remove */}
            <button
                type="button"
                onClick={onRemove}
                className="text-gray-300 hover:text-red-500 transition-colors p-1 rounded opacity-0 group-hover:opacity-100"
                title="Remove column"
            >
                <Trash2 className="w-3.5 h-3.5" />
            </button>
        </div>
    );
}

// ─── Table Card ───────────────────────────────────────────────────────────────

function TableCard({ table, onUpdate, onRemove }) {
    function updateCol(colId, updated) {
        onUpdate({
            ...table,
            columns: table.columns.map((c) => (c.id === colId ? updated : c)),
        });
    }

    function addCol() {
        // Insert new column before the locked created_at (last column)
        const cols = [...table.columns];
        cols.splice(cols.length - 1, 0, makeUserCol());
        onUpdate({ ...table, columns: cols });
    }

    function removeCol(colId) {
        onUpdate({ ...table, columns: table.columns.filter((c) => c.id !== colId) });
    }

    const userColCount = table.columns.filter((c) => !c.locked).length;

    return (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            {/* Card header */}
            <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-100 bg-gray-50">
                <button
                    type="button"
                    onClick={() => onUpdate({ ...table, collapsed: !table.collapsed })}
                    className="text-gray-400 hover:text-gray-700 transition-colors"
                >
                    {table.collapsed
                        ? <ChevronRight className="w-4 h-4" />
                        : <ChevronDown className="w-4 h-4" />
                    }
                </button>

                <Database className="w-4 h-4 text-indigo-500 flex-shrink-0" />

                <input
                    type="text"
                    placeholder="table_name"
                    value={table.name}
                    onChange={(e) => onUpdate({ ...table, name: e.target.value })}
                    className="font-mono text-sm font-semibold text-gray-900 border-none bg-transparent outline-none focus:bg-white focus:border focus:border-indigo-300 focus:ring-1 focus:ring-indigo-300 rounded px-2 py-0.5 flex-1 min-w-0"
                />

                {!table.collapsed && (
                    <span className="text-xs text-gray-400 shrink-0">{userColCount} column{userColCount !== 1 ? 's' : ''}</span>
                )}

                <button
                    type="button"
                    onClick={onRemove}
                    className="text-gray-300 hover:text-red-500 transition-colors p-1 rounded ml-auto"
                    title="Remove table"
                >
                    <Trash2 className="w-4 h-4" />
                </button>
            </div>

            {/* Columns */}
            {!table.collapsed && (
                <div className="p-4 space-y-2">
                    {/* Column header labels */}
                    <div className="flex items-center gap-2 px-3 mb-1">
                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider w-36">Column Name</span>
                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider w-32">Type</span>
                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider flex-1">Default</span>
                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider w-10 text-center">Null</span>
                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider w-10 text-center">Uniq</span>
                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider w-8 text-center">FK</span>
                        <span className="w-6" />
                    </div>

                    {table.columns.map((col) => (
                        <ColumnRow
                            key={col.id}
                            col={col}
                            onChange={(updated) => updateCol(col.id, updated)}
                            onRemove={() => removeCol(col.id)}
                        />
                    ))}

                    <button
                        type="button"
                        onClick={addCol}
                        className="flex items-center gap-1.5 text-xs font-semibold text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 px-3 py-2 rounded-lg transition-colors border border-dashed border-indigo-200 w-full justify-center mt-1"
                    >
                        <Plus className="w-3.5 h-3.5" /> Add Column
                    </button>

                    {/* Table options */}
                    <div className="flex items-center gap-4 pt-2 border-t border-gray-100 mt-3">
                        <label className="flex items-center gap-2 cursor-pointer select-none text-xs text-gray-600 font-medium">
                            <input
                                type="checkbox"
                                checked={table.enableRLS}
                                onChange={(e) => onUpdate({ ...table, enableRLS: e.target.checked })}
                                className="w-3.5 h-3.5 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500"
                            />
                            Enable RLS
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer select-none text-xs text-gray-600 font-medium">
                            <input
                                type="checkbox"
                                checked={table.publicRead}
                                onChange={(e) => onUpdate({ ...table, publicRead: e.target.checked })}
                                className="w-3.5 h-3.5 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500"
                            />
                            Public Read Policy
                        </label>
                    </div>
                </div>
            )}
        </div>
    );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function SchemaBuilderPage() {
    const [tables, setTables] = useState([makeTable()]);
    const [copied, setCopied] = useState(false);
    const [showModal, setShowModal] = useState(false);

    const sql = useMemo(() => generateSQL(tables), [tables]);

    function addTable() {
        setTables((prev) => [...prev, makeTable()]);
    }

    function updateTable(id, updated) {
        setTables((prev) => prev.map((t) => (t.id === id ? updated : t)));
    }

    function removeTable(id) {
        setTables((prev) => prev.filter((t) => t.id !== id));
    }

    function handleCopy() {
        navigator.clipboard.writeText(sql).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        });
    }

    async function handleExecute() {
        const session = JSON.parse(localStorage.getItem('df_admin_session') || '{}');
        const adminUserId = session?.user?.id;
        return await executeSupabaseSQLAction(adminUserId, sql);
    }

    return (
        <div className="max-w-5xl mx-auto space-y-6 pb-16">
            {/* Page header */}
            <div className="flex items-start justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Schema Builder</h1>
                    <p className="mt-1.5 text-sm text-gray-500">
                        Design tables visually, then generate and execute SQL directly against your Supabase project.
                        <br />
                        All tables auto-include <code className="bg-gray-100 px-1 py-0.5 rounded text-xs font-mono">id UUID PK</code> and <code className="bg-gray-100 px-1 py-0.5 rounded text-xs font-mono">created_at TIMESTAMPTZ</code>.
                    </p>
                </div>
                <button
                    type="button"
                    onClick={addTable}
                    className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white text-sm font-semibold rounded-lg hover:bg-indigo-700 transition-colors shadow-sm shrink-0"
                >
                    <Plus className="w-4 h-4" /> Add Table
                </button>
            </div>

            {/* Table cards */}
            {tables.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 bg-white rounded-xl border border-dashed border-gray-300 text-center">
                    <Table2 className="w-10 h-10 text-gray-300 mb-3" />
                    <p className="text-sm font-medium text-gray-500">No tables yet</p>
                    <p className="text-xs text-gray-400 mt-1">Click "Add Table" to start designing your schema.</p>
                </div>
            ) : (
                <div className="space-y-4">
                    {tables.map((table) => (
                        <TableCard
                            key={table.id}
                            table={table}
                            onUpdate={(updated) => updateTable(table.id, updated)}
                            onRemove={() => removeTable(table.id)}
                        />
                    ))}
                </div>
            )}

            {/* SQL Preview Panel */}
            <div className="bg-gray-900 rounded-xl overflow-hidden shadow-lg border border-gray-700">
                {/* Panel header with action buttons */}
                <div className="flex items-center justify-between px-5 py-3 border-b border-gray-700 bg-gray-800">
                    <div className="flex items-center gap-2 text-gray-400">
                        <Code2 className="w-4 h-4" />
                        <span className="text-xs font-semibold uppercase tracking-wider">Generated SQL</span>
                        <span className="text-xs text-gray-500">· {tables.length} table{tables.length !== 1 ? 's' : ''}</span>
                    </div>

                    {/* Action buttons — stacked: Send above Copy */}
                    <div className="flex flex-col gap-1.5 items-end">
                        {/* Send to Supabase button (top) */}
                        <button
                            type="button"
                            onClick={() => setShowModal(true)}
                            disabled={tables.length === 0}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-md transition-colors disabled:opacity-40 disabled:cursor-not-allowed shadow-sm"
                        >
                            <Send className="w-3.5 h-3.5" />
                            Send to Supabase via API
                        </button>

                        {/* Copy button (below Send) */}
                        <button
                            type="button"
                            onClick={handleCopy}
                            disabled={tables.length === 0}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-gray-200 text-xs font-semibold rounded-md transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                            {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
                            {copied ? 'Copied!' : 'Copy SQL'}
                        </button>
                    </div>
                </div>

                {/* SQL code block */}
                <pre className="p-6 text-sm font-mono text-gray-300 overflow-x-auto whitespace-pre leading-relaxed max-h-[60vh] overflow-y-auto">
                    {sql}
                </pre>
            </div>

            {/* Credential modal */}
            {showModal && (
                <CredentialModal
                    onClose={() => setShowModal(false)}
                    onExecute={handleExecute}
                />
            )}
        </div>
    );
}
