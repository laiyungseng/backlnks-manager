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
        const { data: proj, error: fetchErr } = await supabase
            .from('projects')
            .select('project_details')
            .eq('id', projectId)
            .single();

        if (fetchErr || !proj) {
            return { success: false, message: 'Project not found.' };
        }

        const details = proj.project_details || [];
        if (details.length > 0) {
            details[0].is_approved = true;
        }

        const { error } = await supabase
            .from('projects')
            .update({ project_details: details })
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
        const updates = projectsArray.map(async p => {
            const edited = p.project_details?.[0] || {};
            const { data: proj } = await supabase.from('projects').select('project_details').eq('id', p.id).single();
            if (proj && proj.project_details && proj.project_details.length > 0) {
                const details = proj.project_details;
                details[0] = {
                    ...details[0],
                    project_name: edited.project_name,
                    vendor_name: edited.vendor_name,
                    country: edited.country,
                    backlinks_category: edited.backlinks_category,
                    start_date: edited.start_date,
                    deadline: edited.deadline,
                    price: String(edited.price || 0),
                    price_type: edited.price_type
                };
                return supabase.from('projects').update({ project_details: details }).eq('id', p.id);
            }
        });

        await Promise.all(updates);

        revalidatePath('/admin', 'layout');
        return { success: true, message: 'Changes saved successfully.' };
    } catch (error) {
        console.error('Server error updating projects:', error);
        return { success: false, message: 'An unexpected error occurred while saving edits.' };
    }
}
