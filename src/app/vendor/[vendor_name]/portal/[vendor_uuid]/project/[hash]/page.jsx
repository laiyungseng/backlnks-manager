import { Suspense } from 'react';
import { getServerSupabase } from '@/lib/supabase-server';
import { verifyVendorSession, getSession } from '@/lib/session';
import { redirect } from 'next/navigation';
import ProjectPageHeader from './ProjectPageHeader';
import { writeAuditLog } from '@/lib/auditLog';
import ProjectFormSection from './ProjectFormSection';
import FormSkeleton from './FormSkeleton';

export const dynamic = 'force-dynamic';

export default async function PortalProjectPage({ params }) {
    const supabase = getServerSupabase();
    const resolvedParams = await params;
    const hash = resolvedParams?.hash;
    const vendorNameParam = resolvedParams?.vendor_name;
    const vendorUuidParam = resolvedParams?.vendor_uuid;

    if (!hash || !vendorNameParam || !vendorUuidParam) {
        redirect('/unauthorized');
    }

    const adminSession = await getSession();
    if (!adminSession) {
        const session = await verifyVendorSession(supabase);
        if (!session?.vendorId || session.vendorId !== vendorUuidParam) redirect('/vendor');
    }

    const { data: projectsHub, error: hubError } = await supabase
        .from('projects_hub')
        .select('project_id')
        .eq('hash', hash)
        .single();

    if (hubError || !projectsHub) redirect('/unauthorized');

    const projectId = projectsHub.project_id;

    const { data: projectData } = await supabase
        .from('projects')
        .select('project_name, deadline, vendor_id')
        .eq('id', projectId)
        .single();

    if (!projectData?.vendor_id) redirect('/unauthorized');

    const { data: vendorMatch } = await supabase
        .from('vendors')
        .select('id, vendor_name')
        .eq('id', projectData.vendor_id)
        .maybeSingle();

    if (!vendorMatch) redirect('/unauthorized');
    if (vendorMatch.id !== vendorUuidParam) redirect('/unauthorized');

    const expectedSlug = vendorMatch.vendor_name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    if (expectedSlug !== vendorNameParam) redirect('/unauthorized');

    void writeAuditLog(supabase, {
        action: 'vendor_project_view',
        actorId: vendorUuidParam,
        targetId: projectId,
        detail: `hash=${hash}`,
    });

    return (
        <ProjectPageHeader
            projectName={projectData?.project_name}
            deadline={projectData?.deadline}
            hash={hash}
        >
            <Suspense fallback={<FormSkeleton />}>
                <ProjectFormSection
                    projectId={projectId}
                    hash={hash}
                    vendorName={vendorNameParam}
                    vendorUuid={vendorUuidParam}
                />
            </Suspense>
        </ProjectPageHeader>
    );
}
