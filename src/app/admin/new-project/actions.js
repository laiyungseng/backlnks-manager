'use server';

import { getServerSupabase } from '@/lib/supabase-server';
import { getSession } from '@/lib/session';
import crypto from 'crypto';
import { syncFinishedAtAction } from '../catalog/backlink-packages/actions';

async function requireAdmin() {
    const session = await getSession();
    if (!session?.id) throw new Error('Unauthorized');
    return session;
}

async function resolveVendor(supabase, vendorName) {
    const { data: existing } = await supabase
        .from('vendors').select('id').eq('vendor_name', vendorName).maybeSingle();
    if (existing) return existing.id;

    const { data: legacy } = await supabase.from('vendors').select('id')
        .filter('vendor_details', 'cs', `[{"vendor_name": "${vendorName}"}]`).maybeSingle();
    if (legacy) return legacy.id;

    const { data: newV, error } = await supabase
        .from('vendors').insert({ vendor_name: vendorName }).select('id').single();
    if (error) throw new Error(`Failed to create vendor: ${error.message}`);
    return newV.id;
}

export async function getExistingVendorNames() {
    try { await requireAdmin(); } catch { return []; }
    const supabase = getServerSupabase();
    const { data } = await supabase.from('vendors').select('vendor_name').order('vendor_name').limit(500);
    return [...new Set((data || []).map(r => r.vendor_name).filter(Boolean))];
}

export async function getExistingCampaignTitles() {
    try { await requireAdmin(); } catch { return []; }
    const supabase = getServerSupabase();
    const { data } = await supabase
        .from('project_campaigns')
        .select('title')
        .order('created_at', { ascending: false })
        .limit(200);
    return [...new Set((data || []).map(r => r.title).filter(Boolean))];
}

export async function createCampaignAction(prevState, formData) {
    try { await requireAdmin(); } catch { return { success: false, message: 'Unauthorized.' }; }

    const supabase = getServerSupabase();

    try {
        const campaignTitle = formData.get('campaign_title')?.trim();
        const personInCharge = formData.get('person_in_charge')?.trim();
        const clientName = formData.get('client_name')?.trim() || null;
        const plansRaw = formData.get('plans_json');

        if (!campaignTitle) return { success: false, message: 'Campaign title is required.' };
        if (!plansRaw) return { success: false, message: 'No plans submitted.' };

        let plans;
        try { plans = JSON.parse(plansRaw); } catch {
            return { success: false, message: 'Invalid plans data format.' };
        }

        if (!Array.isArray(plans) || plans.length === 0) {
            return { success: false, message: 'At least one plan is required.' };
        }

        // 1. Create campaign
        const { data: campaign, error: campErr } = await supabase
            .from('project_campaigns')
            .insert({ title: campaignTitle, person_in_charge: personInCharge || null, client_name: clientName })
            .select('id').single();

        if (campErr) throw new Error(`Campaign creation failed: ${campErr.message}`);

        const results = [];

        // Safety: if dripfeed is on with a valid period and the submitted deadline is
        // missing or equals start_date, recompute deadline = start_date + period days.
        const computeDeadlineSafely = (startDate, dl, dripOn, dripPeriod) => {
            if (!startDate) return dl;
            if (!dripOn) return dl;
            const period = parseInt(dripPeriod) || 0;
            if (period <= 0) return dl;
            const needsFix = !dl || dl === startDate;
            if (!needsFix) return dl;
            try {
                const [y, m, d] = startDate.split('-').map(Number);
                const dt = new Date(y, m - 1, d);
                dt.setDate(dt.getDate() + period);
                const yr = dt.getFullYear();
                const mo = String(dt.getMonth() + 1).padStart(2, '0');
                const dy = String(dt.getDate()).padStart(2, '0');
                return `${yr}-${mo}-${dy}`;
            } catch {
                return dl;
            }
        };

        // 2. Process each plan sequentially
        for (const plan of plans) {
            const {
                vendor_name, country, start_date,
                dripfeed_enabled, dripfeed_period, urls_per_day,
                price, price_type, package_id, randomize_languages, remarks,
                languages, project_info_groups
            } = plan;
            const deadline = computeDeadlineSafely(start_date, plan.deadline, dripfeed_enabled, dripfeed_period);

            if (!vendor_name?.trim()) continue;

            const totalQty = (project_info_groups || []).reduce((acc, g) =>
                acc + (g.placement_target || []).reduce((s, t) => s + (parseInt(t.ratio) || 0), 0), 0);

            // Flatten targets for legacy JSONB
            const flattenedTargets = [];
            (project_info_groups || []).forEach(g => {
                (g.placement_target || []).forEach(t => {
                    flattenedTargets.push({
                        anchor_text: t.anchor_text || '',
                        target_url: t.target_url || '',
                        quantity: String(parseInt(t.ratio) || 0),
                        category: g.category,
                        sheet_name: g.sheet_name || null,
                        group_price: parseFloat(g.group_price) || 0,
                        created_at: new Date().toISOString()
                    });
                });
            });

            const projectHash = crypto.randomBytes(32).toString('hex');
            const vendorSlug = vendor_name.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
            const vendorId = await resolveVendor(supabase, vendor_name.trim());
            const firstLangCode = ((languages?.[0]?.code) || 'EN').toUpperCase();

            // For package plans, derive per-URL price from the package definition
            let perUrlPriceFromPackage = null;
            if (price_type === 'package' && package_id) {
                const { data: pkgRow } = await supabase
                    .from('backlink_packages')
                    .select('total_price, total_quantity')
                    .eq('id', package_id)
                    .single();
                if (pkgRow && pkgRow.total_quantity > 0 && pkgRow.total_price > 0) {
                    perUrlPriceFromPackage = pkgRow.total_price / pkgRow.total_quantity;
                }
            }

            // Create project (project_name mirrors campaign title for backward compat)
            const { data: proj, error: projErr } = await supabase
                .from('projects')
                .insert({
                    project_name: campaignTitle,
                    owner: personInCharge || '',
                    start_date,
                    deadline,
                    vendor_id: vendorId,
                    country: (country || 'GLOBAL').toUpperCase(),
                    language: firstLangCode,
                    total_quantity: totalQty,
                    remarks: remarks || null,
                    dripfeed_enabled: !!dripfeed_enabled,
                    dripfeed_period: dripfeed_enabled ? (dripfeed_period || null) : null,
                    urls_per_day: dripfeed_enabled ? (parseInt(urls_per_day) || null) : null,
                    url_entry_enabled: false,
                    price: price_type === 'per_url' ? 0 : (perUrlPriceFromPackage ?? parseFloat(price) ?? 0),
                    price_type: price_type || 'per_url',
                    package_id: (price_type === 'package' && package_id) ? package_id : null,
                    randomize_languages: !!randomize_languages,
                    status: 'Inprogress',
                    payment_status: 'pending',
                    created_date: new Date().toISOString(),
                    client_name: clientName
                })
                .select('id').single();

            if (projErr) throw new Error(`Project insert failed (plan: ${vendor_name}): ${projErr.message}`);
            const projectId = proj.id;

            const rollback = async () => {
                await supabase.from('project_languages').delete().eq('project_id', projectId);
                await supabase.from('project_targets').delete().eq('project_id', projectId);
                await supabase.from('projects').delete().eq('id', projectId);
            };

            // Insert languages
            if (languages?.length > 0) {
                const { error: langErr } = await supabase.from('project_languages').insert(
                    languages.map(l => ({
                        project_id: projectId,
                        lang_code: (l.code || '').toUpperCase(),
                        ratio: l.ratio
                    }))
                );
                if (langErr) { await rollback(); throw new Error(`Languages insert failed: ${langErr.message}`); }
            }

            // Insert targets — package plans use derived per-URL price; per_url plans use group_price
            const targetsToInsert = flattenedTargets.map(t => ({
                project_id: projectId,
                category: t.category || 'NULL',
                anchor_text: t.anchor_text,
                target_url: t.target_url,
                quantity_requested: parseInt(t.quantity, 10),
                sheet_name: t.sheet_name,
                price: perUrlPriceFromPackage != null ? perUrlPriceFromPackage : (t.group_price || 0)
            }));

            if (targetsToInsert.length > 0) {
                const { error: targetsErr } = await supabase.from('project_targets').insert(targetsToInsert);
                if (targetsErr) { await rollback(); throw new Error(`Targets insert failed: ${targetsErr.message}`); }
            }

            // Insert projects_hub
            const { error: hubErr } = await supabase.from('projects_hub').insert({
                project_id: projectId,
                hash: projectHash,
                targets: flattenedTargets,
                vendor_staging_data: null,
                is_locked: false
            });
            if (hubErr) { await rollback(); throw new Error(`Hub insert failed: ${hubErr.message}`); }

            // Insert project_plans (one per category group — non-fatal if fails)
            const planRows = (project_info_groups || []).map((g, idx) => ({
                campaign_id: campaign.id,
                project_id: projectId,
                step_order: idx,
                category: g.category || null,
                plan_info: g.sheet_name || null,
                vendor_id: vendorId,
                country: (country || 'GLOBAL').toUpperCase(),
                start_date,
                end_date: deadline,
                dripfeed_enabled: !!dripfeed_enabled,
                dripfeed_period: dripfeed_enabled ? String(dripfeed_period || '') : null,
                links_per_day: dripfeed_enabled ? (parseInt(urls_per_day) || null) : null,
                total_quantity: (g.placement_target || []).reduce((s, t) => s + (parseInt(t.ratio) || 0), 0)
            }));

            if (planRows.length > 0) {
                const { error: planErr } = await supabase.from('project_plans').insert(planRows);
                if (planErr) console.warn(`[Kickoff] project_plans insert warning: ${planErr.message}`);
            }

            results.push({ hash: projectHash, vendorSlug, vendorUuid: vendorId, planLabel: vendor_name.trim() });
        }

        if (results.length === 0) {
            return { success: false, message: 'No valid plans were processed.' };
        }

        // Auto-set finished_at on any packages that just became exhausted
        const usedPackageIds = [...new Set(plans.map(p => p.package_id).filter(Boolean))];
        if (usedPackageIds.length > 0) {
            await syncFinishedAtAction(usedPackageIds);
        }

        return {
            success: true,
            message: `Campaign kicked off with ${results.length} plan(s).`,
            campaignId: campaign.id,
            results
        };

    } catch (error) {
        console.error('Campaign kickoff error:', error);
        return { success: false, message: error.message };
    }
}
