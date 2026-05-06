'use server';

import { randomBytes } from 'crypto';
import { getServerSupabase } from '@/lib/supabase-server';

export async function upsertClient(data) {
    const supabase = getServerSupabase();
    if (!supabase) return { success: false, message: 'DB not available.' };

    const { id, client_name } = data;
    if (!client_name?.trim()) return { success: false, message: 'Client name is required.' };

    if (id) {
        const { error } = await supabase
            .from('clients')
            .update({ client_name: client_name.trim() })
            .eq('id', id);
        if (error) return { success: false, message: error.message };
        return { success: true };
    }

    const { error } = await supabase
        .from('clients')
        .insert({ client_name: client_name.trim() });
    if (error) return { success: false, message: error.message };
    return { success: true };
}

export async function deleteClient(id) {
    const supabase = getServerSupabase();
    if (!supabase) return { success: false, message: 'DB not available.' };

    const { error } = await supabase.from('clients').delete().eq('id', id);
    if (error) return { success: false, message: error.message };
    return { success: true };
}

export async function generateClientAccessLink(clientId) {
    const supabase = getServerSupabase();
    if (!supabase) return { success: false, message: 'DB not available.' };

    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(); // 30 days

    const { error } = await supabase
        .from('clients')
        .update({ invite_token: token, invite_token_expires_at: expiresAt, invite_used_at: null })
        .eq('id', clientId);

    if (error) return { success: false, message: error.message };
    return { success: true, token };
}

export async function revokeClientSessions(clientId) {
    const supabase = getServerSupabase();
    if (!supabase) return { success: false, message: 'DB not available.' };

    const { data: client } = await supabase.from('clients').select('session_version').eq('id', clientId).maybeSingle();
    if (!client) return { success: false, message: 'Client not found.' };

    const { error } = await supabase
        .from('clients')
        .update({ session_version: (client.session_version ?? 1) + 1 })
        .eq('id', clientId);
    if (error) return { success: false, message: error.message };
    return { success: true };
}
