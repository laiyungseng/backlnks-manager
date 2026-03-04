'use server';

import { supabase } from '@/lib/supabase';

export async function verifyLoginAction(username, password) {
    if (!username || !password) {
        return { success: false, message: 'Please provide both username and password.' };
    }

    if (!supabase) {
        return { success: false, message: 'Database connection not configured. Please set environment variables.' };
    }

    // Check credentials against the admin_users table
    const { data, error } = await supabase
        .from('admin_users')
        .select('id, username')
        .eq('username', username)
        .eq('password', password)
        .single();

    if (error || !data) {
        // Log the error internally but return a generic message to the user
        console.error('Login verification failed:', error?.message);
        return { success: false, message: 'Invalid username or password.' };
    }

    // Record login timestamp
    const isoString = new Date().toISOString();
    await supabase
        .from('admin_users')
        .update({ last_login: isoString })
        .eq('id', data.id);

    return { success: true, user: data, loginTime: isoString };
}
