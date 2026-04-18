'use client';

import { useState } from 'react';
import { vendorLogin } from './actions';
import { ArrowRight, Building2, AlertCircle } from 'lucide-react';

export default function VendorLoginPage() {
    const [vendorName, setVendorName] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError(null);
        
        if (!vendorName.trim()) {
            setError('Please enter your company name.');
            return;
        }

        setIsLoading(true);
        const result = await vendorLogin(vendorName.trim());
        
        if (!result.success) {
            setError(result.message);
            setIsLoading(false);
        }
        // If successful, the server action handles the redirect.
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
            <div className="max-w-md w-full bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
                <div className="flex justify-center mb-6">
                    <div className="p-4 bg-indigo-50 rounded-full text-indigo-600">
                        <Building2 className="w-8 h-8" />
                    </div>
                </div>
                
                <h1 className="text-2xl font-black text-center text-slate-800 tracking-tight mb-2 uppercase">
                    Vendor Portal
                </h1>
                <p className="text-sm font-medium text-center text-slate-500 mb-8">
                    Enter your registered company name to access your active placement assignments.
                </p>

                <form onSubmit={handleSubmit} className="space-y-6">
                    <div>
                        <label htmlFor="vendorName" className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-2">
                            Company / Vendor Name
                        </label>
                        <input
                            id="vendorName"
                            type="text"
                            value={vendorName}
                            onChange={(e) => setVendorName(e.target.value)}
                            placeholder="e.g. UnitedSEO"
                            className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-colors"
                            disabled={isLoading}
                        />
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
                        className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-black uppercase tracking-widest transition-colors disabled:opacity-50"
                    >
                        {isLoading ? 'Verifying...' : 'Access Portal'}
                        {!isLoading && <ArrowRight className="w-4 h-4" />}
                    </button>
                </form>
            </div>
        </div>
    );
}
