'use client';

import { Link as LinkIcon, Check, ExternalLink } from 'lucide-react';
import { useState, useEffect } from 'react';

export default function VendorLinkCopy({ projectHash, vendorName }) {
    const [copied, setCopied] = useState(false);
    const [baseUrl, setBaseUrl] = useState('');

    useEffect(() => {
        setBaseUrl(window.location.origin);
    }, []);

    const safeVendorName = encodeURIComponent(vendorName || 'unknown');
    const fullUrl = `${baseUrl}/vendor/${safeVendorName}/${projectHash}`;

    const handleCopy = () => {
        if (!baseUrl) return;
        navigator.clipboard.writeText(fullUrl);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    if (!projectHash) return null;

    return (
        <div className="flex items-center gap-3">
            <div className="flex flex-col">
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Portal Access</span>
                <div className="flex items-center gap-1.5">
                    <a
                        href={fullUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 px-4 py-2 text-[11px] font-black text-indigo-700 bg-indigo-50 border border-indigo-100 rounded-lg hover:bg-indigo-100 transition-all uppercase tracking-tighter"
                    >
                        <ExternalLink className="w-3.5 h-3.5" />
                        Open Link
                    </a>
                    <button
                        onClick={handleCopy}
                        className="p-2 text-slate-400 hover:text-indigo-600 bg-white border border-slate-200 rounded-lg hover:border-indigo-200 transition-all shadow-sm"
                    >
                        {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <LinkIcon className="w-4 h-4" />}
                    </button>
                </div>
            </div>
        </div>
    );
}
