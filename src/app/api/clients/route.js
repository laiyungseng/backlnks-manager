import { NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase-server';
import { getSession } from '@/lib/session';

export const dynamic = 'force-dynamic';

export async function GET() {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const supabase = getServerSupabase();
    const { data, error } = await supabase
        .from('clients')
        .select('id, client_name, invite_token_expires_at, invite_used_at, session_version, created_at')
        .order('created_at', { ascending: false });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
}
