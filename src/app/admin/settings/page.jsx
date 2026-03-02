'use client';

import { useState, useEffect } from 'react';
import { Database, Save, Eye, EyeOff, CheckCircle2, AlertCircle } from 'lucide-react';

export default function SettingsPage() {
    const [supabaseUrl, setSupabaseUrl] = useState('');
    const [supabaseAnonKey, setSupabaseAnonKey] = useState('');
    const [showKey, setShowKey] = useState(false);
    const [saveStatus, setSaveStatus] = useState(null); // 'success' | 'error' | null
    const [isLoading, setIsLoading] = useState(true);

    // Load existing values from the API on mount
    useEffect(() => {
        async function loadSettings() {
            try {
                const res = await fetch('/api/settings');
                if (res.ok) {
                    const data = await res.json();
                    setSupabaseUrl(data.supabaseUrl || '');
                    setSupabaseAnonKey(data.supabaseAnonKey || '');
                }
            } catch (e) {
                console.error('Failed to load settings:', e);
            } finally {
                setIsLoading(false);
            }
        }
        loadSettings();
    }, []);

    async function handleSave(e) {
        e.preventDefault();
        setSaveStatus(null);

        try {
            const res = await fetch('/api/settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ supabaseUrl, supabaseAnonKey }),
            });

            if (res.ok) {
                setSaveStatus('success');
                setTimeout(() => setSaveStatus(null), 4000);
            } else {
                const data = await res.json();
                console.error('Save error:', data);
                setSaveStatus('error');
            }
        } catch (e) {
            console.error('Save error:', e);
            setSaveStatus('error');
        }
    }

    return (
        <div className="max-w-3xl mx-auto space-y-8">
            <div>
                <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Settings</h1>
                <p className="mt-2 text-sm text-gray-500">
                    Configure your database connection. Changes require a server restart to take effect.
                </p>
            </div>

            {/* Database Credentials Card */}
            <div className="bg-white rounded-xl shadow-sm ring-1 ring-gray-200 overflow-hidden">
                <div className="px-6 py-5 border-b border-gray-100 bg-gradient-to-r from-gray-50 to-white">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-indigo-100 rounded-lg">
                            <Database className="w-5 h-5 text-indigo-600" />
                        </div>
                        <div>
                            <h2 className="text-lg font-semibold text-gray-900">Database Connection</h2>
                            <p className="text-xs text-gray-500 mt-0.5">Supabase project credentials from your project dashboard</p>
                        </div>
                    </div>
                </div>

                <form onSubmit={handleSave} className="p-6 space-y-6">
                    {/* Supabase URL */}
                    <div>
                        <label htmlFor="supabase-url" className="block text-sm font-medium text-gray-700 mb-1.5">
                            Supabase Project URL
                        </label>
                        <input
                            id="supabase-url"
                            type="url"
                            value={supabaseUrl}
                            onChange={(e) => setSupabaseUrl(e.target.value)}
                            placeholder="https://your-project-id.supabase.co"
                            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm font-mono text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-shadow"
                            disabled={isLoading}
                        />
                        <p className="mt-1.5 text-xs text-gray-400">
                            Found in your Supabase Dashboard → Project Settings → API → Project URL
                        </p>
                    </div>

                    {/* Supabase Anon Key */}
                    <div>
                        <label htmlFor="supabase-key" className="block text-sm font-medium text-gray-700 mb-1.5">
                            Supabase Anon / Public Key
                        </label>
                        <div className="relative">
                            <input
                                id="supabase-key"
                                type={showKey ? 'text' : 'password'}
                                value={supabaseAnonKey}
                                onChange={(e) => setSupabaseAnonKey(e.target.value)}
                                placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                                className="w-full px-4 py-2.5 pr-12 border border-gray-300 rounded-lg text-sm font-mono text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-shadow"
                                disabled={isLoading}
                            />
                            <button
                                type="button"
                                onClick={() => setShowKey(!showKey)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                                title={showKey ? 'Hide key' : 'Show key'}
                            >
                                {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                        </div>
                        <p className="mt-1.5 text-xs text-gray-400">
                            Found in your Supabase Dashboard → Project Settings → API → Project API keys → <code className="bg-gray-100 px-1 py-0.5 rounded text-[10px]">anon</code> <code className="bg-gray-100 px-1 py-0.5 rounded text-[10px]">public</code>
                        </p>
                    </div>

                    {/* Status Messages */}
                    {saveStatus === 'success' && (
                        <div className="flex items-center gap-2 px-4 py-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-800">
                            <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0" />
                            <span>Credentials saved to <code className="bg-green-100 px-1 py-0.5 rounded text-xs font-mono">.env</code> successfully. Please <strong>restart the server</strong> for changes to take effect.</span>
                        </div>
                    )}

                    {saveStatus === 'error' && (
                        <div className="flex items-center gap-2 px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-800">
                            <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
                            <span>Failed to save credentials. Please check the console for errors.</span>
                        </div>
                    )}

                    {/* Submit */}
                    <div className="flex justify-end pt-2">
                        <button
                            type="submit"
                            disabled={isLoading}
                            className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                        >
                            <Save className="w-4 h-4" />
                            Save Credentials
                        </button>
                    </div>
                </form>
            </div>

            {/* Info Banner */}
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-5">
                <h3 className="text-sm font-semibold text-amber-900 mb-1">Important Notes</h3>
                <ul className="text-xs text-amber-700 space-y-1 list-disc list-inside">
                    <li>These credentials are stored locally in the <code className="bg-amber-100 px-1 py-0.5 rounded">.env</code> file and are never transmitted externally.</li>
                    <li>After saving, you must <strong>restart the development server</strong> (<code className="bg-amber-100 px-1 py-0.5 rounded">npm run dev</code>) for changes to take effect.</li>
                    <li>The <code className="bg-amber-100 px-1 py-0.5 rounded">.env</code> file is excluded from Git via <code className="bg-amber-100 px-1 py-0.5 rounded">.gitignore</code>. Your credentials will never be committed.</li>
                </ul>
            </div>
        </div>
    );
}
