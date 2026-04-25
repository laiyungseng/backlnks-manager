import { getServerSupabase } from '@/lib/supabase-server';
import { verifyClientSession, getSession } from '@/lib/session';
import { redirect } from 'next/navigation';
import ClientCompletedList from './ClientCompletedList';

export const dynamic = 'force-dynamic';

export default async function ClientCompletedPage({ params }) {
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
            id, project_name, status, country, total_quantity,
            created_date, completed_date, payment_status,
            project_targets ( category ),
            projects_hub ( vendor_staging_data, targets ),
            placements ( id ),
            vendors ( vendor_name )
        `)
        .eq('client_name', client.client_name)
        .order('created_date', { ascending: false });

    if (error) console.error('Client Completed fetch error:', error);

    const completedProjects = (projects || []).filter(p => {
        const hasPlacements = p.placements?.length > 0;
        return (p.status === 'Finalized' || hasPlacements) && p.payment_status !== 'pending';
    });

    return (
        <div className="max-w-6xl mx-auto px-6 py-8 pb-20">
            <ClientCompletedList projects={completedProjects} displayName={client.client_name} />
        </div>
    );
}
