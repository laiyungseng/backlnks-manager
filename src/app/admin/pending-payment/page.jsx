import { getServerSupabase } from '@/lib/supabase-server';
import { getSession } from '@/lib/session';
import { redirect } from 'next/navigation';
import PendingPaymentClient from './PendingPaymentClient';

export const dynamic = 'force-dynamic';

export default async function AdminPendingPaymentPage() {
    const session = await getSession();
    if (!session?.id) redirect('/login');

    const supabase = getServerSupabase();

    const [{ data: projects, error }, { data: packages }] = await Promise.all([
        supabase
            .from('projects')
            .select(`
                id, project_name, price, price_type, total_quantity,
                start_date, deadline, created_date,
                project_targets ( category, sheet_name, price, quantity_requested ),
                vendors ( vendor_name )
            `)
            .eq('payment_status', 'pending')
            .order('created_date', { ascending: false }),
        supabase
            .from('backlink_packages')
            .select('id, code, category, cat_abbr, total_quantity, total_price, purchased_at, payment_status, is_approved, vendors ( vendor_name )')
            .eq('payment_status', 'pending')
            .order('purchased_at', { ascending: false }),
    ]);

    if (error) console.error('Pending Payment fetch error:', error);

    // Group projects by vendor
    const grouped = {};
    for (const p of (projects || [])) {
        const vendorName = p.vendors?.vendor_name || 'Unknown Vendor';
        if (!grouped[vendorName]) grouped[vendorName] = [];
        grouped[vendorName].push(p);
    }

    const computeProjectCost = (p) => {
        const targets = Array.isArray(p.project_targets) ? p.project_targets : [];
        if (targets.length > 0 && targets.some(t => parseFloat(t.price) > 0)) {
            return targets.reduce((sum, t) => sum + (parseFloat(t.price) || 0) * (parseInt(t.quantity_requested) || 0), 0);
        }
        if (p.price_type === 'package') return parseFloat(p.price) || 0;
        return (parseFloat(p.price) || 0) * (p.total_quantity || 0);
    };

    const vendorGroups = Object.entries(grouped).map(([vendorName, items]) => {
        const itemsWithCost = items
            .map(p => ({ ...p, _computedCost: computeProjectCost(p) }))
            .sort((a, b) => (a.project_name || '').localeCompare(b.project_name || ''));
        const totalPrice = itemsWithCost.reduce((acc, p) => acc + p._computedCost, 0);
        return { vendorName, items: itemsWithCost, totalPrice };
    }).sort((a, b) => a.vendorName.localeCompare(b.vendorName));

    // Group packages by vendor
    const pkgGrouped = {};
    for (const pkg of (packages || [])) {
        const vendorName = pkg.vendors?.vendor_name || 'Unknown Vendor';
        if (!pkgGrouped[vendorName]) pkgGrouped[vendorName] = [];
        pkgGrouped[vendorName].push(pkg);
    }

    const packageGroups = Object.entries(pkgGrouped).map(([vendorName, items]) => {
        const sortedItems = [...items].sort((a, b) => (a.code || '').localeCompare(b.code || ''));
        const totalPrice = sortedItems.reduce((acc, p) => acc + (parseFloat(p.total_price) || 0), 0);
        return { vendorName, items: sortedItems, totalPrice };
    }).sort((a, b) => a.vendorName.localeCompare(b.vendorName));

    return (
        <div className="max-w-5xl mx-auto px-6 py-8 pb-20">
            <PendingPaymentClient vendorGroups={vendorGroups} packageGroups={packageGroups} />
        </div>
    );
}
