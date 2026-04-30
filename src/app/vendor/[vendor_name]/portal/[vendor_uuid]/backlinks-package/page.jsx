import { getServerSupabase } from '@/lib/supabase-server';
import { verifyVendorSession } from '@/lib/session';
import { redirect } from 'next/navigation';
import { Package } from 'lucide-react';

export const dynamic = 'force-dynamic';

function fmtDate(iso) {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function StatusBadge({ status }) {
    return status === 'Exhausted'
        ? <span className="px-2 py-0.5 text-[9px] font-black uppercase tracking-widest rounded bg-slate-100 text-slate-500">Exhausted</span>
        : <span className="px-2 py-0.5 text-[9px] font-black uppercase tracking-widest rounded bg-emerald-100 text-emerald-700">Active</span>;
}

export default async function VendorBacklinksPackagePage({ params }) {
    const supabase = getServerSupabase();
    const session = await verifyVendorSession(supabase);
    if (!session) redirect(`/vendor/${params.vendor_name}/portal/${params.vendor_uuid}/dashboard`);

    // Fetch packages for this vendor
    const { data: packages } = await supabase
        .from('backlink_packages')
        .select('id, code, category, cat_abbr, total_quantity, purchased_at, finished_at, notes')
        .eq('vendor_id', session.vendorId)
        .order('created_at', { ascending: false });

    const pkgList = packages || [];

    // Compute usage for each package
    let enriched = [];
    if (pkgList.length > 0) {
        const ids = pkgList.map(p => p.id);
        const { data: projectRows } = await supabase
            .from('projects')
            .select('package_id, total_quantity, status')
            .in('package_id', ids);

        const usageMap = {};
        (projectRows || []).forEach(p => {
            if (!p.package_id) return;
            if (p.status !== 'Closed') {
                usageMap[p.package_id] = (usageMap[p.package_id] || 0) + (p.total_quantity || 0);
            }
        });

        enriched = pkgList.map(pkg => {
            const used = usageMap[pkg.id] || 0;
            const remaining = Math.max(0, pkg.total_quantity - used);
            return {
                ...pkg,
                used_quantity: used,
                remaining_quantity: remaining,
                status: remaining <= 0 ? 'Exhausted' : 'Active',
            };
        });
    }

    const activeCount    = enriched.filter(p => p.status === 'Active').length;
    const exhaustedCount = enriched.filter(p => p.status === 'Exhausted').length;
    const totalLinks     = enriched.reduce((s, p) => s + p.total_quantity, 0);
    const usedLinks      = enriched.reduce((s, p) => s + p.used_quantity, 0);

    return (
        <div className="p-8 max-w-6xl mx-auto">
            {/* Header */}
            <div className="flex items-center gap-4 mb-8">
                <div className="w-12 h-12 bg-indigo-50 rounded-2xl flex items-center justify-center border border-indigo-100">
                    <Package className="w-6 h-6 text-indigo-600" />
                </div>
                <div>
                    <h1 className="text-2xl font-black text-slate-900 tracking-tight uppercase">Backlink Packages</h1>
                    <p className="text-xs text-slate-400 font-semibold mt-0.5">Your purchased link packages and usage overview</p>
                </div>
            </div>

            {/* Summary cards */}
            {enriched.length > 0 && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                    {[
                        { label: 'Total Packages', value: enriched.length, color: 'indigo' },
                        { label: 'Active', value: activeCount, color: 'emerald' },
                        { label: 'Total Links', value: totalLinks, color: 'slate' },
                        { label: 'Links Used', value: usedLinks, color: 'amber' },
                    ].map(({ label, value, color }) => (
                        <div key={label} className="bg-white rounded-xl border border-slate-200 p-4">
                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">{label}</p>
                            <p className={`text-2xl font-black text-${color}-600`}>{value}</p>
                        </div>
                    ))}
                </div>
            )}

            {/* Table */}
            {enriched.length === 0 ? (
                <div className="text-center py-20 text-slate-400 bg-white rounded-2xl border border-slate-200">
                    <Package className="w-10 h-10 mx-auto mb-3 opacity-30" />
                    <p className="text-sm font-semibold">No packages assigned to your account yet.</p>
                    <p className="text-xs mt-1">Contact your admin to add packages.</p>
                </div>
            ) : (
                <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
                    {/* Column headers */}
                    <div className="hidden md:grid grid-cols-12 px-6 py-3 text-[9px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 bg-slate-50">
                        <div className="col-span-2">Code</div>
                        <div className="col-span-2">Category</div>
                        <div className="col-span-1 text-center">Total</div>
                        <div className="col-span-1 text-center">Used</div>
                        <div className="col-span-2 text-center">Remaining</div>
                        <div className="col-span-2">Purchased</div>
                        <div className="col-span-1">Finished</div>
                        <div className="col-span-1 text-right">Status</div>
                    </div>

                    <div className="divide-y divide-slate-100">
                        {enriched.map(pkg => {
                            const remainPct = pkg.total_quantity > 0
                                ? Math.round((pkg.remaining_quantity / pkg.total_quantity) * 100)
                                : 0;
                            return (
                                <div key={pkg.id} className="grid grid-cols-12 items-center px-6 py-4 gap-3 hover:bg-slate-50/50 transition-colors">
                                    <div className="col-span-2">
                                        <span className="text-xs font-black text-indigo-700 font-mono tracking-wider">{pkg.code}</span>
                                    </div>
                                    <div className="col-span-2">
                                        <span className="text-xs font-semibold text-slate-700">{pkg.category}</span>
                                    </div>
                                    <div className="col-span-1 text-center">
                                        <span className="text-sm font-bold text-slate-800">{pkg.total_quantity}</span>
                                    </div>
                                    <div className="col-span-1 text-center">
                                        <span className="text-sm font-semibold text-slate-600">{pkg.used_quantity}</span>
                                    </div>
                                    <div className="col-span-2 flex flex-col items-center gap-1">
                                        <span className={`text-sm font-bold ${pkg.remaining_quantity <= 0 ? 'text-red-500' : 'text-emerald-600'}`}>
                                            {pkg.remaining_quantity}
                                            <span className="text-[9px] font-semibold text-slate-400 ml-1">({remainPct}%)</span>
                                        </span>
                                        <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                            <div
                                                className={`h-full rounded-full ${remainPct <= 10 ? 'bg-red-400' : remainPct <= 40 ? 'bg-amber-400' : 'bg-emerald-400'}`}
                                                style={{ width: `${remainPct}%` }}
                                            />
                                        </div>
                                    </div>
                                    <div className="col-span-2">
                                        <span className="text-xs font-semibold text-slate-700">{fmtDate(pkg.purchased_at)}</span>
                                    </div>
                                    <div className="col-span-1">
                                        <span className="text-xs text-slate-500">{fmtDate(pkg.finished_at)}</span>
                                    </div>
                                    <div className="col-span-1 flex justify-end">
                                        <StatusBadge status={pkg.status} />
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
}
