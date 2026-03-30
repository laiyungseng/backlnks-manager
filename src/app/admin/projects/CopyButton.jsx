'use client';

import { Copy, Check } from 'lucide-react';
import { useState } from 'react';

export default function CopyButton({ textToCopy }) {
    const [copied, setCopied] = useState(false);

    const handleCopy = () => {
        navigator.clipboard.writeText(textToCopy);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000); // Reset icon after 2 seconds
    };

    return (
        <button
            onClick={handleCopy}
            title="Copy full Project ID"
            className="ml-2 p-1 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-md transition-all opacity-0 group-hover:opacity-100 focus:opacity-100"
        >
            {copied ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
        </button>
    );
}
