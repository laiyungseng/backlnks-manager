'use server';

import { normalizeProjectData } from '@/lib/placementProcessor';

export async function finalizeProjectAction(projectHash) {
    if (!projectHash) {
        return { success: false, message: 'Invalid project reference.' };
    }

    // Invoke the Normalization Engine
    const result = await normalizeProjectData(projectHash);

    return result;
}
