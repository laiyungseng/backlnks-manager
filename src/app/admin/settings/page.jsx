'use client';

import { useState, useEffect } from 'react';
import { Database, Save, Eye, EyeOff, CheckCircle2, AlertCircle, Loader2, Wifi, WifiOff } from 'lucide-react';
import { saveApiCredentialAction, getApiCredentialStatusAction, checkConnectionAction } from './actions';

export default function SettingsPage() {
    // Form inputs
    const [url, setUrl] = useState('');
    const [anonKey, setAnonKey] = useState('');
    const [showAnonKey, setShowAnonKey] = useState(false);

    // Save state
    const [isSaving, setIsSaving] = useState(false);
    const [saveStatus, setSaveStatus] = useState(null); // 'success' | 'error' | null
    const [saveMessage, setSaveMessage] = useState('');

    // Existing masked credential display
    const [existing, setExisting] = useState(null);
    const [isLoadingExisting, setIsLoadingExisting] = useState(true);

    // Connection check state
    const [connStatus, setConnStatus] = useState('idle'); // 'idle' | 'checking' | 'connected' | 'failed'
    const [connMessage, setConnMessage] = useState('');
    const [isCheckingConn, setIsCheckingConn] = useState(false);

    function getAdminUserId() {
        const session = JSON.parse(localStorage.getItem('df_admin_session') || '{}');
        return session?.user?.id || null;
    }

    // Load existing masked credentials on mount
    useEffect(() => {
        async function load() {
            const adminUserId = getAdminUserId();
            if (!adminUserId) { setIsLoadingExisting(false); return; }
            try {
                const result = await getApiCredentialStatusAction(adminUserId);
                if (result.exists) setExisting(result);
            } catch (e) {
                console.error('Failed to load credentials:', e);
            } finally {
                setIsLoadingExisting(false);
            }
        }
        load();
    }, []);

    async function handleSave(e) {
        e.preventDefault();
        setIsSaving(true);
        setSaveStatus(null);
        setSaveMessage('');
        setConnStatus('idle');
        setConnMessage('');

        try {
            const adminUserId = getAdminUserId();
            const result = await saveApiCredentialAction(adminUserId, {
                supabase_url: url,
                supabase_anon_key: anonKey,
            });

            if (result.success) {
                setSaveStatus('success');
                setSaveMessage('Credentials encrypted and saved successfully.');
                const refreshed = await getApiCredentialStatusAction(adminUserId);
                if (refreshed.exists) setExisting(refreshed);
                setUrl('');
                setAnonKey('');
                setTimeout(() => setSaveStatus(null), 5000);
            } else {
                setSaveStatus('error');
                setSaveMessage(result.message || 'Failed to save credentials.');
            }
        } catch (e) {
            setSaveStatus('error');
            setSaveMessage(e.message);
        } finally {
            setIsSaving(false);
        }
    }

    async function handleCheckConnection() {
        setIsCheckingConn(true);
        setConnStatus('checking');
        setConnMessage('');
        try {
            const adminUserId = getAdminUserId();
            const result = await checkConnectionAction(adminUserId);
            setConnStatus(result.success ? 'connected' : 'failed');
            setConnMessage(result.message);
        } catch (e) {
            setConnStatus('failed');
            setConnMessage(e.message);
        } finally {
            setIsCheckingConn(false);
        }
    }

    const hasInput = url.trim() || anonKey.trim();

    return (
        <div className="max-w-3xl mx-auto space-y-8">
            {/* Page header */}
            <div>
                <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Settings</h1>
                <p className="mt-2 text-sm text-gray-500">
                    Manage your Supabase connection credentials. All values are encrypted before storage.
                </p>
            </div>

            {/* Credentials card */}
            <div className="bg-white rounded-xl shadow-sm ring-1 ring-gray-200 overflow-hidden">
                {/* Card header */}
                <div className="px-6 py-5 border-b border-gray-100 bg-gradient-to-r from-gray-50 to-white">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-indigo-100 rounded-lg">
                            <Database className="w-5 h-5 text-indigo-600" />
                        </div>
                        <div>
                            <h2 className="text-lg font-semibold text-gray-900">Database Connection</h2>
                            <p className="text-xs text-gray-500 mt-0.5">
                                All credentials are encrypted (AES-256) and stored securely in the database.
                            </p>
                        </div>
                    </div>
                </div>

                <div className="p-6 space-y-6">
                    {/* Existing masked values */}
                    {!isLoadingExisting && existing && (
                        <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4">
                            <p className="text-[10px] font-bold text-indigo-500 uppercase tracking-widest mb-3">
                                Currently Saved (Encrypted)
                            </p>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                    <span className="text-xs text-indigo-400 font-medium">Project URL</span>
                                    <p className="font-mono text-xs text-indigo-900 mt-0.5 truncate">{existing.maskedUrl}</p>
                                </div>
                                <div>
                                    <span className="text-xs text-indigo-400 font-medium">Publishable Key</span>
                                    <p className="font-mono text-xs text-indigo-900 mt-0.5 tracking-widest">{existing.maskedAnonKey}</p>
                                </div>
                            </div>
                        </div>
                    )}

                    <form onSubmit={handleSave} className="space-y-5">
                        {/* Supabase URL */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1.5">
                                Supabase Project URL
                            </label>
                            <input
                                type="url"
                                value={url}
                                onChange={(e) => setUrl(e.target.value)}
                                placeholder="https://your-project-id.supabase.co"
                                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm font-mono text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-shadow"
                            />
                            <p className="mt-1 text-xs text-gray-400">
                                Project Settings → API → Project URL
                            </p>
                        </div>

                        {/* Publishable key */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1.5">
                                Publishable Key
                            </label>
                            <div className="relative">
                                <input
                                    type={showAnonKey ? 'text' : 'password'}
                                    value={anonKey}
                                    onChange={(e) => setAnonKey(e.target.value)}
                                    placeholder="sb-public-xxx"
                                    className="w-full px-4 py-2.5 pr-12 border border-gray-300 rounded-lg text-sm font-mono text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-shadow"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowAnonKey(!showAnonKey)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                                >
                                    {showAnonKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                </button>
                            </div>
                            <p className="mt-1 text-xs text-gray-400">
                                Project Settings → API → Project API keys → <code className="bg-gray-100 px-1 py-0.5 rounded text-[10px]">anon public</code>
                            </p>
                        </div>

                        {/* Save status */}
                        {saveStatus === 'success' && (
                            <div className="flex items-center gap-2 px-4 py-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-800">
                                <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0" />
                                <span>{saveMessage}</span>
                            </div>
                        )}
                        {saveStatus === 'error' && (
                            <div className="flex items-center gap-2 px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-800">
                                <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
                                <span>{saveMessage}</span>
                            </div>
                        )}

                        {/* Save button */}
                        <div className="flex justify-end pt-1">
                            <button
                                type="submit"
                                disabled={isSaving || !hasInput}
                                className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                            >
                                {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                {isSaving ? 'Encrypting & Saving...' : 'Save Credentials'}
                            </button>
                        </div>
                    </form>

                    {/* Connection check strip */}
                    <div className="border-t border-gray-100 pt-5 flex items-center gap-4">
                        <div className="flex items-center gap-2.5 flex-1 min-w-0">
                            <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${
                                connStatus === 'connected' ? 'bg-green-500 shadow-[0_0_6px_2px_rgba(34,197,94,0.4)]' :
                                connStatus === 'failed'    ? 'bg-red-500 shadow-[0_0_6px_2px_rgba(239,68,68,0.4)]' :
                                connStatus === 'checking'  ? 'bg-amber-400 animate-pulse' :
                                'bg-gray-300'
                            }`} />
                            <div className="min-w-0">
                                <p className="text-sm font-medium text-gray-700">
                                    Check connection to your Supabase
                                </p>
                                {connMessage && (
                                    <p className={`text-xs mt-0.5 ${connStatus === 'connected' ? 'text-green-600' : 'text-red-500'}`}>
                                        {connMessage}
                                    </p>
                                )}
                            </div>
                        </div>

                        <button
                            type="button"
                            onClick={handleCheckConnection}
                            disabled={isCheckingConn || (!existing && !hasInput)}
                            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed shadow-sm shrink-0"
                        >
                            {isCheckingConn
                                ? <Loader2 className="w-4 h-4 animate-spin text-indigo-500" />
                                : connStatus === 'connected'
                                    ? <Wifi className="w-4 h-4 text-green-500" />
                                    : connStatus === 'failed'
                                        ? <WifiOff className="w-4 h-4 text-red-500" />
                                        : <Wifi className="w-4 h-4 text-gray-400" />
                            }
                            {isCheckingConn ? 'Testing...' : 'Test Connection'}
                        </button>
                    </div>
                </div>
            </div>

            {/* Important note */}
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                <div className="flex items-start gap-2.5">
                    <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                    <p className="text-sm text-amber-800 font-medium">
                        Do not show your API credentials to other people.
                    </p>
                </div>
            </div>
        </div>
    );
}
