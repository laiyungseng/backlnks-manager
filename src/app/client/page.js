'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, User, Link as LinkIcon, AlertCircle, ArrowRight, CheckCircle2, RefreshCw, ChevronLeft } from 'lucide-react';
import { checkClientByName, verifyClientToken, requestNewClientToken } from './actions';

const ERROR_MESSAGES = {
    invalid_token: 'Invalid access link.',
    name_mismatch: 'Name does not match the access link.',
    token_used: 'This link has already been used.',
    token_expired: 'This access link has expired.',
    server_error: 'Server error — please try again.',
};

export default function ClientLoginPage() {
    const router = useRouter();
    const [phase, setPhase] = useState('name'); // 'name' | 'token' | 'expired' | 'requested' | 'no_token'
    const [clientName, setClientName] = useState('');
    const [authLink, setAuthLink] = useState('');
    const [error, setError] = useState(null);
    const [isLoading, setIsLoading] = useState(false);

    // Phase 1: submit name
    const handleNameSubmit = async (e) => {
        e.preventDefault();
        const name = clientName.trim();
        if (!name) { setError('Please enter your name.'); return; }
        setError(null);
        setIsLoading(true);
        const result = await checkClientByName(name);
        setIsLoading(false);

        if (result.status === 'ok') {
            router.push(result.redirectPath);
            return;
        }
        if (result.status === 'needs_token') { setPhase('token'); return; }
        if (result.status === 'expired')     { setPhase('expired'); return; }
        if (result.status === 'no_token')    { setPhase('no_token'); return; }
        setError('Name not found. Please check and try again.');
    };

    // Phase 2: submit token
    const handleTokenSubmit = async (e) => {
        e.preventDefault();
        const link = authLink.trim();
        if (!link) { setError('Please paste your access link.'); return; }

        let token = link;
        try {
            const url = new URL(link.startsWith('http') ? link : `https://placeholder.com/${link}`);
            const extracted = url.searchParams.get('token');
            if (extracted) token = extracted;
        } catch { /* treat as raw token */ }

        if (!token || token.length !== 64) {
            setError('Invalid access link. Please paste the full link sent to you.');
            return;
        }

        setError(null);
        setIsLoading(true);
        const result = await verifyClientToken(clientName.trim(), token);
        setIsLoading(false);

        if (result.status === 'ok') { router.push(result.redirectPath); return; }
        if (result.status === 'expired') { setPhase('expired'); return; }
        setError(
            result.status === 'already_used' ? 'This link has already been used. Try entering your name to sign in.' :
            result.status === 'invalid'      ? 'Invalid access link. Please paste the full link sent to you.' :
            'Verification failed. Please try again.'
        );
    };

    // Expired: request new token
    const handleRequestNew = async () => {
        setIsLoading(true);
        await requestNewClientToken(clientName.trim());
        setIsLoading(false);
        setPhase('requested');
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
            <div className="max-w-md w-full bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
                <Link href="/" className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-400 hover:text-slate-600 transition-colors mb-6">
                    <ArrowLeft className="w-3.5 h-3.5" />
                    Back
                </Link>

                <div className="flex justify-center mb-6">
                    <div className="p-4 bg-emerald-50 rounded-full text-emerald-600">
                        <User className="w-8 h-8" />
                    </div>
                </div>

                <h1 className="text-2xl font-black text-center text-slate-800 tracking-tight mb-2 uppercase">
                    Client Portal
                </h1>

                {/* Phase: name */}
                {phase === 'name' && (
                    <>
                        <p className="text-sm font-medium text-center text-slate-500 mb-8">
                            Enter your assigned name to sign in.
                        </p>
                        <form onSubmit={handleNameSubmit} className="space-y-5">
                            <div>
                                <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-2">Your Name</label>
                                <div className="relative">
                                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                    <input
                                        type="text"
                                        value={clientName}
                                        onChange={e => setClientName(e.target.value)}
                                        placeholder="Enter your assigned name"
                                        className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 bg-slate-50 text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-colors"
                                        disabled={isLoading}
                                        autoFocus
                                    />
                                </div>
                            </div>
                            {error && (
                                <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-100 rounded-xl text-red-600 text-sm font-bold">
                                    <AlertCircle className="w-4 h-4 shrink-0" />
                                    {error}
                                </div>
                            )}
                            <button
                                type="submit"
                                disabled={isLoading}
                                className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-black uppercase tracking-widest transition-colors disabled:opacity-50"
                            >
                                {isLoading ? 'Checking...' : 'Continue'}
                                {!isLoading && <ArrowRight className="w-4 h-4" />}
                            </button>
                        </form>
                    </>
                )}

                {/* Phase: token (first-time login) */}
                {phase === 'token' && (
                    <>
                        <p className="text-sm font-medium text-center text-slate-500 mb-8">
                            Welcome,&nbsp;<span className="font-black text-slate-700">{clientName}</span>. Paste the access link sent by your account manager to continue.
                        </p>
                        <form onSubmit={handleTokenSubmit} className="space-y-5">
                            <div>
                                <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-2">Access Link</label>
                                <div className="relative">
                                    <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                    <input
                                        type="text"
                                        value={authLink}
                                        onChange={e => setAuthLink(e.target.value)}
                                        placeholder="Paste the access link here"
                                        className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 bg-slate-50 text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-colors"
                                        disabled={isLoading}
                                        autoFocus
                                    />
                                </div>
                            </div>
                            {error && (
                                <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-100 rounded-xl text-red-600 text-sm font-bold">
                                    <AlertCircle className="w-4 h-4 shrink-0" />
                                    {error}
                                </div>
                            )}
                            <button
                                type="submit"
                                disabled={isLoading}
                                className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-black uppercase tracking-widest transition-colors disabled:opacity-50"
                            >
                                {isLoading ? 'Verifying...' : 'Enter Portal'}
                                {!isLoading && <ArrowRight className="w-4 h-4" />}
                            </button>
                            <button
                                type="button"
                                onClick={() => { setPhase('name'); setError(null); setAuthLink(''); }}
                                className="w-full flex items-center justify-center gap-1.5 text-xs font-bold text-slate-400 hover:text-slate-600 transition-colors"
                            >
                                <ChevronLeft className="w-3.5 h-3.5" />
                                Use a different name
                            </button>
                        </form>
                    </>
                )}

                {/* Phase: expired */}
                {phase === 'expired' && (
                    <div className="text-center space-y-6 mt-2">
                        <p className="text-sm font-medium text-slate-500">
                            The access link for&nbsp;<span className="font-black text-slate-700">{clientName}</span>&nbsp;has expired. Request a new one from your account manager.
                        </p>
                        <div className="p-4 bg-amber-50 border border-amber-100 rounded-xl">
                            <p className="text-xs font-bold text-amber-700">Your current link is no longer valid. Clicking below will notify your account manager to issue a new one.</p>
                        </div>
                        <button
                            onClick={handleRequestNew}
                            disabled={isLoading}
                            className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-sm font-black uppercase tracking-widest transition-colors disabled:opacity-50"
                        >
                            {isLoading ? 'Sending...' : 'Request New Access Link'}
                            {!isLoading && <RefreshCw className="w-4 h-4" />}
                        </button>
                        <button
                            type="button"
                            onClick={() => { setPhase('name'); setError(null); }}
                            className="w-full flex items-center justify-center gap-1.5 text-xs font-bold text-slate-400 hover:text-slate-600 transition-colors"
                        >
                            <ChevronLeft className="w-3.5 h-3.5" />
                            Back
                        </button>
                    </div>
                )}

                {/* Phase: request submitted */}
                {phase === 'requested' && (
                    <div className="text-center space-y-6 mt-2">
                        <div className="flex justify-center">
                            <div className="p-3 bg-emerald-50 rounded-full">
                                <CheckCircle2 className="w-10 h-10 text-emerald-500" />
                            </div>
                        </div>
                        <div>
                            <p className="text-base font-black text-slate-800 mb-2">Request Sent</p>
                            <p className="text-sm font-medium text-slate-500">
                                Your account manager has been notified and will send a new access link shortly.
                            </p>
                        </div>
                        <button
                            type="button"
                            onClick={() => { setPhase('name'); setError(null); }}
                            className="w-full flex items-center justify-center gap-1.5 text-xs font-bold text-slate-400 hover:text-slate-600 transition-colors"
                        >
                            <ChevronLeft className="w-3.5 h-3.5" />
                            Back to sign in
                        </button>
                    </div>
                )}

                {/* Phase: no token issued */}
                {phase === 'no_token' && (
                    <div className="text-center space-y-6 mt-2">
                        <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl">
                            <p className="text-sm font-bold text-slate-600">
                                No access link has been issued for&nbsp;<span className="text-slate-800">{clientName}</span>&nbsp;yet. Please contact your account manager.
                            </p>
                        </div>
                        <button
                            type="button"
                            onClick={() => { setPhase('name'); setError(null); }}
                            className="w-full flex items-center justify-center gap-1.5 text-xs font-bold text-slate-400 hover:text-slate-600 transition-colors"
                        >
                            <ChevronLeft className="w-3.5 h-3.5" />
                            Back
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
