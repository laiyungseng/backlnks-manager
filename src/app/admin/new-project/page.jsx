'use client';

import { useState, useActionState, useMemo, useRef, useEffect } from 'react';
import { createCampaignAction, getExistingCampaignTitles } from './actions';
import { getCategories } from '../catalog/categories/actions';
import { getAvailablePackagesAction } from '../catalog/backlink-packages/actions';
import { useFormStatus } from 'react-dom';
import { Plus, Trash2, Languages, ChevronDown, ChevronUp, Package, Loader2 } from 'lucide-react';

function addDaysToDateStr(dateStr, days) {
    const [y, m, d] = dateStr.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    date.setDate(date.getDate() + days);
    const yr = date.getFullYear();
    const mo = String(date.getMonth() + 1).padStart(2, '0');
    const dy = String(date.getDate()).padStart(2, '0');
    return `${yr}-${mo}-${dy}`;
}

function normalizePlanDates(plans) {
    const next = plans.map(plan => ({ ...plan }));
    let changed = false;

    for (let i = 0; i < next.length; i++) {
        const plan = next[i];

        if (i > 0 && !plan.startDateManualOverride) {
            const prevDeadline = next[i - 1].deadline;
            if (prevDeadline) {
                const newStart = addDaysToDateStr(prevDeadline, 1);
                if (plan.start_date !== newStart) {
                    plan.start_date = newStart;
                    changed = true;
                }
            }
        }

        if (plan.dripfeed_enabled && !plan.deadlineManualOverride) {
            const period = parseInt(plan.dripfeed_period) || 0;
            if (plan.start_date && period) {
                const newDeadline = addDaysToDateStr(plan.start_date, period);
                if (plan.deadline !== newDeadline) {
                    plan.deadline = newDeadline;
                    changed = true;
                }
            }
        }
    }

    return changed ? next : plans;
}

function genId() {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
        const r = Math.random() * 16 | 0;
        return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    });
}

function createEmptyPlan() {
    return {
        id: genId(),
        vendor_name: '',
        country: '',
        start_date: '',
        deadline: '',
        dripfeed_enabled: true,
        deadlineManualOverride: false,
        startDateManualOverride: false,
        dripfeed_period: '',
        urls_per_day: '',
        manualOverride: false,
        price: 0,
        price_type: 'per_url',
        package_id: null,
        randomize_languages: false,
        remarks: '',
        total_quantity: 0,
        languages: [{ id: genId(), code: '', ratio: 0 }],
        project_info_groups: [{
            id: genId(),
            sheet_name: '',
            category: 'NULL',
            placement_target: [{ id: genId(), anchor_text: '', target_url: '', ratio: 0 }]
        }]
    };
}

function getPlanQuantity(plan) {
    return (plan.project_info_groups || []).reduce((acc, g) =>
        acc + (g.placement_target || []).reduce((s, t) => s + (parseInt(t.ratio) || 0), 0), 0);
}

function rebalanceLanguages(langs, total) {
    if (!langs.length) return langs;
    const base = Math.floor(total / langs.length);
    const rem = total % langs.length;
    return langs.map((l, i) => ({ ...l, ratio: base + (i === 0 ? rem : 0) }));
}

function rebalanceGroups(groups, total) {
    const rows = groups.reduce((s, g) => s + g.placement_target.length, 0);
    if (!rows) return groups;
    const base = Math.floor(total / rows);
    const rem = total % rows;
    let first = true;
    return groups.map(g => ({
        ...g,
        placement_target: g.placement_target.map(t => {
            const extra = first ? rem : 0;
            first = false;
            return { ...t, ratio: base + extra };
        })
    }));
}

const initialState = { message: '', success: false, results: null };

function SubmitButton({ isValid }) {
    const { pending } = useFormStatus();
    const disabled = pending || !isValid;
    return (
        <button type="submit" disabled={disabled}
            className={`mt-6 w-full py-3 px-4 rounded-md text-white font-bold shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 ${disabled ? 'bg-indigo-300 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700'}`}>
            {pending ? 'Encrypting & Bootstrapping Campaign...' : 'Kickoff Campaign'}
        </button>
    );
}

function PlanCard({ plan, planIndex, categories, onUpdate, onRemove, canRemove, vendorPackages, allPlans, onLoadPackages }) {
    const [collapsed, setCollapsed] = useState(false);
    const [packagesLoading, setPackagesLoading] = useState(false);

    const masterQty = parseInt(plan.total_quantity) || 0;
    const planQty = getPlanQuantity(plan);
    const langSum = (plan.languages || []).reduce((s, l) => s + (parseInt(l.ratio) || 0), 0);
    const targetSum = planQty;
    const isValidLang = langSum === masterQty;
    const isValidTarget = targetSum === masterQty;
    const allLangsFilled = (plan.languages || []).every(l => l.code.trim().length > 0);
    const allCatsSelected = (plan.project_info_groups || []).every(g => g.category !== 'NULL');

    // ── plan-level field update
    const set = (field, value) => onUpdate(plan.id, field, value);

    // ── total quantity change → rebalance both languages and targets atomically
    const setTotalQty = (val) => {
        const qty = parseInt(val) || 0;
        onUpdate(plan.id, {
            total_quantity: qty,
            languages: rebalanceLanguages(plan.languages, qty),
            project_info_groups: rebalanceGroups(plan.project_info_groups, qty),
        });
    };

    // ── language helpers
    const addLang = () => {
        const next = [...plan.languages, { id: genId(), code: '', ratio: 0 }];
        set('languages', rebalanceLanguages(next, planQty));
    };
    const removeLang = (lid) => {
        if (plan.languages.length <= 1) return;
        const next = plan.languages.filter(l => l.id !== lid);
        set('languages', rebalanceLanguages(next, planQty));
    };
    const updateLang = (lid, field, val) => {
        set('languages', plan.languages.map(l =>
            l.id === lid ? { ...l, [field]: field === 'ratio' ? parseInt(val) || 0 : val.toUpperCase() } : l
        ));
    };

    // ── group helpers
    const addGroup = () => {
        const next = [...plan.project_info_groups, {
            id: genId(), sheet_name: '', category: 'NULL',
            placement_target: [{ id: genId(), anchor_text: '', target_url: '', ratio: 0 }]
        }];
        set('project_info_groups', rebalanceGroups(next, planQty));
    };
    const removeGroup = (gid) => {
        if (plan.project_info_groups.length <= 1) return;
        set('project_info_groups', rebalanceGroups(plan.project_info_groups.filter(g => g.id !== gid), planQty));
    };
    const updateGroup = (gid, field, val) => {
        set('project_info_groups', plan.project_info_groups.map(g => g.id === gid ? { ...g, [field]: val } : g));
    };
    const addTarget = (gid) => {
        const next = plan.project_info_groups.map(g =>
            g.id === gid ? { ...g, placement_target: [...g.placement_target, { id: genId(), anchor_text: '', target_url: '', ratio: 0 }] } : g
        );
        set('project_info_groups', rebalanceGroups(next, planQty));
    };
    const removeTarget = (gid, tid) => {
        const next = plan.project_info_groups.map(g =>
            g.id === gid && g.placement_target.length > 1
                ? { ...g, placement_target: g.placement_target.filter(t => t.id !== tid) } : g
        );
        set('project_info_groups', rebalanceGroups(next, planQty));
    };
    const updateTarget = (gid, tid, field, val) => {
        set('project_info_groups', plan.project_info_groups.map(g =>
            g.id === gid ? {
                ...g, placement_target: g.placement_target.map(t =>
                    t.id === tid ? { ...t, [field]: field === 'ratio' ? parseInt(val) || 0 : val } : t
                )
            } : g
        ));
    };

    const checkBadUrl = (url) => {
        if (!url) return false;
        try {
            const u = new URL(/^https?:\/\//i.test(url) ? url : `https://${url}`);
            return !u.hostname.includes('.');
        } catch { return true; }
    };

    // Load packages for this plan's vendor when price_type = 'package' and vendor is set
    useEffect(() => {
        if (plan.price_type !== 'package' || !plan.vendor_name?.trim()) return;
        if (vendorPackages[plan.vendor_name]) return; // already cached
        setPackagesLoading(true);
        onLoadPackages(plan.vendor_name).finally(() => setPackagesLoading(false));
    }, [plan.price_type, plan.vendor_name]); // eslint-disable-line react-hooks/exhaustive-deps

    const availablePackages = vendorPackages[plan.vendor_name] || [];

    // Compute effective remaining per package (subtract cross-plan usage in this form)
    function getEffectiveRemaining(pkg) {
        const otherUsage = (allPlans || [])
            .filter(p => p.id !== plan.id && p.package_id === pkg.id)
            .reduce((s, p) => s + (parseInt(p.total_quantity) || 0), 0);
        return Math.max(0, pkg.remaining_quantity - otherUsage);
    }

    return (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            {/* Plan Header */}
            <div className="flex items-center justify-between px-5 py-3 bg-indigo-50 border-b border-indigo-100 cursor-pointer" onClick={() => setCollapsed(v => !v)}>
                <div className="flex items-center gap-3">
                    <span className="w-6 h-6 flex items-center justify-center rounded-full bg-indigo-600 text-white font-bold text-xs shrink-0">{planIndex + 1}</span>
                    <div>
                        <span className="font-bold text-gray-900 text-sm">{plan.vendor_name || `Plan ${planIndex + 1}`}</span>
                        {plan.country && <span className="ml-2 text-xs text-gray-500 font-mono">[{plan.country.toUpperCase()}]</span>}
                        {planQty > 0 && <span className="ml-2 text-xs font-semibold text-indigo-700">{planQty} qty</span>}
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    {canRemove && (
                        <button type="button" onClick={(e) => { e.stopPropagation(); onRemove(plan.id); }}
                            className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors">
                            <Trash2 className="w-4 h-4" />
                        </button>
                    )}
                    {collapsed ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronUp className="w-4 h-4 text-gray-400" />}
                </div>
            </div>

            {!collapsed && (
                <div className="p-5 space-y-8">
                    {/* Core Settings */}
                    <div className="grid grid-cols-1 gap-y-5 gap-x-4 sm:grid-cols-2">
                        <div>
                            <label className="block text-xs font-semibold text-gray-600 mb-1">Vendor Assigned *</label>
                            <input type="text" required value={plan.vendor_name} onChange={e => set('vendor_name', e.target.value)}
                                placeholder="e.g. Vendor company name" className="block w-full border border-gray-300 rounded-md shadow-sm p-2.5 text-gray-900 text-sm focus:ring-indigo-500 focus:border-indigo-500" />
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-gray-600 mb-1">Country Code *</label>
                            <input type="text" required value={plan.country} onChange={e => set('country', e.target.value.toUpperCase())}
                                placeholder="MY, AUS, PNG" maxLength={3}
                                className="block w-full border border-gray-300 rounded-md shadow-sm p-2.5 text-gray-900 text-sm font-mono uppercase focus:ring-indigo-500 focus:border-indigo-500" />
                        </div>
                        <div>
                            <div className="flex items-center justify-between mb-1">
                                <label className="block text-xs font-semibold text-gray-600">
                                    Start Date *
                                    {planIndex > 0 && !plan.startDateManualOverride && (
                                        <span className="ml-1.5 text-[10px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">Chained from Plan {planIndex}</span>
                                    )}
                                </label>
                                {planIndex > 0 && plan.startDateManualOverride && (
                                    <button type="button" onClick={() => onUpdate(plan.id, { startDateManualOverride: false })}
                                        className="text-[10px] text-indigo-500 hover:text-indigo-700 underline">Reset to chain</button>
                                )}
                            </div>
                            <input type="date" required value={plan.start_date}
                                onChange={e => onUpdate(plan.id, planIndex > 0
                                    ? { start_date: e.target.value, startDateManualOverride: true }
                                    : { start_date: e.target.value })}
                                className="block w-full border border-gray-300 rounded-md shadow-sm p-2.5 text-gray-900 text-sm focus:ring-indigo-500 focus:border-indigo-500" />
                        </div>
                        <div>
                            <div className="flex items-center justify-between mb-1">
                                <label className="block text-xs font-semibold text-gray-600">
                                    Deadline *
                                    {plan.dripfeed_enabled && !plan.deadlineManualOverride && (
                                        <span className="ml-1.5 text-[10px] font-bold text-indigo-500 bg-indigo-50 px-1.5 py-0.5 rounded">Auto</span>
                                    )}
                                </label>
                                {plan.dripfeed_enabled && plan.deadlineManualOverride && (
                                    <button type="button" onClick={() => onUpdate(plan.id, { deadlineManualOverride: false })}
                                        className="text-[10px] text-indigo-500 hover:text-indigo-700 underline">Reset to auto</button>
                                )}
                            </div>
                            <input type="date" required value={plan.deadline}
                                onChange={e => onUpdate(plan.id, { deadline: e.target.value, deadlineManualOverride: true })}
                                className="block w-full border border-gray-300 rounded-md shadow-sm p-2.5 text-gray-900 text-sm focus:ring-indigo-500 focus:border-indigo-500" />
                        </div>
                        <div className="sm:col-span-2">
                            <label className="block text-xs font-semibold text-gray-600 mb-1">Total Quantity *</label>
                            <div className="flex items-center gap-3">
                                <input type="number" min="1" required value={plan.total_quantity || ''}
                                    onChange={e => setTotalQty(e.target.value)}
                                    placeholder="e.g. 100"
                                    className="w-48 border border-gray-300 rounded-md shadow-sm p-2.5 text-gray-900 text-sm font-mono focus:ring-indigo-500 focus:border-indigo-500" />
                                <span className="text-xs text-gray-400">Setting this auto-distributes quantities across languages and targets</span>
                            </div>
                        </div>
                    </div>

                    {/* Pricing */}
                    <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                        <h3 className="text-sm font-bold text-gray-800 mb-3">Pricing</h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <span className="text-gray-500 text-sm font-bold">$</span>
                                </div>
                                <input type="number" min="0" step="0.01" value={plan.price}
                                    onChange={e => set('price', parseFloat(e.target.value) || 0)}
                                    className="pl-7 block w-full border border-gray-300 rounded-md p-2.5 text-sm font-mono focus:ring-indigo-500 focus:border-indigo-500" placeholder="0.00" />
                            </div>
                            <div className="flex bg-gray-100 rounded-lg p-1">
                                <button type="button" onClick={() => onUpdate(plan.id, { price_type: 'per_url', package_id: null })}
                                    className={`flex-1 text-xs font-semibold py-1.5 px-2 rounded-md transition-colors ${plan.price_type === 'per_url' ? 'bg-white shadow-sm text-indigo-700' : 'text-gray-500'}`}>
                                    Per URL
                                </button>
                                <button type="button" onClick={() => {
                                    onUpdate(plan.id, { price_type: 'package' });
                                    if (plan.vendor_name?.trim()) onLoadPackages(plan.vendor_name);
                                }}
                                    className={`flex-1 text-xs font-semibold py-1.5 px-2 rounded-md transition-colors ${plan.price_type === 'package' ? 'bg-white shadow-sm text-indigo-700' : 'text-gray-500'}`}>
                                    Package
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Package Selection — enabled only when price_type = 'package' */}
                    <div className={`rounded-lg p-4 border transition-all ${plan.price_type === 'package' ? 'bg-indigo-50 border-indigo-200' : 'bg-gray-50 border-gray-200 opacity-50 pointer-events-none'}`}>
                        <div className="flex items-center gap-2 mb-3">
                            <Package className="w-4 h-4 text-indigo-500" />
                            <h3 className="text-sm font-bold text-gray-800">Package Selection</h3>
                            {plan.price_type !== 'package' && (
                                <span className="text-[10px] text-gray-400 font-semibold">— select "Package" pricing to enable</span>
                            )}
                        </div>
                        {plan.price_type === 'package' && (
                            <>
                                {!plan.vendor_name?.trim() ? (
                                    <p className="text-xs text-amber-600 font-semibold">Enter a vendor name above to load available packages.</p>
                                ) : packagesLoading ? (
                                    <div className="flex items-center gap-2 text-xs text-slate-400">
                                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                        Loading packages for {plan.vendor_name}…
                                    </div>
                                ) : availablePackages.length === 0 ? (
                                    <p className="text-xs text-slate-400 italic">No packages found for <strong>{plan.vendor_name}</strong>. Add packages in the Backlink Packages page first.</p>
                                ) : (
                                    <div className="flex flex-col gap-1">
                                        <label className="text-xs font-semibold text-gray-600 mb-1">Select Package *</label>
                                        <select
                                            value={plan.package_id || ''}
                                            onChange={e => set('package_id', e.target.value || null)}
                                            className="block w-full border border-indigo-200 rounded-md p-2.5 text-sm text-gray-900 bg-white focus:ring-indigo-500 focus:border-indigo-500"
                                        >
                                            <option value="">— Choose a package —</option>
                                            {availablePackages.map(pkg => {
                                                const effRemaining = getEffectiveRemaining(pkg);
                                                const isSufficient = effRemaining >= (parseInt(plan.total_quantity) || 0);
                                                return (
                                                    <option
                                                        key={pkg.id}
                                                        value={pkg.id}
                                                        disabled={effRemaining <= 0}
                                                    >
                                                        {pkg.code} | {pkg.vendor_name} | {effRemaining}/{pkg.total_quantity}
                                                        {effRemaining <= 0 ? ' (exhausted)' : !isSufficient ? ' ⚠ insufficient qty' : ''}
                                                    </option>
                                                );
                                            })}
                                        </select>
                                        {plan.package_id && (() => {
                                            const sel = availablePackages.find(p => p.id === plan.package_id);
                                            if (!sel) return null;
                                            const eff = getEffectiveRemaining(sel);
                                            const qty = parseInt(plan.total_quantity) || 0;
                                            const placementCategories = (plan.project_info_groups || []).map(g => (g.category || '').toLowerCase());
                                            const pkgCategory = (sel.category || '').toLowerCase();
                                            const categoryMismatch = pkgCategory && placementCategories.length > 0 && !placementCategories.includes(pkgCategory);
                                            return (
                                                <>
                                                    <div className={`mt-2 text-xs font-semibold px-3 py-1.5 rounded-lg ${eff >= qty ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'}`}>
                                                        {eff >= qty
                                                            ? `✓ ${eff} remaining — sufficient for ${qty} qty`
                                                            : `⚠ Only ${eff} remaining — insufficient for ${qty} qty`}
                                                    </div>
                                                    {categoryMismatch && (
                                                        <div className="mt-2 text-xs font-semibold px-3 py-1.5 rounded-lg bg-amber-50 text-amber-700 border border-amber-200">
                                                            ⚠ Package category (<strong>{sel.category}</strong>) doesn't match any placement group in this plan. You can still proceed if this is intentional.
                                                        </div>
                                                    )}
                                                </>
                                            );
                                        })()}
                                    </div>
                                )}
                            </>
                        )}
                    </div>

                    {/* Drip Feed */}
                    <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                        <div className="flex items-center gap-3 mb-3">
                            <h3 className="text-sm font-bold text-gray-800">Drip Feed</h3>
                            <label className="inline-flex items-center cursor-pointer">
                                <input type="checkbox" className="sr-only peer" checked={plan.dripfeed_enabled}
                                    onChange={e => onUpdate(plan.id, {
                                        dripfeed_enabled: e.target.checked,
                                        ...(e.target.checked ? { deadlineManualOverride: false } : {})
                                    })} />
                                <div className="relative w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600"></div>
                                <span className="ml-2 text-xs font-semibold text-indigo-700">Enabled</span>
                            </label>
                        </div>
                        {plan.dripfeed_enabled && (
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs text-gray-500 mb-1">Period (days)</label>
                                    <input type="number" min="1" value={plan.dripfeed_period}
                                        onChange={e => set('dripfeed_period', e.target.value)}
                                        className="block w-full border border-gray-300 rounded-md p-2 text-sm font-mono focus:ring-indigo-500 focus:border-indigo-500" placeholder="e.g. 10" />
                                </div>
                                <div>
                                    <div className="flex items-center justify-between mb-1">
                                        <label className="block text-xs text-gray-500">URLs / day</label>
                                        <label className="flex items-center text-[10px] text-indigo-600 cursor-pointer">
                                            <input type="checkbox" checked={plan.manualOverride}
                                                onChange={e => set('manualOverride', e.target.checked)}
                                                className="w-3 h-3 mr-1 rounded border-gray-300" />
                                            Manual
                                        </label>
                                    </div>
                                    <input type="number" min="1" value={plan.urls_per_day}
                                        readOnly={!plan.manualOverride}
                                        onChange={e => plan.manualOverride && set('urls_per_day', e.target.value)}
                                        className={`block w-full border rounded-md p-2 text-sm font-mono ${!plan.manualOverride ? 'bg-gray-100 border-gray-200 text-gray-500 cursor-not-allowed' : 'border-gray-300'} focus:ring-indigo-500 focus:border-indigo-500`}
                                        placeholder="Auto" />
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Languages */}
                    <div className="bg-gradient-to-r from-indigo-50 to-purple-50 rounded-lg p-4 border border-indigo-100">
                        <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                                <Languages className="w-4 h-4 text-indigo-600" />
                                <h3 className="text-sm font-bold text-gray-800">Languages</h3>
                                <span className={`text-xs font-bold px-2 py-0.5 rounded ${isValidLang ? 'bg-green-100 text-green-700' : 'bg-red-50 text-red-700'}`}>
                                    {langSum}/{masterQty} {isValidLang ? '✓' : '✗'}
                                </span>
                            </div>
                            {plan.languages.length > 1 && (
                                <label className="flex items-center gap-2 text-xs font-medium text-gray-600 cursor-pointer">
                                    Randomize
                                    <input type="checkbox" checked={plan.randomize_languages}
                                        onChange={e => set('randomize_languages', e.target.checked)}
                                        className="w-3.5 h-3.5 rounded border-gray-300 text-purple-600" />
                                </label>
                            )}
                        </div>
                        <div className="space-y-2">
                            {(plan.languages || []).map((lang, i) => (
                                <div key={lang.id} className="flex items-center gap-2 bg-white p-2 rounded-lg border border-gray-200">
                                    <span className="text-gray-400 text-xs w-5 text-center">#{i + 1}</span>
                                    <input type="text" placeholder="EN, MY..." value={lang.code}
                                        onChange={e => updateLang(lang.id, 'code', e.target.value)}
                                        maxLength={5} className="flex-1 border border-gray-300 rounded p-1.5 text-sm uppercase font-mono focus:ring-indigo-500 focus:border-indigo-500 outline-none" />
                                    <div className="relative w-24">
                                        <input type="number" min="0" value={lang.ratio}
                                            onChange={e => updateLang(lang.id, 'ratio', e.target.value)}
                                            className="w-full border border-gray-300 rounded p-1.5 text-sm font-mono text-right pr-7 focus:ring-indigo-500 focus:border-indigo-500 outline-none" />
                                        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[9px] text-gray-400">qty</span>
                                    </div>
                                    {plan.languages.length > 1 && (
                                        <button type="button" onClick={() => removeLang(lang.id)}
                                            className="text-gray-300 hover:text-red-500 p-1 rounded transition-colors">
                                            <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                    )}
                                </div>
                            ))}
                        </div>
                        <button type="button" onClick={addLang}
                            className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-indigo-700 hover:text-indigo-800 bg-white px-3 py-1.5 rounded border border-indigo-200 shadow-sm">
                            <Plus className="w-3.5 h-3.5" /> Add Language
                        </button>
                    </div>

                    {/* Placement Targets */}
                    <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                        <div className="flex items-center justify-between mb-4">
                            <div>
                                <h3 className="text-sm font-bold text-gray-800">Placement Targets</h3>
                                <p className="text-xs text-gray-500 mt-0.5">Group by category. Total must equal language total.</p>
                            </div>
                            <span className={`text-xs font-bold px-2 py-0.5 rounded border ${isValidTarget && targetSum > 0 ? 'bg-green-100 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-100'}`}>
                                {targetSum}/{masterQty} qty {isValidTarget && targetSum > 0 ? '✓' : '✗'}
                            </span>
                        </div>

                        <div className="space-y-6">
                            {(plan.project_info_groups || []).map((group, gi) => (
                                <div key={group.id} className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                                    <div className="bg-indigo-50/50 border-b border-gray-200 px-4 py-3 flex flex-col sm:flex-row sm:items-end gap-3">
                                        <div className="flex items-center gap-2 shrink-0">
                                            <span className="w-5 h-5 flex items-center justify-center rounded-full bg-indigo-100 text-indigo-700 font-bold text-[10px]">{gi + 1}</span>
                                            <span className="text-xs font-bold text-gray-700">Group</span>
                                        </div>
                                        <div className="flex-1 grid grid-cols-2 gap-3">
                                            <div>
                                                <label className="block text-[10px] font-semibold text-gray-500 mb-1">Category</label>
                                                <select value={group.category} onChange={e => updateGroup(group.id, 'category', e.target.value)}
                                                    className="block w-full border border-gray-300 rounded py-1.5 px-2 text-sm bg-white focus:ring-indigo-500 focus:border-indigo-500">
                                                    {categories.length === 0
                                                        ? <option value={group.category}>{group.category || 'Loading…'}</option>
                                                        : categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)
                                                    }
                                                </select>
                                            </div>
                                            <div>
                                                <label className="block text-[10px] font-semibold text-gray-500 mb-1">Sheet Name</label>
                                                <input type="text" placeholder="e.g. Month 1" value={group.sheet_name}
                                                    onChange={e => updateGroup(group.id, 'sheet_name', e.target.value)}
                                                    className="block w-full border border-gray-300 rounded py-1.5 px-2 text-sm focus:ring-indigo-500 focus:border-indigo-500" />
                                            </div>
                                        </div>
                                        {plan.project_info_groups.length > 1 && (
                                            <button type="button" onClick={() => removeGroup(group.id)}
                                                className="text-gray-400 hover:text-red-600 p-1.5 rounded hover:bg-red-50 transition-colors self-end shrink-0">
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        )}
                                    </div>
                                    <div className="p-4 space-y-3">
                                        {group.placement_target.map((row, ri) => (
                                            <div key={row.id} className="flex items-center gap-2 relative">
                                                <span className="text-gray-300 text-[9px] font-mono w-4 text-center">T{ri + 1}</span>
                                                <input type="text" required placeholder="Anchor text" value={row.anchor_text}
                                                    onChange={e => updateTarget(group.id, row.id, 'anchor_text', e.target.value)}
                                                    className="flex-1 border border-gray-300 rounded p-2 text-sm focus:ring-indigo-500 focus:border-indigo-500 outline-none" />
                                                <input type="url" required placeholder="https://client.com/page" value={row.target_url}
                                                    onChange={e => updateTarget(group.id, row.id, 'target_url', e.target.value)}
                                                    className={`flex-[2] border rounded p-2 text-sm focus:ring-indigo-500 focus:border-indigo-500 outline-none ${checkBadUrl(row.target_url) ? 'border-red-400 bg-red-50' : 'border-gray-300'}`} />
                                                <div className="relative w-20">
                                                    <input type="number" min="0" value={row.ratio}
                                                        onChange={e => updateTarget(group.id, row.id, 'ratio', e.target.value)}
                                                        className="w-full border border-gray-300 rounded p-2 text-sm font-mono text-right pr-7 focus:ring-indigo-500 focus:border-indigo-500 outline-none" />
                                                    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[9px] text-gray-400">qty</span>
                                                </div>
                                                {group.placement_target.length > 1 && (
                                                    <button type="button" onClick={() => removeTarget(group.id, row.id)}
                                                        className="text-gray-300 hover:text-red-500 p-1 rounded transition-colors">
                                                        <Trash2 className="w-3.5 h-3.5" />
                                                    </button>
                                                )}
                                            </div>
                                        ))}
                                        <button type="button" onClick={() => addTarget(group.id)}
                                            className="mt-1 inline-flex items-center gap-1 text-[11px] font-semibold text-gray-500 hover:text-indigo-700 bg-gray-50 hover:bg-indigo-50 px-2.5 py-1 rounded transition-colors">
                                            <Plus className="w-3 h-3" /> Add Target
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                        <div className="mt-4 flex items-center justify-between">
                            <button type="button" onClick={addGroup}
                                className="inline-flex items-center gap-2 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 px-4 py-2 rounded-lg shadow-sm transition-colors">
                                <Plus className="w-4 h-4" /> Add Category Group
                            </button>
                            {!allCatsSelected && (
                                <span className="text-xs font-medium text-red-600 bg-red-50 px-2 py-1 rounded animate-pulse">
                                    All groups need a category
                                </span>
                            )}
                        </div>
                    </div>

                    {/* Remarks */}
                    <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1">Remarks (Optional)</label>
                        <textarea rows={2} value={plan.remarks} onChange={e => set('remarks', e.target.value)}
                            placeholder="Additional notes..." className="block w-full border border-gray-300 rounded-md shadow-sm p-2.5 text-sm text-gray-900 focus:ring-indigo-500 focus:border-indigo-500" />
                    </div>
                </div>
            )}
        </div>
    );
}

export default function NewProjectPage() {
    const [state, formAction] = useActionState(createCampaignAction, initialState);
    const formRef = useRef(null);

    const [campaignTitle, setCampaignTitle] = useState('');
    const [personInCharge, setPersonInCharge] = useState('');
    const [clientName, setClientName] = useState('');
    const [plans, setPlans] = useState([createEmptyPlan()]);
    const [categories, setCategories] = useState([]);
    const [campaignSuggestions, setCampaignSuggestions] = useState([]);
    const [vendorPackages, setVendorPackages] = useState({}); // { [vendorName]: Package[] }

    useEffect(() => {
        getCategories().then(res => { if (res.success) setCategories(res.categories); });
        getExistingCampaignTitles().then(titles => setCampaignSuggestions(titles));
    }, []);

    // Auto-calc urls_per_day when plan fields change
    useEffect(() => {
        setPlans(prev => prev.map(plan => {
            if (!plan.dripfeed_enabled || plan.manualOverride) return plan;
            const qty = parseInt(plan.total_quantity) || 0;
            const period = parseInt(plan.dripfeed_period) || 0;
            const auto = qty > 0 && period > 0 ? String(Math.ceil(qty / period)) : '';
            return plan.urls_per_day !== auto ? { ...plan, urls_per_day: auto } : plan;
        }));
    }, [plans.map(p => `${p.dripfeed_enabled}-${p.dripfeed_period}-${p.total_quantity}`).join('|')]);

    // Auto-calc deadline from dripfeed + chain plan start dates from previous plan's deadline
    useEffect(() => {
        setPlans(prev => normalizePlanDates(prev));
    }, [plans.map(p => `${p.start_date}|${p.deadline}|${p.dripfeed_enabled}|${p.dripfeed_period}|${p.deadlineManualOverride}|${p.startDateManualOverride}`).join('||')]);

    useEffect(() => {
        if (state?.success) {
            window.scrollTo({ top: 0, behavior: 'smooth' });
            formRef.current?.reset();
            setCampaignTitle('');
            setPersonInCharge('');
            setClientName('');
            setPlans([createEmptyPlan()]);
        }
    }, [state?.success, state?.results]);

    const loadVendorPackages = async (vendorName) => {
        if (!vendorName?.trim()) return;
        if (vendorPackages[vendorName]) return; // already loaded
        const pkgs = await getAvailablePackagesAction(vendorName);
        setVendorPackages(prev => ({ ...prev, [vendorName]: pkgs }));
    };

    const updatePlan = (planId, fieldOrPatch, value) => {
        setPlans(prev => prev.map(p => {
            if (p.id !== planId) return p;
            if (typeof fieldOrPatch === 'object') return { ...p, ...fieldOrPatch };
            return { ...p, [fieldOrPatch]: value };
        }));
    };

    const addPlan = () => setPlans(prev => normalizePlanDates([...prev, createEmptyPlan()]));
    const removePlan = (planId) => setPlans(prev => prev.filter(p => p.id !== planId));

    const isFormValid = useMemo(() => {
        if (!campaignTitle.trim() || !personInCharge.trim()) return false;
        return plans.every(plan => {
            const masterQty = parseInt(plan.total_quantity) || 0;
            if (!plan.vendor_name.trim() || !plan.country.trim() || !plan.start_date || !plan.deadline) return false;
            if (masterQty === 0) return false;
            const langSum = (plan.languages || []).reduce((s, l) => s + (parseInt(l.ratio) || 0), 0);
            const targetSum = getPlanQuantity(plan);
            if (langSum !== masterQty || targetSum !== masterQty) return false;
            if (!(plan.languages || []).every(l => l.code.trim())) return false;
            if (!(plan.project_info_groups || []).every(g => g.category !== 'NULL')) return false;
            if (plan.price_type === 'package') {
                if (!plan.package_id) return false;
                const pkgList = vendorPackages[plan.vendor_name] || [];
                const pkg = pkgList.find(p => p.id === plan.package_id);
                if (pkg) {
                    const otherUsage = plans
                        .filter(p => p.id !== plan.id && p.package_id === plan.package_id)
                        .reduce((s, p) => s + (parseInt(p.total_quantity) || 0), 0);
                    const effRemaining = Math.max(0, pkg.remaining_quantity - otherUsage);
                    if (effRemaining < masterQty) return false;
                }
            }
            return true;
        });
    }, [campaignTitle, personInCharge, plans]);

    // Serialize plans for hidden input. Apply a final dripfeed deadline recompute here so the
    // submitted JSON always reflects the auto-calc, even if a render race left state stale.
    const plansForSubmit = normalizePlanDates(plans).map(plan => {
        const out = { ...plan };
        const deadlineManualOverride = out.deadlineManualOverride;
        delete out.id;
        delete out.manualOverride;
        delete out.deadlineManualOverride;
        delete out.startDateManualOverride;
        if (out.dripfeed_enabled && !deadlineManualOverride && out.start_date) {
            const period = parseInt(out.dripfeed_period) || 0;
            if (period > 0) {
                out.deadline = addDaysToDateStr(out.start_date, period);
            }
        }
        return out;
    });

    return (
        <div className="max-w-4xl mx-auto py-10 px-4 sm:px-6 lg:px-8 pb-24">
            <h1 className="text-4xl font-bold text-gray-900 tracking-tight mb-2">Kickoff Campaign</h1>
            <p className="text-sm text-gray-500 mb-8">
                Create a campaign with one or more vendor plans. Each plan generates its own vendor portal link.
            </p>

            {state?.success && state?.results && (
                <div className="rounded-md bg-green-50 p-4 mb-6 border border-green-200 shadow-sm">
                    <h3 className="text-sm font-bold text-green-800 mb-3">Campaign Kicked Off — {state.results.length} Plan(s) Created</h3>
                    <div className="space-y-2">
                        {state.results.map((r, i) => (
                            <div key={i}>
                                <p className="text-xs font-semibold text-green-700 mb-1">Plan {i + 1}: {r.planLabel}</p>
                                <code className="block p-2 bg-green-100 rounded text-green-900 border border-green-300 select-all overflow-x-auto font-mono text-xs">
                                    {typeof window !== 'undefined' ? `${window.location.origin}/vendor/${r.vendorSlug}/portal/${r.vendorUuid}/project/${r.hash}` : `/vendor/${r.vendorSlug}/portal/${r.vendorUuid}/project/${r.hash}`}
                                </code>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {state?.success === false && state?.message && (
                <div className="rounded-md bg-red-50 p-4 mb-6 border border-red-200">
                    <h3 className="text-sm font-medium text-red-800">Error</h3>
                    <p className="text-sm text-red-700 mt-1">{state.message}</p>
                </div>
            )}

            <form ref={formRef} action={formAction} className="space-y-8">
                {/* Campaign Header */}
                <div className="bg-white p-6 sm:p-8 rounded-xl shadow-sm border border-gray-100">
                    <h2 className="text-lg font-bold text-gray-900 border-b pb-2 mb-5">Campaign Details</h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                        <div className="sm:col-span-2">
                            <label className="block text-sm font-medium text-gray-700 mb-1">Campaign Title *</label>
                            <input type="text" name="campaign_title" required value={campaignTitle}
                                onChange={e => setCampaignTitle(e.target.value)}
                                list="campaign-title-suggestions"
                                placeholder="e.g. Client XYZ SEO Campaign Q2"
                                autoComplete="off"
                                className="block w-full border border-gray-300 rounded-md shadow-sm p-2.5 text-gray-900 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" />
                            <datalist id="campaign-title-suggestions">
                                {campaignSuggestions.map((title, i) => (
                                    <option key={i} value={title} />
                                ))}
                            </datalist>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Person in Charge *</label>
                            <input type="text" name="person_in_charge" required value={personInCharge}
                                onChange={e => setPersonInCharge(e.target.value)}
                                placeholder="e.g. John"
                                className="block w-full border border-gray-300 rounded-md shadow-sm p-2.5 text-gray-900 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Client Name</label>
                            <input type="text" name="client_name" value={clientName}
                                onChange={e => setClientName(e.target.value)}
                                placeholder="e.g. Acme Corp (optional)"
                                className="block w-full border border-gray-300 rounded-md shadow-sm p-2.5 text-gray-900 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" />
                        </div>
                    </div>
                </div>

                {/* Plan Cards */}
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <h2 className="text-lg font-bold text-gray-900">Vendor Plans ({plans.length})</h2>
                        <button type="button" onClick={addPlan}
                            className="inline-flex items-center gap-2 text-sm font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 px-4 py-2 rounded-lg border border-indigo-200 transition-colors">
                            <Plus className="w-4 h-4" /> Add Plan
                        </button>
                    </div>
                    {plans.map((plan, i) => (
                        <PlanCard key={plan.id} plan={plan} planIndex={i}
                            categories={categories}
                            onUpdate={updatePlan}
                            onRemove={removePlan}
                            canRemove={plans.length > 1}
                            vendorPackages={vendorPackages}
                            allPlans={plans}
                            onLoadPackages={loadVendorPackages} />
                    ))}
                </div>

                {/* Hidden serialised plans */}
                <input type="hidden" name="plans_json" value={JSON.stringify(plansForSubmit)} />

                <SubmitButton isValid={isFormValid} />
            </form>
        </div>
    );
}
