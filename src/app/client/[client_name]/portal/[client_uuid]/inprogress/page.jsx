import { getServerSupabase } from '@/lib/supabase-server';
import { verifyClientSession, getSession } from '@/lib/session';
import { redirect } from 'next/navigation';
import ClientInProgressList from './ClientInProgressList';

export const dynamic = 'force-dynamic';

export default async function ClientInProgressPage({ params }) {
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
            id, project_name, status, is_approved, country, deadline,
            total_quantity, created_date, language, payment_status,
            project_targets ( category ),
            projects_hub ( vendor_staging_data, targets ),
            vendors ( vendor_name )
        `)
        .eq('client_name', client.client_name)
        .order('created_date', { ascending: false });

    if (error) console.error('Client InProgress fetch error:', error);

    const activeProjects = (projects || []).filter(p =>
        p.is_approved && p.status === 'Inprogress' && p.payment_status !== 'pending'
    );

    return (
        <div className="max-w-6xl mx-auto px-6 py-8 pb-20">
            <ClientInProgressList projects={activeProjects} displayName={client.client_name} />
        </div>
    );
}
