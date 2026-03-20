'use server';

import { normalizeProjectData } from '@/lib/placementProcessor';
import { supabase } from '@/lib/supabase';
import { revalidatePath } from 'next/cache';

export async function finalizeProjectAction(projectHash) {
    if (!projectHash) {
        return { success: false, message: 'Invalid project reference.' };
    }

    // Invoke the Normalization Engine
    const result = await normalizeProjectData(projectHash);

    // Clear entire admin cache tree to instantly update UI
    revalidatePath('/admin', 'layout');

    return result;
}

export async function toggleProjectLockAction(projectHash, newLockState) {
    if (!projectHash) {
        return { success: false, message: 'Invalid project reference.' };
    }
    if (!supabase) {
        return { success: false, message: 'Database connection not configured.' };
    }

    const { error } = await supabase
        .from('projects_hub')
        .update({ is_locked: newLockState })
        .eq('hash', projectHash);

    if (error) {
        return { success: false, message: `Failed to update lock state: ${error.message}` };
    }

    // Clear entire admin cache tree to instantly update UI
    revalidatePath('/admin', 'layout');

    return {
        success: true,
        message: newLockState ? 'Project locked successfully.' : 'Project unlocked for editing.'
    };
}
