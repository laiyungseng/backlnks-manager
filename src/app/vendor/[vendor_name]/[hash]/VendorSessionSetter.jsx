'use client';

import { useEffect } from 'react';
import { useParams } from 'next/navigation';
import { establishVendorSession } from './actions';

export default function VendorSessionSetter({ hash }) {
    const params = useParams();
    const vendorName = params?.vendor_name || '';

    useEffect(() => {
        establishVendorSession(hash).catch(() => {});
        if (vendorName && hash) {
            localStorage.setItem(`lastProjectHash_${vendorName}`, hash);
        }
    }, [hash, vendorName]);

    return null;
}
