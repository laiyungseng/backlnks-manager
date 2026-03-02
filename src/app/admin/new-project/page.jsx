'use client';

import { useState, useActionState, useMemo, useRef, useEffect } from 'react';
import { createProjectAction } from './actions';
import { useFormStatus } from 'react-dom';
import { Plus, Trash2 } from 'lucide-react';

const initialState = {
    message: '',
    errors: null,
    success: false,
    hash: null, // Return project hash instead of token
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

    const [targets, setTargets] = useState([
        { id: crypto.randomUUID(), anchor_text: '', target_url: '', quantity: 1 }
    ]);

    useEffect(() => {
        if (state?.success && state?.hash) {
            formRef.current?.reset();
            setMasterQuantity(1);
            setDripFeedEnabled(true);
            setDripfeedPeriod('');
            setUrlsPerDay('');
            setManualOverride(false);
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
                                    {/* Will read domain on client securely, or fallback */}
                                    {typeof window !== 'undefined' ? `${window.location.origin}/vendor/${state.hash}` : `/vendor/${state.hash}`}
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
                            <input type="text" name="project_name" required className="block w-full border border-gray-300 rounded-md shadow-sm p-2.5 text-gray-900 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Project Owner (Internal)</label>
                            <input type="text" name="owner" required className="block w-full border border-gray-300 rounded-md shadow-sm p-2.5 text-gray-900 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Vendor Assigned</label>
                            <input type="text" name="vendor_name" required className="block w-full border border-gray-300 rounded-md shadow-sm p-2.5 text-gray-900 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" />
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
                            <label className="block text-sm font-medium text-gray-700 mb-1">Country Code (e.g. MY, AUS, PNG)</label>
                            <input type="text" name="country" required placeholder="MY" className="block w-full border border-gray-300 rounded-md shadow-sm p-2.5 text-gray-900 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm uppercase font-mono" maxLength={3} />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Language Code (e.g. EN, MY)</label>
                            <input type="text" name="language" required placeholder="EN" className="block w-full border border-gray-300 rounded-md shadow-sm p-2.5 text-gray-900 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm uppercase font-mono" maxLength={2} />
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
                    </div>
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

                {/* 2. Target URL & Anchor Configuration */}
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

                    {/* Hidden input to pass generic JSON state array safely to server action */}
                    <input type="hidden" name="targets_json" value={JSON.stringify(targets)} />
                </div>

                <div className="sm:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Remarks (Optional)</label>
                    <textarea name="remarks" rows={3} className="block w-full border border-gray-300 rounded-md shadow-sm p-3 text-gray-900 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" />
                </div>

                <SubmitButton isValid={isValidQuantity} />
            </form>
        </div>
    );
}
