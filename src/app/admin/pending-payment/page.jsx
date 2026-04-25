import { getServerSupabase } from '@/lib/supabase-server';
import { getSession } from '@/lib/session';
import { redirect } from 'next/navigation';
import PendingPaymentClient from './PendingPaymentClient';

export const dynamic = 'force-dynamic';

export default async function AdminPendingPaymentPage() {
    const session = await getSession();
    if (!session?.id) redirect('/login');

    const supabase = getServerSupabase();

    const { data: projects, error } = await supabase
        .from('projects')
        .select(`
            id, project_name, price, price_type, total_quantity,
            start_date, deadline, created_date,
            project_targets ( category ),
            vendors ( vendor_name )
        `)
        .eq('payment_status', 'pending')
        .order('created_date', { ascending: false });

    if (error) console.error('Pending Payment fetch error:', error);

    // Group by vendor_name server-side
    const grouped = {};
    for (const p of (projects || [])) {
        const vendorName = p.vendors?.vendor_name || 'Unknown Vendor';
        if (!grouped[vendorName]) grouped[vendorName] = [];
        grouped[vendorName].push(p);
    }

    const vendorGroups = Object.entries(grouped).map(([vendorName, items]) => {
        const totalPrice = items.reduce((acc, p) => {
            if (p.price_type === 'package') return acc + (parseFloat(p.price) || 0);
            return acc + (parseFloat(p.price) || 0) * (p.total_quantity || 0);
        }, 0);
        return { vendorName, items, totalPrice };
    });

    return (
        <div className="max-w-5xl mx-auto px-6 py-8 pb-20">
            <PendingPaymentClient vendorGroups={vendorGroups} />
        </div>
    );
}
