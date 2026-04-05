'use server';

import bcrypt from 'bcryptjs';
import { getServerSupabase } from '@/lib/supabase-server';
import { setSessionCookie } from '@/lib/session';
import { loginRateLimiter } from '@/lib/rateLimiter';
import { writeAuditLog } from '@/lib/auditLog';

export async function verifyLoginAction(username, password) {
    if (!username || !password) {
        return { success: false, message: 'Please provide both username and password.' };
    }

    // Rate-limit by username (brute-force protection)
    const rl = loginRateLimiter.check(username.toLowerCase());
    if (!rl.allowed) {
        return { success: false, message: `Too many login attempts. Try again in ${rl.retryAfterSeconds}s.` };
    }

    let supabase;
    try {
        supabase = getServerSupabase();
    } catch {
        return { success: false, message: 'Database connection not configured. Please set environment variables.' };
    }

    // Fetch by username only — never compare passwords in SQL
    const { data, error } = await supabase
        .from('admin_users')
        .select('id, username, password_hash')
        .eq('username', username.trim())
        .single();

    if (error || !data) {
        await writeAuditLog(supabase, { action: 'login_fail', actor: username, detail: 'user not found' });
        return { success: false, message: 'Invalid username or password.' };
    }

    if (!data.password_hash) {
        return { success: false, message: 'Account not configured. Contact administrator.' };
    }

    let passwordOk = false;
    passwordOk = await bcrypt.compare(password, data.password_hash);

    if (!passwordOk) {
        await writeAuditLog(supabase, { action: 'login_fail', actor: username, detail: 'bad password' });
        return { success: false, message: 'Invalid username or password.' };
    }

    loginRateLimiter.reset(username.toLowerCase());

    const now = new Date().toISOString();
    await supabase.from('admin_users').update({ last_login: now }).eq('id', data.id);

    // Issue signed HttpOnly session cookie — identity is now server-controlled
    await setSessionCookie({ id: data.id, username: data.username });

    await writeAuditLog(supabase, { action: 'login_success', actor: data.username, actorId: data.id });

    return { success: true };
}
