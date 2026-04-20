import { getServerSupabase } from '@/lib/supabase-server';
import { getVendorAuditLog, getVendorListForLog } from './actions';
import VendorLogClient from './VendorLogClient';
import { Activity } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function VendorLogPage() {
    const [logsRes, vendorsRes] = await Promise.all([
        getVendorAuditLog({ page: 0, limit: 50 }),
        getVendorListForLog(),
    ]);

    const logs = logsRes.success ? logsRes.logs : [];
    const total = logsRes.success ? logsRes.total : 0;
    const projectNames = logsRes.success ? logsRes.projectNames : {};
    const vendors = vendorsRes.success ? vendorsRes.vendors : [];

    return (
        <div>
            <div className="flex items-center gap-3 mb-6">
                <Activity className="w-6 h-6 text-indigo-600" />
                <div>
                    <h1 className="text-2xl font-black text-slate-900">Vendor Activity Log</h1>
                    <p className="text-sm text-slate-500">Audit trail of vendor actions — page views, saves, and field deletions.</p>
                </div>
            </div>
            <VendorLogClient
                initialLogs={logs}
                initialTotal={total}
                initialProjectNames={projectNames}
                vendors={vendors}
            />
        </div>
    );
}
