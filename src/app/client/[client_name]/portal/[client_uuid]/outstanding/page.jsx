import { getServerSupabase } from '@/lib/supabase-server';
import { verifyClientSession, getSession } from '@/lib/session';
import { redirect } from 'next/navigation';
import OutstandingList from './OutstandingList';

export const dynamic = 'force-dynamic';

export default async function ClientOutstandingPage({ params }) {
    const supabase = getServerSupabase();
    const resolvedParams = await params;
    const clientName = resolvedParams?.client_name;
    const clientUuid = resolvedParams?.client_uuid;

    if (!clientName || !clientUuid) redirect('/client');

    const adminSession = await getSession();
    if (!adminSession) {
        const session = await verifyClientSession(supabase);
        if (!session?.clientId || session.clientId !== clientUuid) redirect('/client');
    }

    const { data: client } = await supabase
        .from('clients')
        .select('id, client_name')
        .eq('id', clientUuid)
        .maybeSingle();

    if (!client) redirect('/client');

    const expectedSlug = client.client_name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    if (expectedSlug !== clientName) redirect('/unauthorized');

    const { data: projects, error } = await supabase
        .from('projects')
        .select(`
            id, project_name, start_date, deadline, total_quantity,
            project_targets ( category ),
            projects_hub ( targets )
        `)
        .eq('client_name', client.client_name)
        .eq('payment_status', 'pending')
        .order('created_date', { ascending: false });

    if (error) console.error('Client Outstanding fetch error:', error);

    return (
        <div className="max-w-6xl mx-auto px-6 py-8 pb-20">
            <OutstandingList projects={projects || []} displayName={client.client_name} />
        </div>
    );
}
