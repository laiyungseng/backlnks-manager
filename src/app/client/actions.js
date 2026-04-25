'use server';

import { randomBytes } from 'crypto';
import { getServerSupabase } from '@/lib/supabase-server';
import { getClientSession, clearClientSessionCookie, setClientSessionCookie, verifyClientSession, getSession } from '@/lib/session';
import { redirect } from 'next/navigation';

function buildClientSlug(name) {
    return name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
}

async function lookupClientByName(supabase, name) {
    const { data } = await supabase
        .from('clients')
        .select('id, client_name, invite_token, invite_token_expires_at, invite_used_at, session_version')
        .ilike('client_name', name.trim())
        .maybeSingle();
    return data;
}

export async function checkClientByName(name) {
    if (!name?.trim()) return { status: 'invalid' };
    const supabase = getServerSupabase();
    const client = await lookupClientByName(supabase, name);
    if (!client) return { status: 'not_found' };

    // Returning user — token was already used, name alone is sufficient
    if (client.invite_used_at) {
        await setClientSessionCookie(client.id, client.session_version ?? 1);
        const slug = buildClientSlug(client.client_name);
        return { status: 'ok', redirectPath: `/client/${slug}/portal/${client.id}/dashboard` };
    }

    // No token issued yet
    if (!client.invite_token || !client.invite_token_expires_at) {
        return { status: 'no_token' };
    }

    // Token expired before first use
    if (new Date() > new Date(client.invite_token_expires_at)) {
        return { status: 'expired' };
    }

    // Valid unused token — first-time login requires token
    return { status: 'needs_token' };
}

export async function verifyClientToken(name, token) {
    if (!name?.trim() || !token?.trim() || token.length !== 64) return { status: 'invalid' };
    const supabase = getServerSupabase();
    const client = await lookupClientByName(supabase, name);
    if (!client) return { status: 'not_found' };
    if (client.invite_token !== token) return { status: 'invalid' };
    if (client.invite_used_at) return { status: 'already_used' };
    if (!client.invite_token_expires_at || new Date() > new Date(client.invite_token_expires_at)) {
        return { status: 'expired' };
    }

    await supabase.from('clients')
        .update({ invite_used_at: new Date().toISOString() })
        .eq('id', client.id);

    await setClientSessionCookie(client.id, client.session_version ?? 1);
    const slug = buildClientSlug(client.client_name);
    return { status: 'ok', redirectPath: `/client/${slug}/portal/${client.id}/dashboard` };
}

export async function requestNewClientToken(name) {
    if (!name?.trim()) return { success: false };
    const supabase = getServerSupabase();
    const client = await lookupClientByName(supabase, name);
    if (!client) return { success: false };

    // Clear expired token — signals to admin that a new token is needed
    const { error } = await supabase.from('clients')
        .update({ invite_token: null, invite_token_expires_at: null, invite_used_at: null })
        .eq('id', client.id);

    return { success: !error };
}

export async function generateClientToken(clientId) {
    const supabase = getServerSupabase();
    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(); // 30 days

    const { error } = await supabase
        .from('clients')
        .update({ invite_token: token, invite_token_expires_at: expiresAt, invite_used_at: null })
        .eq('id', clientId);

    if (error) return { success: false, message: 'Failed to generate token.' };
    return { success: true, token };
}

export async function getProjectSheet(projectId, isCompleted) {
    if (!projectId) return { error: 'Missing project ID' };
    const supabase = getServerSupabase();

    // Auth: admin bypass OR verified client session
    const adminSession = await getSession();
    if (!adminSession) {
        const clientSession = await verifyClientSession(supabase);
        if (!clientSession?.clientId) return { error: 'Unauthorized' };

        // Verify project belongs to this client
        const [{ data: proj }, { data: clientRow }] = await Promise.all([
            supabase.from('projects').select('client_name').eq('id', projectId).maybeSingle(),
            supabase.from('clients').select('client_name').eq('id', clientSession.clientId).maybeSingle(),
        ]);
        if (!proj || !clientRow || proj.client_name !== clientRow.client_name) {
            return { error: 'Unauthorized' };
        }
    }

    if (isCompleted) {
        const { data } = await supabase
            .from('placements')
            .select('id, anchor_text, target_url, published_url, indexed_status')
            .eq('project_id', projectId)
            .order('id');
        return { rows: data || [] };
    } else {
        const { data } = await supabase
            .from('projects_hub')
            .select('vendor_staging_data')
            .eq('project_id', projectId)
            .maybeSingle();
        const stagingData = Array.isArray(data?.vendor_staging_data) ? data.vendor_staging_data : [];
        return {
            rows: stagingData.map(r => ({
                id: r.id,
                anchor_text: r.anchor_text || '',
                target_url: r.target_url || '',
                published_url: r.published_url || '',
                indexed_status: r.indexed_status || '',
            })),
        };
    }
}

export async function clientLogoutAction() {
    const session = await getClientSession();
    if (session?.clientId) {
        try {
            const supabase = getServerSupabase();
            await supabase
                .from('clients')
                .update({ session_version: (session.sessionVersion ?? 1) + 1 })
                .eq('id', session.clientId);
        } catch { /* non-fatal */ }
    }
    await clearClientSessionCookie();
    redirect('/client');
}
