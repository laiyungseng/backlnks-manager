'use server';

import { getSession } from '@/lib/session';
import { getServerSupabase } from '@/lib/supabase-server';
import { decryptCredential } from '@/lib/crypto';
import { writeAuditLog } from '@/lib/auditLog';

async function requireAdmin() {
    const session = await getSession();
    if (!session?.id) throw new Error('Unauthorized');
    return session;
}

/**
 * Returns whether credentials exist, with masked previews.
 */
export async function getCredentialStatusAction() {
    try {
        const session = await requireAdmin();
        const supabase = getServerSupabase();

        const { data, error } = await supabase
            .from('admin_users')
            .select('user_api_credential')
            .eq('id', session.id)
            .single();

        if (error || !data?.user_api_credential) return { exists: false };

        const cred = JSON.parse(data.user_api_credential);
        const decryptedKey = decryptCredential(cred.supabase_published_key);
        const maskKey = (val) => val ? `${val.substring(0, 8)}${'•'.repeat(20)}` : '';

        return {
            exists: true,
            maskedUrl: cred.supabase_url || '',
            maskedAnonKey: maskKey(decryptedKey),
        };
    } catch {
        return { exists: false };
    }
}

/**
 * Reads credentials from DB, decrypts the publishable key, and executes
 * the provided SQL against the user's Supabase project.
 */
export async function executeSupabaseSQLAction(sql) {
    const session = await requireAdmin();
    if (!sql?.trim()) return { success: false, message: 'No SQL to execute.' };

    const supabase = getServerSupabase();

    const { data, error } = await supabase
        .from('admin_users')
        .select('user_api_credential')
        .eq('id', session.id)
        .single();

    if (error || !data?.user_api_credential) {
        return { success: false, message: 'No credentials found. Please configure them in Settings.' };
    }

    let url, key;
    try {
        const cred = JSON.parse(data.user_api_credential);
        url = cred.supabase_url;
        key = decryptCredential(cred.supabase_published_key);
    } catch {
        return { success: false, message: 'Failed to decrypt credentials. Please re-save them in Settings.' };
    }

    try {
        const response = await fetch(`${url}/rest/v1/rpc/exec_sql`, {
            method: 'POST',
            headers: {
                apikey: key,
                Authorization: `Bearer ${key}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ sql }),
        });

        const responseData = await response.json().catch(() => ({}));

        if (!response.ok) {
            const msg = responseData?.message || responseData?.error || responseData?.hint
                || `API responded with HTTP ${response.status}`;
            return { success: false, message: msg };
        }

        await writeAuditLog(supabase, {
            action: 'sql_execute',
            actor: session.username,
            actorId: session.id,
            detail: `SQL executed (${sql.length} chars)`,
        });

        return { success: true, message: 'SQL executed successfully. Tables have been created in your Supabase project.' };
    } catch (e) {
        return { success: false, message: `Network error: ${e.message}` };
    }
}
