'use server';

import { getSession, clearSessionCookie } from '@/lib/session';
import { getServerSupabase } from '@/lib/supabase-server';
import { encryptCredential, decryptCredential } from '@/lib/crypto';
import { writeAuditLog } from '@/lib/auditLog';
import { createClient } from '@supabase/supabase-js';
import bcrypt from 'bcryptjs';

async function requireAdmin() {
    const session = await getSession();
    if (!session?.id) throw new Error('Unauthorized');
    return session;
}

/**
 * DB JSON shape stored in admin_users.user_api_credential:
 * {
 *   "supabase_url":          "<plaintext url>",
 *   "supabase_published_key": "<AES-256-GCM encrypted anon key>"
 * }
 */
export async function saveApiCredentialAction(fields) {
    const session = await requireAdmin();

    const { supabase_url, supabase_anon_key } = fields;
    if (!supabase_url?.trim() || !supabase_anon_key?.trim()) {
        return { success: false, message: 'Both Supabase URL and Publishable Key are required.' };
    }

    const url = supabase_url.trim();
    const key = supabase_anon_key.trim();

    try {
        const supabase = getServerSupabase();
        const encryptedKey = encryptCredential(key);
        const payload = JSON.stringify({
            supabase_url: url,
            supabase_published_key: encryptedKey,
        });

        const { error } = await supabase
            .from('admin_users')
            .update({ user_api_credential: payload })
            .eq('id', session.id);

        if (error) return { success: false, message: error.message };

        await writeAuditLog(supabase, {
            action: 'settings_credential_save',
            actor: session.username,
            actorId: session.id,
            detail: `Supabase URL updated to: ${url}`,
        });

        return { success: true };
    } catch (e) {
        return { success: false, message: e.message };
    }
}

/**
 * Returns whether credentials exist and masked previews.
 * Never returns raw values to the client.
 */
export async function getApiCredentialStatusAction() {
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
 * Tests connectivity using credentials from env vars or DB fallback.
 */
export async function checkConnectionAction() {
    await requireAdmin();

    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_ANON_KEY;

    if (!url || !key) {
        return { success: false, message: 'No credentials found in environment variables.' };
    }

    try {
        const client = createClient(url, key);
        const { error } = await client.from('admin_users').select('id').limit(1);
        if (error) return { success: false, message: `Connection failed: ${error.message}` };
        return { success: true, message: 'Connection successful.' };
    } catch (e) {
        return { success: false, message: `Network error: ${e.message}` };
    }
}

/**
 * Changes the admin password. Hashes with bcrypt before storing.
 */
export async function changePasswordAction(username, currentPassword, newPassword) {
    const session = await requireAdmin();

    if (!username || !currentPassword || !newPassword) {
        return { success: false, message: 'Username, current password, and new password are required.' };
    }
    if (newPassword.length < 12) {
        return { success: false, message: 'New password must be at least 12 characters.' };
    }

    try {
        const supabase = getServerSupabase();
        const { data, error } = await supabase
            .from('admin_users')
            .select('password_hash, username')
            .eq('id', session.id)
            .single();

        if (error || !data) return { success: false, message: 'Could not verify current credentials.' };

        // Cross-check username
        if (data.username !== username) {
            return { success: false, message: 'Invalid username.' };
        }

        let currentOk = false;
        if (data.password_hash) {
            currentOk = await bcrypt.compare(currentPassword, data.password_hash);
        }

        if (!currentOk) return { success: false, message: 'Current password is incorrect.' };

        const newHash = await bcrypt.hash(newPassword, 12);
        const { error: updateError } = await supabase
            .from('admin_users')
            .update({ password_hash: newHash })
            .eq('id', session.id);

        if (updateError) return { success: false, message: updateError.message };

        await writeAuditLog(supabase, {
            action: 'password_change',
            actor: session.username,
            actorId: session.id,
        });

        return { success: true };
    } catch (e) {
        return { success: false, message: e.message };
    }
}

/**
 * Clears the session cookie on logout.
 */
export async function logoutAction() {
    await clearSessionCookie();
}
