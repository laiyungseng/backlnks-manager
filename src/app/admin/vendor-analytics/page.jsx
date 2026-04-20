import { getVendorList, getVendorStats } from './actions';
import VendorAnalyticsDashboard from './VendorAnalyticsDashboard';
import { BarChart2 } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function VendorAnalyticsPage() {
    const [vendorsRes, statsRes] = await Promise.all([
        getVendorList(),
        getVendorStats(null),
    ]);

    const vendors = vendorsRes.success ? vendorsRes.vendors : [];
    const initialStats = statsRes.success ? statsRes : null;

    return (
        <div>
            <div className="flex items-center gap-3 mb-6">
                <BarChart2 className="w-6 h-6 text-indigo-600" />
                <div>
                    <h1 className="text-2xl font-black text-slate-900">Vendor Analytics</h1>
                    <p className="text-sm text-slate-500">Performance insights across vendors and placements.</p>
                </div>
            </div>
            <VendorAnalyticsDashboard vendors={vendors} initialStats={initialStats} />
        </div>
    );
}
