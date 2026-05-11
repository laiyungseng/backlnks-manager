export function getProgress(project) {
    const hub = project.projects_hub?.[0] || {};
    const stagingData = Array.isArray(hub.vendor_staging_data) ? hub.vendor_staging_data : [];
    const hubTargets = Array.isArray(hub.targets) ? hub.targets : [];
    const completed = stagingData.filter(s => s.published_url && s.published_url.trim().length > 0).length;
    const indexedCount = stagingData.filter(s => s.indexed_status && s.indexed_status.trim().length > 0).length;
    const total = hubTargets.length > 0
        ? hubTargets.reduce((acc, t) => acc + (parseInt(t.quantity || '0', 10)), 0)
        : (project.total_quantity || 0);
    return { completed, indexedCount, total, percent: total > 0 ? Math.round((completed / total) * 100) : 0 };
}

export function formatTitleWithDate(dateStr, title) {
    if (!dateStr) return title || 'Unnamed';
    const d = new Date(dateStr);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}.${mm}.${dd}-${title || 'Unnamed'}`;
}

export function formatCompact(dateStr) {
    if (!dateStr) return '—';
    const d = new Date(dateStr);
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${m}.${day}`;
}

export function groupByCampaign(projects) {
    const groups = new Map();
    const orphans = [];
    for (const p of projects) {
        const link = (p.project_plans || [])[0];
        const campaignId = link?.campaign_id || null;
        const campaignTitle = link?.project_campaigns?.title || p.project_name || 'Unnamed';
        if (!campaignId) {
            orphans.push(p);
            continue;
        }
        if (!groups.has(campaignId)) {
            groups.set(campaignId, { campaignId, title: campaignTitle, plans: [] });
        }
        groups.get(campaignId).plans.push(p);
    }
    return { groups: Array.from(groups.values()), orphans };
}

export function aggregateGroup(group) {
    const plans = group.plans;
    let completed = 0, total = 0, indexedCount = 0;
    let earliestCreated = Infinity;
    let earliestStart = Infinity, latestDeadline = -Infinity;
    let anyPriority = false;
    const categories = new Set();

    for (const p of plans) {
        const prog = getProgress(p);
        completed += prog.completed;
        total += prog.total;
        indexedCount += prog.indexedCount;
        if (p.created_date) earliestCreated = Math.min(earliestCreated, new Date(p.created_date).getTime());
        if (p.start_date) earliestStart = Math.min(earliestStart, new Date(p.start_date).getTime());
        if (p.deadline) latestDeadline = Math.max(latestDeadline, new Date(p.deadline).getTime());
        if (p.is_priority) anyPriority = true;
        const cat = p.project_targets?.[0]?.category;
        if (cat) categories.add(cat);
    }

    const earliestDeadline = plans
        .map(p => p.deadline ? new Date(p.deadline).getTime() : Infinity)
        .reduce((a, b) => Math.min(a, b), Infinity);

    const snapPlan = plans.find(p => {
        const { completed: c, total: t } = getProgress(p);
        return t > 0 && c > 0 && c < t;
    }) || plans.find(p => {
        const { completed: c } = getProgress(p);
        return c === 0;
    }) || plans.find(p => {
        const { completed: c, total: t } = getProgress(p);
        return t > 0 && c >= t;
    }) || plans[0];

    const snapHash = snapPlan?.projects_hub?.[0]?.hash || null;

    return {
        ...group,
        plans,
        completed,
        total,
        indexedCount,
        percent: total > 0 ? Math.round((completed / total) * 100) : 0,
        earliestCreated: earliestCreated === Infinity ? null : new Date(earliestCreated).toISOString(),
        earliestStart: earliestStart === Infinity ? null : new Date(earliestStart).toISOString(),
        earliestDeadline: earliestDeadline === Infinity ? null : new Date(earliestDeadline).toISOString(),
        latestDeadline: latestDeadline === -Infinity ? null : new Date(latestDeadline).toISOString(),
        anyPriority,
        categories: Array.from(categories),
        snapHash,
    };
}

export function buildCampaignGroups(projects) {
    const { groups, orphans } = groupByCampaign(projects);
    const aggGroups = groups.map(aggregateGroup);
    const orphanRows = orphans.map(p => aggregateGroup({
        campaignId: null,
        title: p.project_name || 'Unnamed',
        plans: [p],
    }));
    return [...aggGroups, ...orphanRows];
}
