'use client';

import { useEffect } from 'react';
import { useVendorWorkbench } from '../../_lib/VendorWorkbenchContext';

export default function VendorWorkbenchActivator({ project }) {
    const { setActiveProject } = useVendorWorkbench();

    useEffect(() => {
        setActiveProject(project);
    }, [
        setActiveProject,
        project,
        project?.projectHash,
        project?.initialVersion,
        project?.isLocked,
        project?.urlEntryEnabled,
    ]);

    return null;
}
