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
        <div className="flex items-center gap-2">
            <a
                href={fullUrl}
                target="_blank"
                rel="noopener noreferrer"
                title="Open Vendor Link"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 transition-colors focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
                <ExternalLink className="w-3.5 h-3.5" />
                Vendor Link
            </a>
            <button
                onClick={handleCopy}
                title="Copy Vendor URL"
                className="p-1.5 text-gray-400 hover:text-gray-900 bg-white border border-gray-200 rounded-md hover:bg-gray-50 transition-colors shadow-sm"
            >
                {copied ? <Check className="w-3.5 h-3.5 text-green-500" /> : <LinkIcon className="w-3.5 h-3.5" />}
            </button>
        </div>
    );
}
