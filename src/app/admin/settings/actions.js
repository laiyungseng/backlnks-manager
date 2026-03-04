'use server';

import fs from 'fs';
import path from 'path';
import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { encryptCredential, decryptCredential } from '@/lib/crypto';

/**
 * Writes plaintext URL + key to .env for bootstrap on next server restart.
 * Only updates a variable if the existing value differs from the new one.
 * The encrypted key is NOT written here — only the DB stores the encrypted value.
 */
function persistToEnvFile(url, key) {
    const envPath = path.join(process.cwd(), '.env');
    let content = '';
    try { content = fs.readFileSync(envPath, 'utf8'); } catch { content = ''; }

    // Read current values to compare
    let currentUrl = '';
    let currentKey = '';
    for (const line of content.split('\n')) {
        if (line.startsWith('SUPABASE_URL=')) currentUrl = line.slice('SUPABASE_URL='.length).trim();
        if (line.startsWith('SUPABASE_ANON_KEY=')) currentKey = line.slice('SUPABASE_ANON_KEY='.length).trim();
    }

    // Skip write entirely if both values are already identical
    if (currentUrl === url && currentKey === key) return;

    const lines = content.split('\n');
    let urlWritten = false;
    let keyWritten = false;

    const updated = lines.map(line => {
        if (line.startsWith('SUPABASE_URL=')) { urlWritten = true; return `SUPABASE_URL=${url}`; }
        if (line.startsWith('SUPABASE_ANON_KEY=')) { keyWritten = true; return `SUPABASE_ANON_KEY=${key}`; }
        return line;
    });

    if (!urlWritten) updated.push(`SUPABASE_URL=${url}`);
    if (!keyWritten) updated.push(`SUPABASE_ANON_KEY=${key}`);

    fs.writeFileSync(envPath, updated.join('\n'), 'utf8');
}

/**
 * DB JSON shape stored in admin_users.user_api_credential:
 * {
 *   "supabase_url":          "<plaintext url>",
 *   "supabase_published_key": "<AES-256-GCM encrypted anon key>"
 * }
 * The published key is encrypted — only decrypted server-side when needed.
 * Maps to: SUPABASE_URL / SUPABASE_ANON_KEY in .env.
 */
export async function saveApiCredentialAction(adminUserId, fields) {
    if (!adminUserId) return { success: false, message: 'Session expired. Please log in again.' };

    const { supabase_url, supabase_anon_key } = fields;
    if (!supabase_url?.trim() || !supabase_anon_key?.trim()) {
        return { success: false, message: 'Both Supabase URL and Publishable Key are required.' };
    }

    const url = supabase_url.trim();
    const key = supabase_anon_key.trim();

    try {
        const encryptedKey = encryptCredential(key);
        const payload = JSON.stringify({
            supabase_url: url,
            supabase_published_key: encryptedKey,
        });

        // Use the submitted credentials to build the client — the global supabase
        // client may be stale (empty .env after logout) so we can't rely on it here.
        const client = createClient(url, key);
        const { error } = await client
            .from('admin_users')
            .update({ user_api_credential: payload })
            .eq('id', adminUserId);

        if (error) return { success: false, message: error.message };

        // Persist plaintext to .env for local bootstrap on server restart
        persistToEnvFile(url, key);

        return { success: true };
    } catch (e) {
        return { success: false, message: e.message };
    }
}

/**
 * Returns whether credentials exist and masked previews.
 * Never returns raw values to the client.
 */
export async function getApiCredentialStatusAction(adminUserId) {
    if (!adminUserId || !supabase) return { exists: false };

    const { data, error } = await supabase
        .from('admin_users')
        .select('user_api_credential')
        .eq('id', adminUserId)
        .single();

    if (error || !data?.user_api_credential) return { exists: false };

    try {
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
 * Tests connectivity against the Supabase project.
 *
 * Priority:
 *   1. Plaintext credentials from .env (SUPABASE_URL / SUPABASE_ANON_KEY)
 *   2. Fallback: read user_api_credential from DB, decrypt supabase_published_key
 *
 * Uses createClient so auth headers are handled correctly for all key formats.
 */
export async function checkConnectionAction(adminUserId) {
    let url, key;

    // ── 1. Try .env plaintext first (no decryption needed) ───────────────────
    try {
        const envPath = path.join(process.cwd(), '.env');
        const content = fs.readFileSync(envPath, 'utf8');
        for (const line of content.split('\n')) {
            if (line.startsWith('SUPABASE_URL='))
                url = line.slice('SUPABASE_URL='.length).trim();
            if (line.startsWith('SUPABASE_ANON_KEY='))
                key = line.slice('SUPABASE_ANON_KEY='.length).trim();
        }
    } catch { /* .env unreadable — fall through */ }

    // ── 2. Fallback: DB → decrypt supabase_published_key ─────────────────────
    if (!url || !key) {
        if (!adminUserId || !supabase) return { success: false, message: 'No credentials found. Save your credentials first.' };

        const { data, error: dbError } = await supabase
            .from('admin_users')
            .select('user_api_credential')
            .eq('id', adminUserId)
            .single();

        if (dbError || !data?.user_api_credential) {
            return { success: false, message: 'No credentials found. Save your credentials first.' };
        }

        try {
            const cred = JSON.parse(data.user_api_credential);
            url = cred.supabase_url;
            key = decryptCredential(cred.supabase_published_key);
        } catch {
            return { success: false, message: 'Failed to decrypt credentials. Please re-save them.' };
        }
    }

    if (!url || !key) {
        return { success: false, message: 'URL or key is missing. Please save your credentials.' };
    }

    // ── 3. Test connection ────────────────────────────────────────────────────
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
 * Clears the session cookie on logout.
 */
export async function logoutAction() {
    const cookieStore = await cookies();
    cookieStore.delete('df_admin_session_active');
}
