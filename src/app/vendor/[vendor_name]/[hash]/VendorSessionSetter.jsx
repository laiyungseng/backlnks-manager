'use client';

import { useEffect } from 'react';
import { useParams } from 'next/navigation';
import { establishVendorSession } from './actions';

export default function VendorSessionSetter({ hash }) {
    const params = useParams();
    const vendorName = params?.vendor_name || '';

    // Auth side effect — fires only when hash actually changes (string compare = stable)
    useEffect(() => {
        establishVendorSession(hash).catch(() => {});
    }, [hash]);

    // Persist last viewed hash for the portal "Current Project" shortcut
    useEffect(() => {
        if (vendorName && hash) {
            localStorage.setItem(`lastProjectHash_${vendorName}`, hash);
        }
    }, [hash, vendorName]);

    return null;
}
