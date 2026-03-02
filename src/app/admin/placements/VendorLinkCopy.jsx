'use client';

import { Link as LinkIcon, Check, ExternalLink } from 'lucide-react';
import { useState, useEffect } from 'react';

export default function VendorLinkCopy({ projectHash }) {
    const [copied, setCopied] = useState(false);
    const [baseUrl, setBaseUrl] = useState('');

    useEffect(() => {
        // Run safely on client to grab host naturally
        setBaseUrl(window.location.origin);
    }, []);

    const fullUrl = `${baseUrl}/vendor/${projectHash}`;

    const handleCopy = () => {
        if (!baseUrl) return;
        navigator.clipboard.writeText(fullUrl);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    if (!projectHash) return null;

    return (
        <div className="flex items-center gap-2">
            <button
                onClick={handleCopy}
                title="Copy Vendor Link"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 transition-colors focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
                {copied ? <Check className="w-3.5 h-3.5" /> : <LinkIcon className="w-3.5 h-3.5" />}
                {copied ? 'Copied URL!' : 'Copy Vendor Link'}
            </button>
            <a
                href={fullUrl}
                target="_blank"
                rel="noopener noreferrer"
                title="Open Vendor Page as Admin"
                className="p-1.5 text-gray-400 hover:text-gray-900 bg-white border border-gray-200 rounded-md hover:bg-gray-50 transition-colors shadow-sm"
            >
                <ExternalLink className="w-3.5 h-3.5" />
            </a>
        </div>
    );
}
