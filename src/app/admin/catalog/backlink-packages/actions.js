'use server';

import { getServerSupabase } from '@/lib/supabase-server';
import { getSession } from '@/lib/session';
import { revalidatePath } from 'next/cache';

async function requireAdmin() {
    const session = await getSession();
    if (!session?.id) throw new Error('Unauthorized');
    return session;
}

// Fetch all packages with computed usage stats
export async function getPackagesAction() {
    try { await requireAdmin(); } catch { return []; }
    const supabase = getServerSupabase();

    const { data: packages, error } = await supabase
        .from('backlink_packages')
        .select('*, vendors ( vendor_name )')
        .order('created_at', { ascending: false });

    if (error || !packages) return [];

    // For each package, compute used_quantity from non-closed projects
    const ids = packages.map(p => p.id);
    const { data: projectRows } = await supabase
        .from('projects')
        .select('package_id, project_name, total_quantity, status, id')
        .in('package_id', ids);

    const usageMap = {};
    const projectsByPackage = {};

    (projectRows || []).forEach(p => {
        if (!p.package_id) return;
        if (!projectsByPackage[p.package_id]) projectsByPackage[p.package_id] = [];
        projectsByPackage[p.package_id].push(p);
        if (p.status !== 'Closed') {
            usageMap[p.package_id] = (usageMap[p.package_id] || 0) + (p.total_quantity || 0);
        }
    });

    return packages.map(pkg => {
        const used = usageMap[pkg.id] || 0;
        const remaining = Math.max(0, pkg.total_quantity - used);
        const projects = projectsByPackage[pkg.id] || [];
        return {
            ...pkg,
            vendor_name: pkg.vendors?.vendor_name || 'Unknown',
            used_quantity: used,
            remaining_quantity: remaining,
            status: remaining <= 0 ? 'Exhausted' : 'Active',
            projects,
        };
    });
}

// Get available packages for a vendor (for kickoff dropdown)
export async function getAvailablePackagesAction(vendorName) {
    if (!vendorName?.trim()) return [];

    const supabase = getServerSupabase();

    const { data: vendor } = await supabase
        .from('vendors')
        .select('id')
        .eq('vendor_name', vendorName.trim())
        .maybeSingle();

    if (!vendor) return [];

    const { data: packages } = await supabase
        .from('backlink_packages')
        .select('id, code, cat_abbr, category, total_quantity, vendors ( vendor_name )')
        .eq('vendor_id', vendor.id)
        .order('created_at', { ascending: false });

    if (!packages?.length) return [];

    const ids = packages.map(p => p.id);
    const { data: projectRows } = await supabase
        .from('projects')
        .select('package_id, total_quantity, status')
        .in('package_id', ids)
        .neq('status', 'Closed');

    const usageMap = {};
    (projectRows || []).forEach(p => {
        if (!p.package_id) return;
        usageMap[p.package_id] = (usageMap[p.package_id] || 0) + (p.total_quantity || 0);
    });

    return packages.map(pkg => {
        const used = usageMap[pkg.id] || 0;
        const remaining = Math.max(0, pkg.total_quantity - used);
        return {
            id: pkg.id,
            code: pkg.code,
            category: pkg.category,
            vendor_name: pkg.vendors?.vendor_name || vendorName,
            total_quantity: pkg.total_quantity,
            used_quantity: used,
            remaining_quantity: remaining,
        };
    });
}

// Create a new package
export async function createPackageAction(formData) {
    try { await requireAdmin(); } catch { return { success: false, message: 'Unauthorized.' }; }

    const supabase = getServerSupabase();

    const vendorName = formData.get('vendor_name')?.trim();
    const category   = formData.get('category')?.trim();
    const catAbbr    = (formData.get('cat_abbr') || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4);
    const totalQty   = parseInt(formData.get('total_quantity'));
    const purchasedAt = formData.get('purchased_at') || new Date().toISOString();
    const notes      = formData.get('notes')?.trim() || null;

    if (!vendorName) return { success: false, message: 'Vendor is required.' };
    if (!category)   return { success: false, message: 'Category is required.' };
    if (!catAbbr)    return { success: false, message: 'Abbreviation is required.' };
    if (!totalQty || totalQty <= 0) return { success: false, message: 'Total quantity must be greater than 0.' };

    // Resolve vendor
    const { data: vendor } = await supabase
        .from('vendors')
        .select('id')
        .eq('vendor_name', vendorName)
        .maybeSingle();

    if (!vendor) return { success: false, message: `Vendor "${vendorName}" not found.` };

    // Generate code: BK-{ABBR}-{SEQ}
    const prefix = `BK-${catAbbr}-`;
    const { count } = await supabase
        .from('backlink_packages')
        .select('id', { count: 'exact', head: true })
        .like('code', `${prefix}%`);

    const seq = String((count || 0) + 1).padStart(3, '0');
    const code = `${prefix}${seq}`;

    const { error } = await supabase.from('backlink_packages').insert({
        code,
        vendor_id: vendor.id,
        category,
        cat_abbr: catAbbr,
        total_quantity: totalQty,
        purchased_at: purchasedAt,
        notes,
    });

    if (error) return { success: false, message: `Failed to create package: ${error.message}` };

    revalidatePath('/admin/backlinks-package');
    return { success: true, message: `Package ${code} created successfully.` };
}

// Delete a package (blocked if any non-Closed project references it)
export async function deletePackageAction(packageId) {
    try { await requireAdmin(); } catch { return { success: false, message: 'Unauthorized.' }; }
    if (!packageId) return { success: false, message: 'Invalid package.' };

    const supabase = getServerSupabase();

    const { count } = await supabase
        .from('projects')
        .select('id', { count: 'exact', head: true })
        .eq('package_id', packageId)
        .neq('status', 'Closed');

    if ((count || 0) > 0) {
        return { success: false, message: `Cannot delete — ${count} active project(s) are using this package.` };
    }

    const { error } = await supabase.from('backlink_packages').delete().eq('id', packageId);
    if (error) return { success: false, message: `Failed to delete: ${error.message}` };

    revalidatePath('/admin/backlinks-package');
    return { success: true };
}

// Auto-set finished_at when a package becomes exhausted (called from kickoff action)
export async function syncFinishedAtAction(packageIds) {
    if (!packageIds?.length) return;
    const supabase = getServerSupabase();

    for (const pkgId of packageIds) {
        const { data: pkg } = await supabase
            .from('backlink_packages')
            .select('total_quantity, finished_at')
            .eq('id', pkgId)
            .single();

        if (!pkg || pkg.finished_at) continue;

        const { data: rows } = await supabase
            .from('projects')
            .select('total_quantity')
            .eq('package_id', pkgId)
            .neq('status', 'Closed');

        const used = (rows || []).reduce((s, r) => s + (r.total_quantity || 0), 0);
        if (used >= pkg.total_quantity) {
            await supabase
                .from('backlink_packages')
                .update({ finished_at: new Date().toISOString() })
                .eq('id', pkgId);
        }
    }
}
