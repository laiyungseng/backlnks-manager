'use server';

import { getServerSupabase } from '@/lib/supabase-server';
import { getSession } from '@/lib/session';

async function requireAdmin() {
    const session = await getSession();
    if (!session?.id) throw new Error('Unauthorized');
    return session;
}

const VENDOR_ACTIONS = [
    'vendor_project_view',
    'vendor_save',
    'vendor_data_deletion',
    'vendor_finalized_sync',
    'vendor_session_start',
    'url_entry_toggled',
];

export async function getVendorAuditLog({ page = 0, limit = 50, vendorId = null } = {}) {
    try { await requireAdmin(); } catch { return { success: false, message: 'Unauthorized.' }; }
    const supabase = getServerSupabase();

    let query = supabase
        .from('audit_log')
        .select('id, action, actor_id, target_id, detail, meta, created_at', { count: 'exact' })
        .in('action', VENDOR_ACTIONS)
        .order('created_at', { ascending: false })
        .range(page * limit, (page + 1) * limit - 1);

    if (vendorId) query = query.eq('actor_id', vendorId);

    const { data, error, count } = await query;
    if (error) return { success: false, message: error.message };

    const logs = data || [];

    // Resolve project names for target_ids in results
    const projectIds = [...new Set(logs.map(l => l.target_id).filter(Boolean))];
    let projectNames = {};
    if (projectIds.length > 0) {
        const { data: projects } = await supabase
            .from('projects')
            .select('id, project_name')
            .in('id', projectIds);
        (projects || []).forEach(p => { projectNames[p.id] = p.project_name; });
    }

    return { success: true, logs, total: count || 0, projectNames };
}

export async function getVendorListForLog() {
    try { await requireAdmin(); } catch { return { success: false, message: 'Unauthorized.' }; }
    const supabase = getServerSupabase();
    const { data, error } = await supabase
        .from('vendors')
        .select('id, vendor_name')
        .order('vendor_name');
    if (error) return { success: false, message: error.message };
    return { success: true, vendors: data || [] };
}
