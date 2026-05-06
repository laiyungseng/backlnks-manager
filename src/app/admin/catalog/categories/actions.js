'use server';

import { getServerSupabase } from '@/lib/supabase-server';
import { getSession } from '@/lib/session';

async function requireAdmin() {
    const session = await getSession();
    if (!session?.id) throw new Error('Unauthorized');
    return session;
}

export async function getCategories() {
    const supabase = getServerSupabase();
    const { data, error } = await supabase
        .from('project_categories')
        .select('id, name, description, created_at')
        .order('name', { ascending: true });
    if (error) return { success: false, message: error.message };
    return { success: true, categories: data || [] };
}

export async function addCategory(name, description) {
    try { await requireAdmin(); } catch { return { success: false, message: 'Unauthorized.' }; }
    if (!name || !name.trim()) return { success: false, message: 'Category name is required.' };
    const supabase = getServerSupabase();
    const { data, error } = await supabase
        .from('project_categories')
        .insert({ name: name.trim(), description: description?.trim() || null })
        .select('id, name')
        .single();
    if (error) {
        if (error.code === '23505') return { success: false, message: `"${name.trim()}" already exists.` };
        return { success: false, message: error.message };
    }
    return { success: true, category: data };
}

export async function deleteCategory(id) {
    try { await requireAdmin(); } catch { return { success: false, message: 'Unauthorized.' }; }
    const supabase = getServerSupabase();
    const { data: cat } = await supabase
        .from('project_categories')
        .select('name')
        .eq('id', id)
        .single();
    if (!cat) return { success: false, message: 'Category not found.' };

    const { count, error: countErr } = await supabase
        .from('project_targets')
        .select('id', { count: 'exact', head: true })
        .eq('category', cat.name);
    if (countErr) return { success: false, message: countErr.message };
    if (count > 0) return { success: false, message: `Cannot delete — used in ${count} project target(s).` };

    const { error } = await supabase.from('project_categories').delete().eq('id', id);
    if (error) return { success: false, message: error.message };
    return { success: true };
}
