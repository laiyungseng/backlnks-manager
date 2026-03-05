'use server';

import { supabase } from '@/lib/supabase';
import { revalidatePath } from 'next/cache';

export async function deleteProject(projectId) {
    if (!projectId) return { success: false, message: 'Project ID is missing.' };
    if (!supabase) return { success: false, message: 'Database connection not configured.' };

    try {
        // 1. Delete associated placements first to respect foreign key constraints (if any)
        const { error: placementsError } = await supabase
            .from('placements')
            .delete()
            .eq('project_id', projectId);

        if (placementsError) {
            console.error('Failed to delete placements:', placementsError);
            return { success: false, message: 'Failed to delete vendor tasks.' };
        }

        // 1.5 Delete from projects_hub (Explicitly, in case ON DELETE CASCADE is missing)
        const { error: hubError } = await supabase
            .from('projects_hub')
            .delete()
            .eq('project_id', projectId);

        if (hubError) {
            console.error('Failed to delete projects_hub record:', hubError);
            return { success: false, message: 'Failed to delete hub records.' };
        }

        // 2. Delete the project itself
        const { error: projectError } = await supabase
            .from('projects')
            .delete()
            .eq('id', projectId);

        if (projectError) {
            console.error('Failed to delete project:', projectError);
            return { success: false, message: 'Failed to delete project record.' };
        }

        // 3. Revalidate the admin dashboard page so it refreshes immediately
        revalidatePath('/admin', 'layout');

        return { success: true, message: 'Project deleted successfully.' };

    } catch (error) {
        console.error('Server error deleting project:', error);
        return { success: false, message: 'An unexpected error occurred.' };
    }
}

export async function approveProject(projectId) {
    if (!projectId) return { success: false, message: 'Project ID is missing.' };
    if (!supabase) return { success: false, message: 'Database connection not configured.' };

    try {
        const { error } = await supabase
            .from('projects')
            .update({ is_approved: true })
            .eq('id', projectId);

        if (error) {
            console.error('Failed to approve project:', error);
            return { success: false, message: 'Failed to approve. Check DB schema migration.' };
        }

        revalidatePath('/admin', 'layout');
        return { success: true, message: 'Project approved successfully.' };
    } catch (error) {
        console.error('Server error approving project:', error);
        return { success: false, message: 'An unexpected error occurred.' };
    }
}

export async function updateDashboardProjects(projectsArray) {
    if (!Array.isArray(projectsArray) || projectsArray.length === 0) return { success: true };
    if (!supabase) return { success: false, message: 'Database connection not configured.' };

    try {
        // Bulk update or individual updates
        // Since Supabase doesn't easily do bulk updates with mixed structures without a loop or upsert array
        const updates = projectsArray.map(p => {
            return supabase.from('projects').update({
                project_name: p.project_name,
                vendor_name: p.vendor_name,
                country: p.country,
                backlinks_category: p.backlinks_category,
                start_date: p.start_date,
                deadline: p.deadline,
                price: p.price,
                price_type: p.price_type
            }).eq('id', p.id);
        });

        await Promise.all(updates);

        revalidatePath('/admin', 'layout');
        return { success: true, message: 'Changes saved successfully.' };
    } catch (error) {
        console.error('Server error updating projects:', error);
        return { success: false, message: 'An unexpected error occurred while saving edits.' };
    }
}
