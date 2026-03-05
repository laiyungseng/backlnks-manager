'use client';

import { useState, useActionState, useMemo, useRef, useEffect } from 'react';
import { createProjectAction } from './actions';
import { useFormStatus } from 'react-dom';
import { Plus, Trash2, Languages } from 'lucide-react';

const initialState = {
    message: '',
    errors: null,
    success: false,
    hash: null,
    vendorSlug: null,
};

function SubmitButton({ isValid }) {
    const { pending } = useFormStatus();
    const disabled = pending || !isValid;

    return (
        <button
            type="submit"
            disabled={disabled}
            className={`mt-6 w-full py-3 px-4 rounded-md text-white font-bold shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500
        ${disabled ? 'bg-indigo-300 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700'} 
        `}
        >
            {pending ? 'Encrypting & Bootstrapping Project...' : 'Kickoff Project'}
        </button>
    );
}

export default function NewProjectPage() {
    const [state, formAction] = useActionState(createProjectAction, initialState);
    const formRef = useRef(null);

    // Dynamic Row State
    const [masterQuantity, setMasterQuantity] = useState(1);
    const [dripFeedEnabled, setDripFeedEnabled] = useState(true);
    const [dripfeedPeriod, setDripfeedPeriod] = useState('');
    const [urlsPerDay, setUrlsPerDay] = useState('');
    const [manualOverride, setManualOverride] = useState(false);

    // Performance Toggles
    const [urlEntryEnabled, setUrlEntryEnabled] = useState(false);
    const [randomizeLanguages, setRandomizeLanguages] = useState(false);

    // Pricing State
    const [price, setPrice] = useState(0);
    const [priceType, setPriceType] = useState('per_url');

    // Language Ratio State
    const [languages, setLanguages] = useState([
        { id: crypto.randomUUID(), code: '', ratio: 100 }
    ]);

    const [targets, setTargets] = useState([
        { id: crypto.randomUUID(), anchor_text: '', target_url: '', quantity: 1 }
    ]);

    useEffect(() => {
        if (state?.success && state?.hash) {
            window.scrollTo({ top: 0, behavior: 'smooth' });
            setTimeout(() => {
                alert('Project Kicked Off Successfully!');
            }, 300);
            formRef.current?.reset();
            setMasterQuantity(1);
            setDripFeedEnabled(true);
            setDripfeedPeriod('');
            setUrlsPerDay('');
            setManualOverride(false);
            setUrlEntryEnabled(false);
            setRandomizeLanguages(false);
            setPrice(0);
            setPriceType('per_url');
            setLanguages([{ id: crypto.randomUUID(), code: '', ratio: 100 }]);
            setTargets([{ id: crypto.randomUUID(), anchor_text: '', target_url: '', quantity: 1 }]);
        }
    }, [state?.success, state?.hash]);

    // Auto calculate URLs per day globally
    useEffect(() => {
        if (dripFeedEnabled && !manualOverride) {
            const period = parseInt(dripfeedPeriod) || 0;
            if (masterQuantity > 0 && period > 0) {
                setUrlsPerDay(Math.ceil(masterQuantity / period));
            } else {
                setUrlsPerDay('');
            }
        }
    }, [masterQuantity, dripfeedPeriod, dripFeedEnabled, manualOverride]);

    // --- Language Ratio Helpers ---
    const addLanguage = () => {
        setLanguages([...languages, { id: crypto.randomUUID(), code: '', ratio: 0 }]);
    };

    const removeLanguage = (idToRemove) => {
        if (languages.length > 1) {
            const remaining = languages.filter(l => l.id !== idToRemove);
            // If only 1 left, auto-set to 100%
            if (remaining.length === 1) {
                remaining[0].ratio = 100;
            }
            setLanguages(remaining);
        }
    };

    const updateLanguage = (id, field, value) => {
        setLanguages(languages.map(l =>
            l.id === id ? { ...l, [field]: field === 'ratio' ? parseInt(value) || 0 : value.toUpperCase() } : l
        ));
    };

    const languageRatioSum = useMemo(() => {
        return languages.reduce((sum, l) => sum + (parseInt(l.ratio) || 0), 0);
    }, [languages]);

    const isValidLanguageRatio = languageRatioSum === 100;
    const allLanguagesFilled = languages.every(l => l.code.trim().length > 0);

    // --- Target Row Helpers ---
    const addTargetRow = () => {
        setTargets([...targets, { id: crypto.randomUUID(), anchor_text: '', target_url: '', quantity: 1 }]);
    };

    const removeTargetRow = (idToRemove) => {
        if (targets.length > 1) {
            setTargets(targets.filter(t => t.id !== idToRemove));
        }
    };

    const updateTarget = (id, field, value) => {
        setTargets(targets.map(t =>
            t.id === id ? { ...t, [field]: field === 'quantity' ? parseInt(value) || 0 : value } : t
        ));
    };

    const currentSum = useMemo(() => {
        return targets.reduce((acc, row) => acc + (parseInt(row.quantity) || 0), 0);
    }, [targets]);

    const isValidQuantity = currentSum === masterQuantity && masterQuantity > 0;

    // Derived first language for backward compat hidden field
    const firstLanguageCode = languages[0]?.code || '';

    return (
        <div className="max-w-4xl mx-auto py-10 px-4 sm:px-6 lg:px-8 pb-24">
            <h1 className="text-3xl font-bold text-gray-900 tracking-tight mb-2">Kickoff Project</h1>
            <p className="text-sm text-gray-500 mb-8">
                Initialize an event-sourced SEO project. Configure complex URL allocations securely.
            </p>

            {state?.success && state?.hash && (
                <div className="rounded-md bg-green-50 p-4 mb-6 border border-green-200 shadow-sm">
                    <div className="flex">
                        <div className="ml-3">
                            <h3 className="text-sm font-medium text-green-800">Project Kicked Off Successfully!</h3>
                            <div className="mt-2 text-sm text-green-700">
                                <p>Encrypted Vendor Allocation Link (Share with Vendor):</p>
                                <code className="mt-1 block p-2 bg-green-100 rounded text-green-900 border border-green-300 select-all overflow-x-auto font-mono text-xs">
                                    {typeof window !== 'undefined' ? `${window.location.origin}/vendor/${state.vendorSlug || 'vendor'}/${state.hash}` : `/vendor/${state.vendorSlug || 'vendor'}/${state.hash}`}
                                </code>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {state?.success === false && state?.message && (
                <div className="rounded-md bg-red-50 p-4 mb-6 border border-red-200">
                    <div className="ml-3">
                        <h3 className="text-sm font-medium text-red-800">Error</h3>
                        <p className="text-sm text-red-700 mt-1">{state.message}</p>
                    </div>
                </div>
            )}

            <form ref={formRef} action={formAction} className="space-y-8 bg-white p-6 sm:p-8 rounded-xl shadow-sm border border-gray-100">
                {/* 1. Core Project Settings */}
                <div>
                    <h2 className="text-lg font-bold text-gray-900 border-b pb-2 mb-4">Core Settings</h2>
                    <div className="grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-2">
                        <div className="sm:col-span-2">
                            <label className="block text-sm font-medium text-gray-700 mb-1">Project Name</label>
                            <input type="text" name="project_name" required placeholder="e.g. Client XYZ SEO Campaign" className="block w-full border border-gray-300 rounded-md shadow-sm p-2.5 text-gray-900 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Project Owner (Internal)</label>
                            <input type="text" name="owner" required placeholder="e.g. John" className="block w-full border border-gray-300 rounded-md shadow-sm p-2.5 text-gray-900 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Vendor Assigned</label>
                            <input type="text" name="vendor_name" required placeholder="e.g. IBETSEO" className="block w-full border border-gray-300 rounded-md shadow-sm p-2.5 text-gray-900 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
                            <input type="date" name="start_date" required className="block w-full border border-gray-300 rounded-md shadow-sm p-2.5 text-gray-900 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Deadline</label>
                            <input type="date" name="deadline" required className="block w-full border border-gray-300 rounded-md shadow-sm p-2.5 text-gray-900 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Country Code</label>
                            <input type="text" name="country" required placeholder="MY, AUS, PNG" className="block w-full border border-gray-300 rounded-md shadow-sm p-2.5 text-gray-900 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm uppercase font-mono" maxLength={3} />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                            <select name="backlinks_category" required className="block w-full border border-gray-300 rounded-md shadow-sm p-2.5 text-gray-900 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm bg-white">
                                <option value="NULL">NULL</option>
                                <option value="PBN">PBN</option>
                                <option value="GP">GP</option>
                                <option value="Tier 2">Tier 2</option>
                                <option value="Tier 2 EDU">Tier 2 EDU</option>
                                <option value="Tier 2 GOV">Tier 2 GOV</option>
                                <option value="EDU GP">EDU GP</option>
                                <option value="GOV GP">GOV GP</option>
                                <option value="Web2.0">Web2.0</option>
                                <option value="Bookmark">Bookmark</option>
                                <option value="Forum">Forum</option>
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Sheet Name (Optional)</label>
                            <input type="text" name="sheet_name" placeholder="Leave blank for null" className="block w-full border border-gray-300 rounded-md shadow-sm p-2.5 text-gray-900 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Total Quantity Desired</label>
                            <input type="number" name="quantity" required min="1" value={masterQuantity} onChange={(e) => setMasterQuantity(parseInt(e.target.value) || 0)} className="block w-full border border-gray-300 rounded-md shadow-sm p-2.5 text-gray-900 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm font-bold bg-indigo-50" />
                        </div>

                        <div className="sm:col-span-2 mt-2 pt-4 border-t border-gray-100 flex items-center justify-between">
                            <div>
                                <label className="block text-sm font-bold text-gray-900 mb-1">Perform URL Entry</label>
                                <p className="text-xs text-gray-500">Allow vendor to enter domain URLs for each published link.</p>
                            </div>
                            <label className="inline-flex items-center cursor-pointer">
                                <input type="checkbox" className="sr-only peer" checked={urlEntryEnabled} onChange={(e) => setUrlEntryEnabled(e.target.checked)} />
                                <div className="relative w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                            </label>
                            <input type="hidden" name="url_entry_enabled" value={urlEntryEnabled ? 'true' : 'false'} />
                        </div>
                    </div>
                </div>

                {/* Pricing Section */}
                <div className="bg-gray-50 -mx-6 sm:-mx-8 p-6 sm:p-8 border-y border-gray-200">
                    <h2 className="text-lg font-bold text-gray-900 mb-4">Pricing Configuration</h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 bg-white p-5 rounded-lg border border-gray-200 shadow-sm">
                        <div className="relative">
                            <label className="block text-sm font-medium text-gray-700 mb-1">Project Price</label>
                            <div className="relative rounded-md shadow-sm">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <span className="text-gray-500 sm:text-sm font-bold">$</span>
                                </div>
                                <input
                                    type="number"
                                    name="price"
                                    required
                                    min="0"
                                    step="0.01"
                                    value={price}
                                    onChange={(e) => setPrice(parseFloat(e.target.value) || 0)}
                                    className="pl-7 block w-full border border-gray-300 rounded-md p-2.5 text-gray-900 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm font-mono"
                                    placeholder="0.00"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Pricing Model</label>
                            <div className="flex bg-gray-100 rounded-lg p-1">
                                <button
                                    type="button"
                                    onClick={() => setPriceType('per_url')}
                                    className={`flex-1 text-sm font-medium py-1.5 px-3 rounded-md transition-colors ${priceType === 'per_url' ? 'bg-white shadow-sm text-indigo-700' : 'text-gray-500 hover:text-gray-700'}`}
                                >
                                    Per URL
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setPriceType('package')}
                                    className={`flex-1 text-sm font-medium py-1.5 px-3 rounded-md transition-colors ${priceType === 'package' ? 'bg-white shadow-sm text-indigo-700' : 'text-gray-500 hover:text-gray-700'}`}
                                >
                                    Total Package
                                </button>
                            </div>
                            <input type="hidden" name="price_type" value={priceType} />
                        </div>
                    </div>
                </div>

                {/* Language Ratio Section */}
                <div className="bg-gradient-to-r from-indigo-50 to-purple-50 -mx-6 sm:-mx-8 p-6 sm:p-8 border-y border-indigo-100">
                    <div className="flex flex-col sm:flex-row sm:justify-between sm:items-end mb-6 gap-4">
                        <div>
                            <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                                <Languages className="w-5 h-5 text-indigo-600" />
                                Language Distribution
                            </h2>
                            <p className="text-xs text-gray-500 mt-1">Specify content languages and their quantity ratio. Must total 100%.</p>
                        </div>
                        <div className={`text-sm font-bold px-4 py-2 rounded-md border flex items-center justify-center transition-colors shadow-sm ${isValidLanguageRatio ? 'bg-green-100 text-green-800 border-green-300' : 'bg-red-50 text-red-700 border-red-200'}`}>
                            Total: {languageRatioSum}% {isValidLanguageRatio ? '✓' : '✗'}
                        </div>
                    </div>

                    <div className="space-y-3">
                        {languages.map((lang, index) => (
                            <div key={lang.id} className="flex items-center gap-3 bg-white p-3 rounded-lg border border-gray-200 shadow-sm group hover:border-indigo-300 transition-all">
                                <div className="text-gray-400 font-mono text-xs w-6 text-center">#{index + 1}</div>

                                <div className="flex-1">
                                    <input
                                        type="text"
                                        placeholder="EN, MY, BM, ZH, JP..."
                                        value={lang.code}
                                        onChange={(e) => updateLanguage(lang.id, 'code', e.target.value)}
                                        maxLength={5}
                                        className="w-full border border-gray-300 rounded p-2 text-sm text-gray-900 uppercase font-mono focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all placeholder:text-gray-400 placeholder:normal-case"
                                    />
                                </div>

                                <div className="w-28 relative">
                                    <input
                                        type="number"
                                        min="0"
                                        max="100"
                                        value={lang.ratio}
                                        onChange={(e) => updateLanguage(lang.id, 'ratio', e.target.value)}
                                        readOnly={languages.length === 1}
                                        className={`w-full border border-gray-300 rounded p-2 text-sm font-mono text-right pr-7 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all ${languages.length === 1 ? 'bg-gray-50 text-gray-500 cursor-not-allowed' : 'text-gray-900'}`}
                                    />
                                    <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-sm font-bold text-gray-400">%</span>
                                </div>

                                {lang.code && masterQuantity > 0 && (
                                    <div className="text-xs text-indigo-600 font-semibold whitespace-nowrap w-16 text-center" title="Calculated quantity for this language">
                                        = {Math.round(masterQuantity * lang.ratio / 100)} qty
                                    </div>
                                )}

                                {languages.length > 1 && (
                                    <button
                                        type="button"
                                        onClick={() => removeLanguage(lang.id)}
                                        title="Remove Language"
                                        className="text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md p-1.5 transition-colors shrink-0"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                )}
                            </div>
                        ))}
                    </div>

                    <div className="mt-4 flex items-center justify-between">
                        <button
                            type="button"
                            onClick={addLanguage}
                            className="inline-flex items-center gap-1.5 text-sm font-semibold text-indigo-700 hover:text-indigo-800 bg-white hover:bg-indigo-50 px-4 py-2 rounded-md transition-colors border border-indigo-200 shadow-sm"
                        >
                            <Plus className="w-4 h-4" /> Add Language
                        </button>

                        {!isValidLanguageRatio && (
                            <span className="text-sm font-medium text-red-600 bg-red-50 px-3 py-1 rounded-full animate-pulse">
                                {languageRatioSum < 100 ? `${100 - languageRatioSum}% remaining` : `${languageRatioSum - 100}% over limit`}
                            </span>
                        )}

                        {/* Randomize Distribution Toggle */}
                        {languages.length > 1 && (
                            <div className="flex items-center gap-3">
                                <label className="text-sm font-medium text-gray-700 cursor-pointer">Randomize Distribution</label>
                                <label className="inline-flex items-center cursor-pointer">
                                    <input type="checkbox" className="sr-only peer" checked={randomizeLanguages} onChange={(e) => setRandomizeLanguages(e.target.checked)} />
                                    <div className="relative w-9 h-5 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-purple-600"></div>
                                </label>
                            </div>
                        )}
                    </div>

                    {/* Hidden inputs for form submission */}
                    <input type="hidden" name="randomize_languages" value={randomizeLanguages ? 'true' : 'false'} />
                    <input type="hidden" name="language" value={firstLanguageCode} />
                    <input type="hidden" name="languages_json" value={JSON.stringify(languages.map(l => ({ code: l.code, ratio: l.ratio })))} />
                </div>

                {/* Drip Feed Configuration */}
                <div className="bg-gray-50 -mx-6 sm:-mx-8 p-6 sm:p-8 border-y border-gray-200">
                    <div className="flex flex-col sm:flex-row sm:justify-between sm:items-end mb-6 gap-4">
                        <div>
                            <h2 className="text-lg font-bold text-gray-900">Drip Feed Configuration</h2>
                            <p className="text-xs text-gray-500 mt-1">Configure project-wide daily limits for vendor submissions.</p>
                            <label className="inline-flex items-center cursor-pointer mt-4 border border-gray-200 rounded-md px-3 py-2 bg-white shadow-sm hover:bg-gray-50 transition-colors">
                                <input type="checkbox" name="dripfeed_enabled" className="sr-only peer" checked={dripFeedEnabled} onChange={(e) => setDripFeedEnabled(e.target.checked)} />
                                <div className="relative w-9 h-5 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600"></div>
                                <span className="ml-3 text-sm font-semibold text-indigo-700">Enable Drip Feed Mode</span>
                            </label>
                        </div>
                    </div>

                    {dripFeedEnabled && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 bg-white p-5 rounded-lg border border-gray-200 shadow-sm">
                            <div>
                                <h3 className="text-sm font-bold text-gray-800 mb-1">Total Dripfeed Period</h3>
                                <label className="block text-xs text-gray-500 mb-2">Duration in Days</label>
                                <input
                                    type="number"
                                    name="dripfeed_period"
                                    required={dripFeedEnabled}
                                    placeholder="e.g. 10, 20"
                                    min="1"
                                    value={dripfeedPeriod}
                                    onChange={(e) => setDripfeedPeriod(e.target.value)}
                                    className="block w-full border border-gray-300 rounded-md shadow-sm p-2.5 text-gray-900 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm font-mono"
                                />
                            </div>

                            <div className="relative">
                                <div className="flex items-center justify-between mb-1">
                                    <h3 className="text-sm font-bold text-gray-800">Quantity URLs per day</h3>
                                    <label className="flex items-center text-xs text-indigo-600 cursor-pointer hover:text-indigo-800">
                                        <input
                                            type="checkbox"
                                            title="Manual Override"
                                            name="manual_override"
                                            checked={manualOverride}
                                            onChange={(e) => setManualOverride(e.target.checked)}
                                            className="w-3.5 h-3.5 mr-1.5 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500 cursor-pointer"
                                        />
                                        Manual Override
                                    </label>
                                </div>
                                <label className="block text-xs text-gray-500 mb-2">Required submissions per day</label>
                                <input
                                    type="number"
                                    name="urls_per_day"
                                    required={dripFeedEnabled}
                                    placeholder="Auto"
                                    readOnly={!manualOverride}
                                    min="1"
                                    value={urlsPerDay}
                                    onChange={(e) => setUrlsPerDay(e.target.value)}
                                    className={`block w-full border ${!manualOverride ? 'bg-gray-100 border-gray-200 text-gray-500 cursor-not-allowed' : 'border-gray-300 text-gray-900 bg-white placeholder:text-gray-400'} rounded-md p-2.5 text-sm font-mono focus:ring-indigo-500 focus:border-transparent outline-none transition-all shadow-sm`}
                                />
                            </div>
                        </div>
                    )}
                </div>

                {/* Placement Targets */}
                <div className="bg-gray-50 -mx-6 sm:-mx-8 p-6 sm:p-8 border-y border-gray-200">
                    <div className="flex flex-col sm:flex-row sm:justify-between sm:items-end mb-6 gap-4">
                        <div>
                            <h2 className="text-lg font-bold text-gray-900">Placement Targets</h2>
                            <p className="text-xs text-gray-500 mt-1">Specify unique anchor and URL combinations. Sub-quantities must match total.</p>
                        </div>
                        <div className={`text-sm font-bold px-4 py-2 rounded-md border flex items-center justify-center transition-colors shadow-sm ${isValidQuantity ? 'bg-green-100 text-green-800 border-green-300' : 'bg-red-50 text-red-700 border-red-200'}`}>
                            Allocated: {currentSum} / {masterQuantity}
                        </div>
                    </div>

                    <div className="space-y-4">
                        {targets.map((row, index) => (
                            <div key={row.id} className="flex flex-col sm:flex-row gap-3 items-start sm:items-center bg-white p-4 rounded-lg border border-gray-200 shadow-sm relative group transition-all hover:border-indigo-300">
                                <div className="hidden sm:flex text-gray-400 font-mono text-xs w-6 justify-center">#{index + 1}</div>

                                <div className="flex-[1.2] w-full">
                                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5 sm:hidden">Anchor / Keyword</label>
                                    <input
                                        type="text"
                                        required
                                        placeholder="Enter target keyword"
                                        value={row.anchor_text}
                                        onChange={(e) => updateTarget(row.id, 'anchor_text', e.target.value)}
                                        className="w-full border border-gray-300 rounded p-2 text-sm text-gray-900 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all placeholder:text-gray-400"
                                    />
                                </div>
                                <div className="flex-[2] w-full">
                                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5 sm:hidden">Destination URL</label>
                                    <input
                                        type="url"
                                        required
                                        placeholder="https://client-site.com/seo-page"
                                        value={row.target_url}
                                        onChange={(e) => updateTarget(row.id, 'target_url', e.target.value)}
                                        className="w-full border border-gray-300 rounded p-2 text-sm text-gray-900 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all placeholder:text-gray-400"
                                    />
                                </div>
                                <div className="w-full sm:w-28 relative">
                                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5 sm:hidden">Qty</label>
                                    <input
                                        type="number"
                                        required
                                        min="1"
                                        value={row.quantity}
                                        onChange={(e) => updateTarget(row.id, 'quantity', e.target.value)}
                                        className="w-full border border-gray-300 rounded p-2 text-sm text-gray-900 font-mono focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all pr-8"
                                    />
                                </div>

                                {targets.length > 1 && (
                                    <button
                                        type="button"
                                        onClick={() => removeTargetRow(row.id)}
                                        title="Remove Target"
                                        className="text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md p-1.5 transition-colors focus:outline-none shrink-0 self-end mb-1 sm:self-center sm:mb-0 ml-1"
                                    >
                                        <Trash2 className="w-5 h-5" />
                                    </button>
                                )}
                            </div>
                        ))}
                    </div>

                    <div className="mt-5 flex items-center justify-between">
                        <button
                            type="button"
                            onClick={addTargetRow}
                            className="inline-flex items-center gap-1.5 text-sm font-semibold text-indigo-700 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 px-4 py-2 rounded-md transition-colors border border-indigo-200"
                        >
                            <Plus className="w-4 h-4" /> Add Another Target
                        </button>

                        {!isValidQuantity && (
                            <span className="text-sm font-medium text-red-600 bg-red-50 px-3 py-1 rounded-full animate-pulse">
                                Requires {masterQuantity - currentSum > 0 ? `${masterQuantity - currentSum} more` : `${Math.abs(masterQuantity - currentSum)} less`} targets to match Total.
                            </span>
                        )}
                    </div>

                    <input type="hidden" name="targets_json" value={JSON.stringify(targets)} />
                </div>

                <div className="sm:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Remarks (Optional)</label>
                    <textarea name="remarks" rows={3} placeholder="Any additional notes for this project..." className="block w-full border border-gray-300 rounded-md shadow-sm p-3 text-gray-900 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" />
                </div>

                <SubmitButton isValid={isValidQuantity && isValidLanguageRatio && allLanguagesFilled} />
            </form>
        </div>
    );
}
