'use server';

import { getServerSupabase } from '@/lib/supabase-server';
import { getSession } from '@/lib/session';
import { revalidatePath } from 'next/cache';

async function requireAdmin() {
    const session = await getSession();
    if (!session?.id) throw new Error('Unauthorized');
    return session;
}

export async function deleteProject(projectId) {
    try { await requireAdmin(); } catch { return { success: false, message: 'Unauthorized.' }; }
    if (!projectId) return { success: false, message: 'Project ID is missing.' };

    const supabase = getServerSupabase();
    try {
        // 0.5 Delete from project_languages and project_targets
        const { error: langError } = await supabase.from('project_languages').delete().eq('project_id', projectId);
        if (langError) console.error('Failed to delete languages:', langError);

        const { error: targetsError } = await supabase.from('project_targets').delete().eq('project_id', projectId);
        if (targetsError) console.error('Failed to delete targets:', targetsError);

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
    try { await requireAdmin(); } catch { return { success: false, message: 'Unauthorized.' }; }
    if (!projectId) return { success: false, message: 'Project ID is missing.' };

    const supabase = getServerSupabase();
    try {
        const { error } = await supabase
            .from('projects')
            .update({ is_approved: true, payment_status: 'approved' })
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

async function resolveVendor(supabase, vendorName) {
    const { data: existing } = await supabase
        .from('vendors').select('id').eq('vendor_name', vendorName).maybeSingle();
    if (existing) return existing.id;
    const { data: newV, error } = await supabase
        .from('vendors').insert({ vendor_name: vendorName }).select('id').single();
    if (error) throw new Error(`Failed to create vendor: ${error.message}`);
    return newV.id;
}

export async function updateDashboardProjects(projectsArray) {
    try { await requireAdmin(); } catch { return { success: false, message: 'Unauthorized.' }; }
    if (!Array.isArray(projectsArray) || projectsArray.length === 0) return { success: true };

    const supabase = getServerSupabase();
    try {
        for (const p of projectsArray) {
            // Resolve vendor_id if vendor name was edited
            const updatePayload = {
                project_name: p.project_name,
                country: p.country,
                start_date: p.start_date,
                deadline: p.deadline,
                price: parseFloat(p.price || 0),
                price_type: p.price_type
            };

            const editedVendorName = p.vendorNameEdit?.trim();
            const originalVendorName = p.vendors?.vendor_name || '';
            if (editedVendorName && editedVendorName !== originalVendorName) {
                updatePayload.vendor_id = await resolveVendor(supabase, editedVendorName);
            }

            const { error: projError } = await supabase.from('projects')
                .update(updatePayload)
                .eq('id', p.id);
            if (projError) throw projError;

            // Update category mappings if provided
            if (p.categoryUpdates && Object.keys(p.categoryUpdates).length > 0) {
                for (const [oldCategory, newCategory] of Object.entries(p.categoryUpdates)) {
                    if (oldCategory !== newCategory && newCategory && newCategory.trim() !== '') {
                        const { error: catError } = await supabase
                            .from('project_targets')
                            .update({ category: newCategory.trim() })
                            .eq('project_id', p.id)
                            .eq('category', oldCategory);
                        if (catError) throw catError;
                    }
                }
            }
        }

        revalidatePath('/admin', 'layout');
        return { success: true, message: 'Changes saved successfully.' };
    } catch (error) {
        console.error('Server error updating projects:', error);
        return { success: false, message: 'An unexpected error occurred while saving edits.' };
    }
}

export async function approvePaymentAction(projectId) {
    try { await requireAdmin(); } catch { return { success: false, message: 'Unauthorized.' }; }
    if (!projectId) return { success: false, message: 'Project ID missing.' };
    const supabase = getServerSupabase();
    const { error } = await supabase
        .from('projects')
        .update({ payment_status: 'approved' })
        .eq('id', projectId);
    if (error) return { success: false, message: error.message };
    revalidatePath('/admin', 'layout');
    return { success: true };
}

export async function markPaymentPendingAction(projectId) {
    try { await requireAdmin(); } catch { return { success: false, message: 'Unauthorized.' }; }
    if (!projectId) return { success: false, message: 'Project ID missing.' };
    const supabase = getServerSupabase();
    const { error } = await supabase
        .from('projects')
        .update({ payment_status: 'pending' })
        .eq('id', projectId);
    if (error) return { success: false, message: error.message };
    revalidatePath('/admin', 'layout');
    return { success: true };
}
