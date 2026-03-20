'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function GuestEntryPage() {
    const router = useRouter();
    const [vendorLink, setVendorLink] = useState('');
    const [error, setError] = useState('');

    const handleRedirect = (e) => {
        e.preventDefault();
        setError('');

        if (!vendorLink.trim()) {
            setError('Please paste your vendor portal link.');
            return;
        }

        try {
            // Try parsing as full URL first
            let pathname = '';
            try {
                const url = new URL(vendorLink.trim());
                pathname = url.pathname;
            } catch {
                // User might have pasted just the path
                pathname = vendorLink.trim().startsWith('/') ? vendorLink.trim() : `/${vendorLink.trim()}`;
            }

            // Validate it looks like a vendor path
            if (pathname.includes('/vendor/')) {
                router.push(pathname);
            } else {
                setError('Invalid vendor link. The link should contain "/vendor/" in the path.');
            }
        } catch {
            setError('Could not parse the provided link. Please check the format.');
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900 relative overflow-hidden px-4">
            {/* Ambient glow */}
            <div className="absolute inset-0 pointer-events-none">
                <div className="absolute top-1/4 right-1/3 w-72 h-72 bg-purple-500/10 rounded-full blur-[100px]" />
                <div className="absolute bottom-1/4 left-1/3 w-64 h-64 bg-indigo-500/8 rounded-full blur-[100px]" />
            </div>

            <div className="relative z-10 w-full max-w-md">
                {/* Logo */}
                <div className="flex flex-col items-center mb-8">
                    <button
                        onClick={() => router.push('/')}
                        className="w-16 h-16 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-xl shadow-indigo-500/25 mb-4 hover:scale-105 transition-transform"
                    >
                        <span className="text-2xl font-black text-white">DF</span>
                    </button>
                    <h1 className="text-2xl font-bold text-white">Vendor / Guest Access</h1>
                    <p className="text-sm text-slate-400 mt-1">Paste your vendor portal link to continue</p>
                </div>

                {/* Form Card */}
                <form onSubmit={handleRedirect} className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-8 shadow-2xl space-y-5">
                    {error && (
                        <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-sm text-red-300 font-medium">
                            {error}
                        </div>
                    )}

                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-2">Vendor Portal Link</label>
                        <input
                            type="text"
                            value={vendorLink}
                            onChange={(e) => setVendorLink(e.target.value)}
                            placeholder="https://yourdomain.com/vendor/vendorname/abc123..."
                            className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-slate-500 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all text-sm"
                            autoFocus
                        />
                        <p className="mt-2 text-xs text-slate-500">
                            This link was shared with you by the project administrator.
                        </p>
                    </div>

                    <button
                        type="submit"
                        className="w-full py-3.5 bg-gradient-to-r from-indigo-600 to-indigo-500 text-white font-bold rounded-xl shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40 hover:from-indigo-500 hover:to-indigo-400 transition-all"
                    >
                        Go to Portal
                    </button>

                    <div className="text-center">
                        <button
                            type="button"
                            onClick={() => router.push('/')}
                            className="text-sm text-slate-400 hover:text-indigo-400 transition-colors"
                        >
                            &larr; Back to Home
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
