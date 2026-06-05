'use client';

import { Fragment, useEffect, useRef, useState, useTransition } from 'react';
import Link from 'next/link';
import {
    BadgeCheck,
    CheckCircle2,
    ChevronDown,
    ChevronRight,
    CircleDollarSign,
    FolderKanban,
    Plus,
    Search,
    Trash2,
    X,
} from 'lucide-react';
import CopyButton from './CopyButton';
import { deleteProject, approveProject, updateDashboardProjects, approvePaymentAction, markPaymentPendingAction, addPlanToCampaignAction } from '../actions';
import { getCategories } from '../catalog/categories/actions';

function getPlanRows(project) {
    return Array.isArray(project.project_plans)
        ? [...project.project_plans].sort((a, b) => (a.step_order ?? 0) - (b.step_order ?? 0))
        : [];
}

function getPrimaryPlan(project) {
    return getPlanRows(project)[0] || {};
}

function getCampaignKey(project) {
    const plan = getPrimaryPlan(project);
    return String(plan.campaign_id || plan.id || project.id || 'unknown');
}

function getCampaignLabel(project) {
    return getCampaignKey(project).toUpperCase();
}

function getProjectMetrics(project) {
    const hub = project.projects_hub?.[0] || {};
    const hubTargets = Array.isArray(hub.targets) ? hub.targets : [];
    const totalLinks = hubTargets.length > 0
        ? hubTargets.reduce((acc, t) => acc + parseInt(t.quantity || '0', 10), 0)
        : (project.total_quantity || 0);
    const completedLinks = hub.completed_count ?? 0;
    const progressPercent = totalLinks > 0 ? Math.round((completedLinks / totalLinks) * 100) : 0;
    return { totalLinks, completedLinks, progressPercent };
}

function getProjectCategories(project) {
    const targets = Array.isArray(project.project_targets) ? project.project_targets : [];
    return [...new Set(targets.map(t => t.category).filter(c => c && c !== 'NULL'))];
}

function getProjectCost(project) {
    const targets = Array.isArray(project.project_targets) ? project.project_targets : [];
    if (targets.length > 0 && targets.some(t => parseFloat(t.price) > 0)) {
        return targets.reduce((sum, t) => sum + (parseFloat(t.price) || 0) * (parseInt(t.quantity_requested) || 0), 0);
    }
    // Fallback for legacy projects: price × total_quantity
    return (parseFloat(project.price) || 0) * (parseInt(project.total_quantity) || 0);
}

function formatDate(value) {
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '-';
    return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatTitleWithDate(dateStr, title) {
    if (!dateStr) return title || 'Unnamed';
    const date = new Date(dateStr);
    if (Number.isNaN(date.getTime())) return title || 'Unnamed';
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    return `${yyyy}.${mm}.${dd}-${title || 'Unnamed'}`;
}

function genLocalId() {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
    return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function createTargetRow() {
    return { id: genLocalId(), anchor_text: '', target_url: '', ratio: 1 };
}

function createInfoGroup() {
    return {
        id: genLocalId(),
        sheet_name: '',
        category: 'NULL',
        placement_target: [createTargetRow()],
    };
}

function createLanguageRow() {
    return { id: genLocalId(), code: 'EN', ratio: 1 };
}

function createAddPlanForm() {
    const today = new Date().toISOString().substring(0, 10);
    return {
        vendor_name: '',
        country: 'GLOBAL',
        start_date: today,
        deadline: today,
        dripfeed_enabled: true,
        dripfeed_period: '',
        urls_per_day: '',
        price: 0,
        price_type: 'per_url',
        randomize_languages: false,
        remarks: '',
        activate_immediately: false,
        languages: [createLanguageRow()],
        project_info_groups: [createInfoGroup()],
    };
}

function calculateDeadlineFromPeriod(startDate, period) {
    if (!startDate || period === '') return null;
    const days = parseInt(period, 10);
    if (!Number.isFinite(days) || days < 0) return null;

    const start = new Date(`${startDate}T00:00:00`);
    if (Number.isNaN(start.getTime())) return null;

    start.setDate(start.getDate() + days);
    return start.toISOString().substring(0, 10);
}

function getProjectStatusConfig(project, progressPercent) {
    const isFinalized = project.status === 'Finalized' || (project.placements && project.placements.length > 0);
    if (isFinalized) return { bg: 'bg-emerald-50', text: 'text-emerald-700', label: 'Finalized' };
    if (project.status === 'Completed' || progressPercent === 100) return { bg: 'bg-indigo-50', text: 'text-indigo-700', label: 'Completed' };
    return { bg: 'bg-indigo-50', text: 'text-indigo-600', label: 'In Progress' };
}

function summarizeCampaign(projects) {
    const totals = projects.reduce((acc, project) => {
        const metrics = getProjectMetrics(project);
        acc.completed += metrics.completedLinks;
        acc.total += metrics.totalLinks;
        acc.price += getProjectCost(project);
        if (project.start_date) acc.starts.push(new Date(project.start_date).getTime());
        if (project.deadline) acc.ends.push(new Date(project.deadline).getTime());
        return acc;
    }, { completed: 0, total: 0, price: 0, starts: [], ends: [] });

    const vendors = [...new Set(projects.map(p => p.vendors?.vendor_name).filter(Boolean))];
    const categories = [...new Set(projects.flatMap(getProjectCategories))];
    const progressPercent = totals.total > 0 ? Math.round((totals.completed / totals.total) * 100) : 0;
    const earliestStart = totals.starts.length ? new Date(Math.min(...totals.starts)).toISOString() : null;
    const latestEnd = totals.ends.length ? new Date(Math.max(...totals.ends)).toISOString() : null;
    const finalizedCount = projects.filter(p => p.status === 'Finalized' || (p.placements && p.placements.length > 0)).length;
    const approvedCount = projects.filter(p => p.is_approved).length;

    let status;
    let statusClass;
    if (finalizedCount === projects.length && projects.length > 0) {
        status = 'Finalized';
        statusClass = 'bg-emerald-50 text-emerald-700';
    } else if (approvedCount === projects.length && projects.length > 0) {
        status = 'Running';
        statusClass = 'bg-emerald-50 text-emerald-700';
    } else {
        status = 'Pending Process';
        statusClass = 'bg-amber-50 text-amber-700';
    }

    return {
        vendors,
        categories,
        completedLinks: totals.completed,
        totalLinks: totals.total,
        progressPercent,
        totalPrice: totals.price,
        earliestStart,
        latestEnd,
        status,
        statusClass,
    };
}

function groupProjectsByCampaign(projects) {
    const map = new Map();
    projects.forEach(project => {
        const key = getCampaignKey(project);
        if (!map.has(key)) {
            const primaryPlan = getPrimaryPlan(project);
            const createdAt = primaryPlan.created_at || project.created_date;
            map.set(key, {
                key,
                campaignId: primaryPlan.campaign_id || null,
                label: getCampaignLabel(project),
                projectTitle: project.project_name || 'Unnamed Project',
                createdAt,
                displayTitle: formatTitleWithDate(createdAt, project.project_name || 'Unnamed Project'),
                projects: [],
            });
        }
        map.get(key).projects.push(project);
    });

    return [...map.values()]
        .map(group => ({
            ...group,
            projects: group.projects.sort((a, b) => {
                const as = a.start_date ? new Date(a.start_date).getTime() : Infinity;
                const bs = b.start_date ? new Date(b.start_date).getTime() : Infinity;
                if (as !== bs) return as - bs;
                return (getPrimaryPlan(a).step_order ?? 0) - (getPrimaryPlan(b).step_order ?? 0);
            }),
        }))
        .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
}

export default function ProjectDetailsClient({ initialProjects }) {
    const [projects, setProjects] = useState(initialProjects || []);
    const [selectedTargets, setSelectedTargets] = useState(null);
    const [projectToDelete, setProjectToDelete] = useState(null);
    const [activeTab, setActiveTab] = useState('active');
    const [search, setSearch] = useState('');
    // isCollapsed removed — sections now live in separate tabs
    const [isEditMode, setIsEditMode] = useState(false);
    const [editedProjects, setEditedProjects] = useState([]);
    const [dirtyProjectIds, setDirtyProjectIds] = useState(() => new Set());
    const [isSaving, setIsSaving] = useState(false);
    const [, startTransition] = useTransition();
    const [expandedCampaigns, setExpandedCampaigns] = useState({});
    const [addPlanCampaign, setAddPlanCampaign] = useState(null);
    const [addPlanForm, setAddPlanForm] = useState(createAddPlanForm);
    const [categories, setCategories] = useState([]);
    const [isAddingPlan, setIsAddingPlan] = useState(false);
    const deletedIdsRef = useRef(new Set());

    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'Escape') {
                setProjectToDelete(null);
                setSelectedTargets(null);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    useEffect(() => {
        const source = new EventSource('/api/realtime/dashboard');
        source.addEventListener('projects', (e) => {
            try {
                const data = JSON.parse(e.data);
                if (Array.isArray(data)) {
                    setProjects(data.filter(p => !deletedIdsRef.current.has(p.id)));
                }
            } catch { /* Malformed event */ }
        });
        source.addEventListener('error', () => {
            console.warn('[Dashboard SSE] Connection error - will retry automatically.');
        });
        return () => source.close();
    }, []);

    useEffect(() => {
        let cancelled = false;
        getCategories().then(result => {
            if (!cancelled && result?.success) setCategories(result.categories || []);
        });
        return () => { cancelled = true; };
    }, []);

    const handleEnterEditMode = () => {
        setEditedProjects(JSON.parse(JSON.stringify(projects)).map(p => ({
            ...p,
            vendorNameEdit: p.vendors?.vendor_name || '',
        })));
        setDirtyProjectIds(new Set());
        setIsEditMode(true);
    };

    const handleCancelEdit = () => {
        setIsEditMode(false);
        setEditedProjects([]);
        setDirtyProjectIds(new Set());
        setAddPlanCampaign(null);
    };

    const handleSaveEdits = async () => {
        if (dirtyProjectIds.size === 0) {
            setIsEditMode(false);
            setEditedProjects([]);
            return;
        }

        setIsSaving(true);
        const changedProjects = editedProjects.filter(project => dirtyProjectIds.has(project.id));
        const res = await updateDashboardProjects(changedProjects);
        if (res.success) {
            setProjects([...editedProjects]);
            setIsEditMode(false);
            setEditedProjects([]);
            setDirtyProjectIds(new Set());
        } else {
            alert(`Failed to save edits: ${res.message}`);
        }
        setIsSaving(false);
    };

    const handleFieldChange = (projectId, field, value) => {
        setEditedProjects(prev => prev.map(p =>
            p.id === projectId ? { ...p, [field]: value } : p
        ));
        setDirtyProjectIds(prev => new Set(prev).add(projectId));
    };

    const handleCategoryChange = (projectId, oldCategory, newCategoryValue) => {
        setEditedProjects(prev => prev.map(p => {
            if (p.id === projectId) {
                return { ...p, categoryUpdates: { ...(p.categoryUpdates || {}), [oldCategory]: newCategoryValue } };
            }
            return p;
        }));
        setDirtyProjectIds(prev => new Set(prev).add(projectId));
    };

    const handleApprove = (projectId) => {
        if (confirm('Approve this project? It will become active and available in Placements.')) {
            const buildUpdate = ids => p => ids.includes(p.id) ? { ...p, is_approved: true } : p;
            const optimisticUpdate = buildUpdate([projectId]);
            setProjects(prev => prev.map(optimisticUpdate));
            if (isEditMode) setEditedProjects(prev => prev.map(optimisticUpdate));
            startTransition(async () => {
                try {
                    const res = await approveProject(projectId);
                    if (!res.success) {
                        alert(res.message);
                    } else if (Array.isArray(res.approvedProjectIds)) {
                        const confirmedUpdate = buildUpdate(res.approvedProjectIds);
                        setProjects(prev => prev.map(confirmedUpdate));
                        if (isEditMode) setEditedProjects(prev => prev.map(confirmedUpdate));
                    }
                } catch (err) {
                    alert(`Action threw an error: ${err.message}`);
                }
            });
        }
    };

    const handleApprovePayment = (projectId) => {
        startTransition(async () => {
            const res = await approvePaymentAction(projectId);
            if (res.success) {
                const approvedIds = Array.isArray(res.approvedProjectIds) && res.approvedProjectIds.length > 0
                    ? res.approvedProjectIds
                    : [projectId];
                const updatePayment = p => approvedIds.includes(p.id)
                    ? {
                        ...p,
                        payment_status: 'approved',
                        ...(res.newStart ? { start_date: res.newStart } : {}),
                        ...(res.newDeadline ? { deadline: res.newDeadline } : {}),
                    }
                    : p;
                setProjects(prev => prev.map(updatePayment));
                if (isEditMode) setEditedProjects(prev => prev.map(updatePayment));
            } else {
                alert(`Failed to approve payment: ${res.message}`);
            }
        });
    };

    const handleMarkPaymentPending = (projectId) => {
        startTransition(async () => {
            const res = await markPaymentPendingAction(projectId);
            if (res.success) {
                setProjects(prev => prev.map(p => p.id === projectId ? { ...p, payment_status: 'pending' } : p));
                if (isEditMode) setEditedProjects(prev => prev.map(p => p.id === projectId ? { ...p, payment_status: 'pending' } : p));
            } else {
                alert(`Failed to mark pending: ${res.message}`);
            }
        });
    };

    const openAddPlanModal = (group) => {
        const summary = summarizeCampaign(group.projects);
        setAddPlanCampaign({ ...group, summary });
        setAddPlanForm(prev => ({
            ...createAddPlanForm(),
            country: group.projects[0]?.country || 'GLOBAL',
            start_date: summary.latestEnd ? new Date(summary.latestEnd).toISOString().substring(0, 10) : prev.start_date,
            deadline: summary.latestEnd ? new Date(summary.latestEnd).toISOString().substring(0, 10) : prev.deadline,
        }));
    };

    const closeAddPlanModal = () => {
        if (isAddingPlan) return;
        setAddPlanCampaign(null);
        setAddPlanForm(createAddPlanForm());
    };

    const updateAddPlanField = (field, value) => {
        setAddPlanForm(prev => {
            const next = { ...prev, [field]: value };
            if (field === 'start_date' || field === 'dripfeed_period') {
                const deadline = calculateDeadlineFromPeriod(next.start_date, next.dripfeed_period);
                if (deadline) next.deadline = deadline;
            }
            return next;
        });
    };

    const updateLanguage = (id, field, value) => {
        setAddPlanForm(prev => ({
            ...prev,
            languages: prev.languages.map(lang => lang.id === id ? { ...lang, [field]: value } : lang),
        }));
    };

    const addLanguage = () => {
        setAddPlanForm(prev => ({ ...prev, languages: [...prev.languages, createLanguageRow()] }));
    };

    const removeLanguage = (id) => {
        setAddPlanForm(prev => ({ ...prev, languages: prev.languages.filter(lang => lang.id !== id) }));
    };

    const updateGroup = (groupId, field, value) => {
        setAddPlanForm(prev => ({
            ...prev,
            project_info_groups: prev.project_info_groups.map(group => group.id === groupId ? { ...group, [field]: value } : group),
        }));
    };

    const addGroup = () => {
        setAddPlanForm(prev => ({ ...prev, project_info_groups: [...prev.project_info_groups, createInfoGroup()] }));
    };

    const removeGroup = (groupId) => {
        setAddPlanForm(prev => ({ ...prev, project_info_groups: prev.project_info_groups.filter(group => group.id !== groupId) }));
    };

    const updateTarget = (groupId, targetId, field, value) => {
        setAddPlanForm(prev => ({
            ...prev,
            project_info_groups: prev.project_info_groups.map(group => group.id === groupId
                ? {
                    ...group,
                    placement_target: group.placement_target.map(target => target.id === targetId ? { ...target, [field]: value } : target)
                }
                : group),
        }));
    };

    const addTarget = (groupId) => {
        setAddPlanForm(prev => ({
            ...prev,
            project_info_groups: prev.project_info_groups.map(group => group.id === groupId
                ? { ...group, placement_target: [...group.placement_target, createTargetRow()] }
                : group),
        }));
    };

    const removeTarget = (groupId, targetId) => {
        setAddPlanForm(prev => ({
            ...prev,
            project_info_groups: prev.project_info_groups.map(group => group.id === groupId
                ? { ...group, placement_target: group.placement_target.filter(target => target.id !== targetId) }
                : group),
        }));
    };

    const handleAddPlanSubmit = async (event) => {
        event.preventDefault();
        if (!addPlanCampaign?.campaignId) return;
        setIsAddingPlan(true);
        const result = await addPlanToCampaignAction(addPlanCampaign.campaignId, addPlanForm);
        if (result.success && result.project) {
            const nextProject = {
                ...result.project,
                vendorNameEdit: result.project.vendors?.vendor_name || '',
            };
            setProjects(prev => [nextProject, ...prev]);
            if (isEditMode) setEditedProjects(prev => [nextProject, ...prev]);
            setExpandedCampaigns(prev => ({ ...prev, [addPlanCampaign.key]: true }));
            if (!nextProject.is_approved) setActiveTab('pending');
            setAddPlanCampaign(null);
            setAddPlanForm(createAddPlanForm());
        } else {
            alert(`Failed to add plan: ${result.message}`);
        }
        setIsAddingPlan(false);
    };

    const displayProjects = isEditMode ? editedProjects : projects;
    const pendingProjects = displayProjects.filter(p => !p.is_approved);
    const activeProjects = displayProjects.filter(p => p.is_approved && p.status === 'Inprogress');
    const twoWeeksAgo = new Date();
    twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);
    const completedProjects = displayProjects.filter(p => {
        if (!p.is_approved) return false;
        const hasPlacements = p.placements && p.placements.length > 0;
        if (!(p.status === 'Finalized' || hasPlacements)) return false;
        const refDate = p.completed_date || p.created_date;
        return refDate && new Date(refDate) >= twoWeeksAgo;
    });

    const q = search.toLowerCase().trim();
    const projectMatchesSearch = (project) => {
        if (!q) return true;
        const categories = getProjectCategories(project);
        const plans = getPlanRows(project);
        return (
            (project.project_name || '').toLowerCase().includes(q) ||
            (project.id || '').toLowerCase().includes(q) ||
            (project.vendors?.vendor_name || '').toLowerCase().includes(q) ||
            categories.some(cat => cat.toLowerCase().includes(q)) ||
            plans.some(plan =>
                (plan.campaign_id || '').toLowerCase().includes(q) ||
                (plan.category || '').toLowerCase().includes(q)
            )
        );
    };
    const filterBySearch = list => q ? list.filter(projectMatchesSearch) : list;
    const filteredActive = filterBySearch(activeProjects);
    const filteredCompleted = filterBySearch(completedProjects);
    const filteredPending = filterBySearch(pendingProjects);

    const toggleCampaign = (key) => {
        setExpandedCampaigns(prev => ({ ...prev, [key]: !prev[key] }));
    };

    const renderCategoryCell = (project) => {
        const uniqueCategories = getProjectCategories(project);
        if (uniqueCategories.length === 0) {
            return isEditMode
                ? <input type="text" value={project.categoryUpdates?.['NULL'] !== undefined ? project.categoryUpdates['NULL'] : ''} onChange={(e) => handleCategoryChange(project.id, 'NULL', e.target.value)} className="w-24 px-2 py-1 border border-slate-200 focus:ring-2 focus:ring-indigo-500 rounded-md font-medium text-xs outline-none" placeholder="Add Category" />
                : <span className="text-[10px] font-bold text-slate-400 italic">None</span>;
        }
        return (
            <div className="flex flex-col gap-1.5">
                {uniqueCategories.map((cat, idx) => {
                    const currentEditVal = project.categoryUpdates?.[cat] !== undefined ? project.categoryUpdates[cat] : cat;
                    return isEditMode
                        ? <input key={idx} type="text" value={currentEditVal} onChange={(e) => handleCategoryChange(project.id, cat, e.target.value)} className="w-24 px-2 py-1 border border-slate-200 focus:ring-2 focus:ring-indigo-500 rounded-md font-medium text-xs outline-none" placeholder={cat} />
                        : <span key={idx} className="px-2 py-0.5 text-[9px] font-black uppercase tracking-widest rounded bg-slate-100 text-slate-600 border border-slate-200 w-fit">{cat}</span>;
                })}
            </div>
        );
    };

    const renderChildRow = (project, options) => {
        const { hideMarkPending, showApprovalIcon, hideProjectStatus, hidePaymentIcon, showPaymentApproveCol } = options;
        const { totalLinks, completedLinks, progressPercent } = getProjectMetrics(project);
        const plan = getPrimaryPlan(project);
        const stepLabel = plan.step_order !== undefined ? `Plan ${Number(plan.step_order) + 1}` : 'Plan';
        const statusConfig = getProjectStatusConfig(project, progressPercent);

        return (
            <tr key={project.id} className="bg-indigo-50/45 hover:bg-indigo-50 transition-all duration-200 group h-16 border-l-4 border-l-indigo-500 shadow-[inset_0_1px_0_rgba(99,102,241,0.14),inset_0_-1px_0_rgba(99,102,241,0.14)]">
                <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-3 pl-7 relative">
                        <span className="absolute left-0 top-1/2 h-10 w-px -translate-y-1/2 bg-indigo-200" />
                        <span className="h-px w-6 bg-indigo-200" />
                        <div className="flex flex-col gap-1">
                            <span className="text-[9px] font-black text-indigo-500 uppercase tracking-widest">Child Plan</span>
                            <span className="font-mono text-[12px] font-semibold text-indigo-700 bg-white px-2 py-0.5 rounded border border-indigo-100 shadow-sm" title={project.id}>
                                {project.id.split('-')[0]}...
                            </span>
                        </div>
                        {!isEditMode && <CopyButton textToCopy={project.id} />}
                    </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-slate-800">
                    <div className="flex flex-col gap-1">
                        <span className="text-[9px] font-black text-indigo-600 uppercase tracking-widest">{stepLabel}</span>
                        {isEditMode
                            ? <input type="text" value={project.project_name || ''} onChange={(e) => handleFieldChange(project.id, 'project_name', e.target.value)} className="w-40 px-3 py-1.5 border border-slate-200 focus:ring-2 focus:ring-indigo-500 rounded-md font-medium text-sm outline-none" />
                            : <span title={formatTitleWithDate(project.created_date, project.project_name)}>{formatTitleWithDate(project.created_date, project.project_name)}</span>}
                    </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">{renderCategoryCell(project)}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-500">
                    {isEditMode
                        ? <input type="text" value={project.vendorNameEdit ?? project.vendors?.vendor_name ?? ''} onChange={(e) => handleFieldChange(project.id, 'vendorNameEdit', e.target.value)} className="w-36 px-2 py-1.5 border border-slate-200 focus:ring-2 focus:ring-indigo-500 rounded-md text-sm outline-none" placeholder="Vendor name" />
                        : project.vendors?.vendor_name || '-'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex flex-col gap-1.5 w-32">
                        <div className="flex justify-between items-center px-0.5">
                            <span className="text-[10px] font-black text-slate-400 tracking-widest">{completedLinks}/{totalLinks}</span>
                            <span className="text-[10px] font-black text-indigo-600 tracking-widest">{progressPercent}%</span>
                        </div>
                        <div className="w-full bg-slate-200 rounded-full h-1.5">
                            <div className={`h-1.5 rounded-full transition-all duration-500 ${progressPercent === 100 ? 'bg-emerald-500' : 'bg-indigo-600'}`} style={{ width: `${progressPercent}%` }} />
                        </div>
                    </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                    {isEditMode ? (
                        <div className="flex items-center gap-2">
                            <span className="text-slate-400 text-xs">$</span>
                            <input type="number" step="0.01" value={project.price ?? ''} onChange={(e) => handleFieldChange(project.id, 'price', e.target.value)} className="w-20 px-2 py-1.5 border border-slate-200 focus:ring-2 focus:ring-indigo-500 rounded-md text-sm outline-none" />
                        </div>
                    ) : (() => {
                        const targets = Array.isArray(project.project_targets) ? project.project_targets : [];
                        const hasTargetPrices = targets.some(t => parseFloat(t.price) > 0);
                        const totalCost = getProjectCost(project);
                        if (hasTargetPrices) {
                            const byCategory = targets.reduce((acc, t) => {
                                const cat = t.category && t.category !== 'NULL' ? t.category : 'Uncategorized';
                                if (!acc[cat]) acc[cat] = 0;
                                acc[cat] += (parseFloat(t.price) || 0) * (parseInt(t.quantity_requested) || 0);
                                return acc;
                            }, {});
                            return (
                                <div className="flex flex-col gap-0.5">
                                    <span className="text-sm font-black text-slate-800">${totalCost.toFixed(2)}</span>
                                    {Object.entries(byCategory).map(([cat, cost]) => (
                                        <span key={cat} className="text-[9px] font-semibold text-slate-400">{cat}: ${cost.toFixed(2)}</span>
                                    ))}
                                </div>
                            );
                        }
                        return (
                            <div className="flex flex-col">
                                <span className="text-sm font-black text-slate-800">${getProjectCost(project).toFixed(2)}</span>
                                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{project.price_type === 'package' ? 'Package' : `@ $${parseFloat(project.price || 0).toFixed(2)}/URL`}</span>
                            </div>
                        );
                    })()}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                    {isEditMode ? (
                        <div className="flex flex-col gap-2">
                            <div className="flex flex-col gap-0.5">
                                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Start Date</span>
                                <input type="date" value={project.start_date ? project.start_date.substring(0, 10) : ''} onChange={e => handleFieldChange(project.id, 'start_date', e.target.value || null)} className="px-2 py-1 border border-slate-200 focus:ring-2 focus:ring-indigo-500 rounded-md text-xs outline-none w-36" />
                            </div>
                            <div className="flex flex-col gap-0.5">
                                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">End Date</span>
                                <input type="date" value={project.deadline ? project.deadline.substring(0, 10) : ''} onChange={e => handleFieldChange(project.id, 'deadline', e.target.value || null)} className="px-2 py-1 border border-slate-200 focus:ring-2 focus:ring-indigo-500 rounded-md text-xs outline-none w-36" />
                            </div>
                        </div>
                    ) : (
                        <div className="flex flex-col gap-0.5">
                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Start</span>
                            <span className="text-xs font-semibold text-slate-700 tabular-nums">{formatDate(project.start_date)}</span>
                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-1">End</span>
                            <span className="text-xs font-semibold text-slate-700 tabular-nums">{formatDate(project.deadline)}</span>
                        </div>
                    )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex flex-col gap-2 items-center">
                        {!hideProjectStatus && (
                            <span className={`px-2.5 py-1 text-[10px] font-black uppercase tracking-widest rounded-md ${statusConfig.bg} ${statusConfig.text} border border-transparent w-fit`}>
                                {statusConfig.label}
                            </span>
                        )}
                        {showApprovalIcon && (
                            <div className="relative group/approval">
                                <BadgeCheck className={`w-5 h-5 cursor-default ${project.is_approved ? 'text-emerald-500' : 'text-amber-400'}`} strokeWidth={2} />
                                <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2 py-1 text-[10px] font-bold bg-slate-900 text-white rounded whitespace-nowrap opacity-0 group-hover/approval:opacity-100 transition-opacity pointer-events-none z-20">
                                    {project.is_approved ? 'Project Approved' : 'Pending Approval'}
                                </span>
                            </div>
                        )}
                        {!hidePaymentIcon && project.payment_status && (
                            <div className="relative group/payment">
                                <CircleDollarSign className={`w-5 h-5 cursor-default ${project.payment_status === 'pending' ? 'text-amber-400' : 'text-emerald-500'}`} strokeWidth={2} />
                                <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2 py-1 text-[10px] font-bold bg-slate-900 text-white rounded whitespace-nowrap opacity-0 group-hover/payment:opacity-100 transition-opacity pointer-events-none z-20">
                                    {project.payment_status === 'pending' ? 'Payment Pending' : 'Payment Approved'}
                                </span>
                            </div>
                        )}
                    </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-center">
                    {project.is_approved ? (
                        <CheckCircle2 className="w-5 h-5 text-emerald-500 mx-auto" strokeWidth={2.5} />
                    ) : (
                        <button onClick={() => handleApprove(project.id)} className="bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-md shadow-sm transition-all focus:ring-2 focus:ring-indigo-500 focus:ring-offset-1">
                            Approve
                        </button>
                    )}
                </td>
                {showPaymentApproveCol && (
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                        {!isEditMode && project.payment_status === 'pending' ? (
                            <button onClick={() => handleApprovePayment(project.id)} className="px-3 py-1.5 text-[10px] font-black uppercase tracking-widest rounded-md bg-emerald-600 hover:bg-emerald-700 text-white transition-all shadow-sm" title="Approve payment - dates will shift to today">
                                Approve
                            </button>
                        ) : (
                            <span className="text-slate-300 text-xs font-bold">-</span>
                        )}
                    </td>
                )}
                <td className="px-6 py-4 whitespace-nowrap text-right">
                    <div className="flex items-center justify-end gap-1">
                        {!showPaymentApproveCol && !isEditMode && project.payment_status === 'pending' && (
                            <button onClick={() => handleApprovePayment(project.id)} className="px-2.5 py-1 text-[10px] font-black uppercase tracking-widest rounded-md bg-emerald-600 hover:bg-emerald-700 text-white transition-all" title="Approve payment - dates will shift to today">
                                Approve Payment
                            </button>
                        )}
                        {!isEditMode && !hideMarkPending && (!project.payment_status || project.payment_status === 'approved') && (
                            <button onClick={() => handleMarkPaymentPending(project.id)} className="px-2.5 py-1 text-[10px] font-black uppercase tracking-widest rounded-md bg-amber-100 hover:bg-amber-200 text-amber-800 transition-all" title="Mark project as pending payment">
                                Mark Pending
                            </button>
                        )}
                        <button disabled={isEditMode} onClick={() => setProjectToDelete(project)} className="text-slate-800 hover:text-red-600 p-2 rounded-md hover:bg-red-50 transition-all disabled:hidden">
                            <Trash2 className="w-4 h-4" />
                        </button>
                    </div>
                </td>
            </tr>
        );
    };

    const renderCampaignParentRow = (group, options) => {
        const summary = summarizeCampaign(group.projects);
        const isExpanded = q ? true : (expandedCampaigns[group.key] ?? options.defaultExpanded);

        return (
            <tr
                key={`${group.key}-parent`}
                onClick={() => toggleCampaign(group.key)}
                className="bg-white hover:bg-indigo-50/40 transition-colors border-t border-slate-200 cursor-pointer group"
                aria-expanded={isExpanded}
            >
                <td className="px-6 py-5 whitespace-nowrap">
                    <div className="flex items-center gap-3">
                        <span className="p-1.5 rounded-md text-slate-400 group-hover:text-indigo-600 group-hover:bg-indigo-50 transition-colors" title={isExpanded ? 'Collapse campaign' : 'Expand campaign'}>
                            {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                        </span>
                        <FolderKanban className="w-4 h-4 text-indigo-400" />
                        <div className="flex flex-col min-w-0">
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Campaign</span>
                            <span className="font-mono text-[11px] font-bold text-slate-600 max-w-[180px] truncate" title={group.label}>{group.label}</span>
                        </div>
                        {!isEditMode && <CopyButton textToCopy={group.label} />}
                    </div>
                </td>
                <td className="px-6 py-5 whitespace-nowrap">
                    <div className="flex flex-col">
                        <span className="text-sm font-black text-slate-900 truncate max-w-[220px]" title={group.displayTitle}>{group.displayTitle}</span>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{group.projects.length} {group.projects.length === 1 ? 'Plan' : 'Plans'}</span>
                    </div>
                </td>
                <td className="px-6 py-5 whitespace-nowrap">
                    <div className="flex flex-col gap-1">
                        <span className="text-xs font-black text-slate-700">{summary.totalLinks} URLs</span>
                        <span className="text-[10px] font-bold text-slate-400">{summary.categories.length || 'No'} categories</span>
                    </div>
                </td>
                <td className="px-6 py-5 whitespace-nowrap">
                    <div className="flex flex-col">
                        <span className="text-sm font-bold text-slate-700">{summary.vendors.length || 0} {summary.vendors.length === 1 ? 'Vendor' : 'Vendors'}</span>
                        <span className="text-[10px] font-semibold text-slate-400 max-w-[140px] truncate" title={summary.vendors.join(', ')}>{summary.vendors.join(', ') || '-'}</span>
                    </div>
                </td>
                <td className="px-6 py-5 whitespace-nowrap">
                    <div className="flex flex-col gap-1.5 w-36">
                        <div className="flex justify-between items-center px-0.5">
                            <span className="text-[10px] font-black text-slate-500 tracking-widest">{summary.completedLinks}/{summary.totalLinks}</span>
                            <span className="text-[10px] font-black text-indigo-600 tracking-widest">{summary.progressPercent}%</span>
                        </div>
                        <div className="w-full bg-slate-100 rounded-full h-1.5">
                            <div className={`h-1.5 rounded-full transition-all duration-500 ${summary.progressPercent === 100 ? 'bg-emerald-500' : 'bg-indigo-600'}`} style={{ width: `${summary.progressPercent}%` }} />
                        </div>
                    </div>
                </td>
                <td className="px-6 py-5 whitespace-nowrap">
                    <span className="text-sm font-black text-slate-800">${summary.totalPrice.toFixed(2)}</span>
                </td>
                <td className="px-6 py-5 whitespace-nowrap">
                    <div className="flex flex-col gap-0.5">
                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Start</span>
                        <span className="text-xs font-semibold text-slate-700 tabular-nums">{formatDate(summary.earliestStart)}</span>
                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-1">End</span>
                        <span className="text-xs font-semibold text-slate-700 tabular-nums">{formatDate(summary.latestEnd)}</span>
                    </div>
                </td>
                <td className="px-6 py-5 whitespace-nowrap">
                    <span className={`px-2.5 py-1 text-[10px] font-black uppercase tracking-widest rounded-md ${summary.statusClass} border border-transparent w-fit`}>
                        {summary.status}
                    </span>
                </td>
                <td className="px-6 py-5 whitespace-nowrap text-center">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{summary.vendors.length}/{group.projects.length}</span>
                </td>
                {options.showPaymentApproveCol && (
                    <td className="px-6 py-5 whitespace-nowrap text-center">
                        <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Child Rows</span>
                    </td>
                )}
                <td className="px-6 py-5 whitespace-nowrap text-right">
                    {isEditMode && group.campaignId ? (
                        <button
                            type="button"
                            onClick={(e) => {
                                e.stopPropagation();
                                openAddPlanModal(group);
                            }}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-indigo-600 text-white text-[10px] font-black uppercase tracking-widest hover:bg-indigo-700 transition-colors shadow-sm"
                        >
                            <Plus className="w-3.5 h-3.5" />
                            Add Plan
                        </button>
                    ) : (
                        <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">
                            {isExpanded ? 'Expanded' : 'Collapsed'}
                        </span>
                    )}
                </td>
            </tr>
        );
    };

    const renderProjectTable = (title, data, isEdit = false, collapsed = false, onToggleCollapse = null, hideMarkPending = false, showApprovalIcon = false, hideProjectStatus = false, hidePaymentIcon = false, showPaymentApproveCol = false) => {
        const campaignGroups = groupProjectsByCampaign(data);
        const defaultExpanded = false;
        const colSpan = showPaymentApproveCol ? 10 : 9;

        return (
            <div className="bg-white shadow-soft rounded-xl border border-slate-200 overflow-hidden w-full">
                <div className={`px-6 py-5 border-b border-slate-100 bg-white flex items-center justify-between ${onToggleCollapse ? 'cursor-pointer hover:bg-slate-50' : ''}`} onClick={onToggleCollapse}>
                    <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
                        {title}
                        {isEdit && <span className="text-indigo-600 text-[10px] font-black uppercase tracking-widest animate-pulse">(Edit Mode)</span>}
                    </h3>
                    <div className="flex items-center gap-3">
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">{campaignGroups.length} Campaigns / {data.length} Plans</span>
                        {onToggleCollapse && (
                            <span className="text-slate-400 px-2 font-bold">{collapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronDown className="w-4 h-4 rotate-180" />}</span>
                        )}
                    </div>
                </div>
                {!collapsed && (
                    <div className="overflow-x-auto max-h-[640px] overflow-y-auto w-full border-t border-slate-100">
                        <table className="min-w-full divide-y divide-slate-200 relative">
                            <thead className="bg-white sticky top-0 z-10 shadow-sm ring-1 ring-slate-100">
                                <tr>
                                    <th className="px-6 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest bg-white">Campaign / Project ID</th>
                                    <th className="px-6 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest bg-white">Project Name</th>
                                    <th className="px-6 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest bg-white">Plan Summary</th>
                                    <th className="px-6 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest bg-white">Vendor</th>
                                    <th className="px-6 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest bg-white">Progress</th>
                                    <th className="px-6 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest bg-white">Price</th>
                                    <th className="px-6 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest bg-white">Date Range</th>
                                    <th className="px-6 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest bg-white">Status</th>
                                    <th className="px-6 py-4 text-center text-[10px] font-black text-slate-400 uppercase tracking-widest bg-white">Approve</th>
                                    {showPaymentApproveCol && (
                                        <th className="px-6 py-4 text-center text-[10px] font-black text-slate-400 uppercase tracking-widest bg-white">Approve Payment</th>
                                    )}
                                    <th className="px-6 py-4 text-right text-[10px] font-black text-slate-400 uppercase tracking-widest bg-white">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-slate-100">
                                {campaignGroups.length > 0 ? campaignGroups.map(group => {
                                    const isExpanded = q ? true : (expandedCampaigns[group.key] ?? defaultExpanded);
                                    return (
                                        <Fragment key={group.key}>
                                            {renderCampaignParentRow(group, { showPaymentApproveCol, defaultExpanded })}
                                            {isExpanded && group.projects.map(project => renderChildRow(project, {
                                                hideMarkPending,
                                                showApprovalIcon,
                                                hideProjectStatus,
                                                hidePaymentIcon,
                                                showPaymentApproveCol,
                                            }))}
                                        </Fragment>
                                    );
                                }) : (
                                    <tr>
                                        <td colSpan={colSpan} className="px-6 py-12 text-center border-2 border-dashed border-slate-100 m-4 rounded-xl">
                                            <p className="text-[10px] font-black text-slate-300 uppercase tracking-[0.2em] italic">
                                                {q ? 'No matches for current search.' : 'Archive entry empty / awaiting data feed'}
                                            </p>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        );
    };

    const tabs = [
        { id: 'active', label: 'Active Placements', count: activeProjects.length },
        { id: 'pending', label: 'Pending Approval', count: pendingProjects.length },
        { id: 'completed', label: 'Completed & Finalized', count: completedProjects.length },
    ];

    return (
        <div className="max-w-screen-2xl mx-auto space-y-10">
            <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6">
                <div>
                    <h1 className="text-4xl font-black text-slate-900 tracking-tight uppercase">Project Details</h1>
                    <p className="mt-2 text-sm font-medium text-slate-500">
                        Monitor active SEO projects and track vendor backlink fulfillment real-time.
                    </p>
                </div>
                <div className="flex gap-3">
                    {isEditMode ? (
                        <>
                            <button onClick={handleCancelEdit} disabled={isSaving} className="px-5 py-2.5 text-xs font-bold text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-all uppercase tracking-widest">
                                Cancel
                            </button>
                            <button onClick={handleSaveEdits} disabled={isSaving} className="px-5 py-2.5 text-xs font-black text-white bg-emerald-500 rounded-lg hover:bg-emerald-600 transition-all shadow-lg shadow-emerald-500/20 uppercase tracking-widest">
                                {isSaving ? 'Saving...' : dirtyProjectIds.size > 0 ? `Save ${dirtyProjectIds.size} Change${dirtyProjectIds.size === 1 ? '' : 's'}` : 'Done'}
                            </button>
                        </>
                    ) : (
                        <button onClick={handleEnterEditMode} className="px-5 py-2.5 text-xs font-bold text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-all uppercase tracking-widest">
                            Edit Mode
                        </button>
                    )}
                    <Link href="/admin/new-project" className="px-5 py-2.5 text-xs font-black text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-500/20 uppercase tracking-widest">
                        Kickoff New Project
                    </Link>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                {[
                    { label: 'Total Projects', value: projects.length, color: 'bg-slate-500/30' },
                    { label: 'Active', value: activeProjects.length, color: 'bg-indigo-500/30' },
                    { label: 'Pending Approval', value: pendingProjects.length, color: 'bg-amber-500/30' },
                    { label: 'Completed', value: completedProjects.length, color: 'bg-emerald-500/30' },
                ].map((stat, i) => (
                    <div key={i} className="bg-white p-6 rounded-xl border border-slate-200 shadow-soft group hover:border-indigo-200 transition-colors">
                        <dt className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{stat.label}</dt>
                        <dd className="text-4xl font-black text-slate-900 tracking-tighter">{stat.value}</dd>
                        <div className={`h-1 w-8 mt-4 rounded-full ${stat.color} group-hover:w-16 transition-all duration-500`} />
                    </div>
                ))}
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-0">
                <div className="flex gap-1">
                    {tabs.map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => { setActiveTab(tab.id); setSearch(''); }}
                            className={`px-4 py-2.5 text-xs font-black uppercase tracking-widest rounded-t-lg border-b-2 transition-all ${activeTab === tab.id
                                ? 'border-indigo-600 text-indigo-600 bg-indigo-50/60'
                                : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50'
                            }`}
                        >
                            {tab.label}
                            <span className={`ml-2 px-1.5 py-0.5 rounded text-[9px] font-black ${activeTab === tab.id ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-500'}`}>
                                {tab.count}
                            </span>
                        </button>
                    ))}
                </div>
                <div className="relative mb-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                    <input
                        type="text"
                        placeholder="Filter by project, vendor, category, or campaign..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        className="pl-9 pr-8 py-2 text-xs border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400 w-80"
                    />
                    {search && (
                        <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700">
                            <X className="w-3.5 h-3.5" />
                        </button>
                    )}
                </div>
            </div>

            {activeTab === 'active' && renderProjectTable('Active Placements', filteredActive, isEditMode, false, null, false, false, false, true)}

            {activeTab === 'pending' && renderProjectTable(
                'Pending Payment / Approval',
                filteredPending,
                isEditMode,
                false,
                null,
                false,
                true,
                true,
                false,
                true
            )}

            {activeTab === 'completed' && renderProjectTable(
                'Recently Completed & Finalized',
                filteredCompleted,
                false,
                false,
                null,
                true
            )}

            {addPlanCampaign && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-slate-900/40 backdrop-blur-md">
                    <form onSubmit={handleAddPlanSubmit} className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl overflow-hidden animate-in zoom-in duration-200">
                        <div className="px-8 py-5 border-b border-slate-100 flex items-center justify-between">
                            <div>
                                <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest">Add Plan</h3>
                                <p className="text-xs font-semibold text-slate-400 mt-1">{addPlanCampaign.displayTitle}</p>
                            </div>
                            <button type="button" onClick={closeAddPlanModal} className="text-slate-400 hover:text-slate-900 transition-colors p-2">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="px-8 py-6 overflow-y-auto max-h-[72vh] bg-slate-50/40 space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                <label className="flex flex-col gap-1.5">
                                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Vendor</span>
                                    <input required value={addPlanForm.vendor_name} onChange={e => updateAddPlanField('vendor_name', e.target.value)} className="px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500 bg-white" />
                                </label>
                                <label className="flex flex-col gap-1.5">
                                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Country</span>
                                    <input value={addPlanForm.country} onChange={e => updateAddPlanField('country', e.target.value)} className="px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500 bg-white" />
                                </label>
                                <label className="flex flex-col gap-1.5">
                                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Start</span>
                                    <input type="date" required value={addPlanForm.start_date} onChange={e => updateAddPlanField('start_date', e.target.value)} className="px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500 bg-white" />
                                </label>
                                <label className="flex flex-col gap-1.5">
                                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Deadline</span>
                                    <input type="date" required value={addPlanForm.deadline} onChange={e => updateAddPlanField('deadline', e.target.value)} className="px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500 bg-white" />
                                </label>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                                <label className="flex items-center gap-3 bg-white border border-slate-200 rounded-lg px-3 py-2">
                                    <input type="checkbox" checked={addPlanForm.dripfeed_enabled} onChange={e => updateAddPlanField('dripfeed_enabled', e.target.checked)} className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />
                                    <span className="text-xs font-black uppercase tracking-widest text-slate-600">Dripfeed</span>
                                </label>
                                <label className="flex flex-col gap-1.5">
                                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Period</span>
                                    <input type="number" min="0" value={addPlanForm.dripfeed_period} onChange={e => updateAddPlanField('dripfeed_period', e.target.value)} className="px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500 bg-white" />
                                </label>
                                <label className="flex flex-col gap-1.5">
                                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">URLs / Day</span>
                                    <input type="number" min="0" value={addPlanForm.urls_per_day} onChange={e => updateAddPlanField('urls_per_day', e.target.value)} className="px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500 bg-white" />
                                </label>
                                <label className="flex flex-col gap-1.5">
                                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Price</span>
                                    <input type="number" min="0" step="0.01" value={addPlanForm.price} onChange={e => updateAddPlanField('price', e.target.value)} className="px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500 bg-white" />
                                </label>
                                <label className="flex flex-col gap-1.5">
                                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Price Type</span>
                                    <select value={addPlanForm.price_type} onChange={e => updateAddPlanField('price_type', e.target.value)} className="px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500 bg-white">
                                        <option value="per_url">Per URL</option>
                                        <option value="package">Package</option>
                                    </select>
                                </label>
                            </div>

                            <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
                                <div className="flex items-center justify-between">
                                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Languages</span>
                                    <button type="button" onClick={addLanguage} className="text-[10px] font-black uppercase tracking-widest text-indigo-600 hover:text-indigo-800">Add Language</button>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    {addPlanForm.languages.map(lang => (
                                        <div key={lang.id} className="flex items-center gap-2">
                                            <input value={lang.code} onChange={e => updateLanguage(lang.id, 'code', e.target.value)} className="w-24 px-3 py-2 border border-slate-200 rounded-lg text-sm uppercase outline-none focus:ring-2 focus:ring-indigo-500" placeholder="EN" />
                                            <input type="number" min="0" value={lang.ratio} onChange={e => updateLanguage(lang.id, 'ratio', e.target.value)} className="w-24 px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500" />
                                            {addPlanForm.languages.length > 1 && (
                                                <button type="button" onClick={() => removeLanguage(lang.id)} className="p-2 text-slate-400 hover:text-red-600">
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Target Groups</span>
                                    <button type="button" onClick={addGroup} className="text-[10px] font-black uppercase tracking-widest text-indigo-600 hover:text-indigo-800">Add Group</button>
                                </div>
                                {addPlanForm.project_info_groups.map(group => (
                                    <div key={group.id} className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
                                        <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr_auto] gap-3">
                                            <input value={group.sheet_name} onChange={e => updateGroup(group.id, 'sheet_name', e.target.value)} className="px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500" placeholder="Sheet name" />
                                            <select value={group.category} onChange={e => updateGroup(group.id, 'category', e.target.value)} className="px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500 bg-white" aria-label="Category">
                                                {categories.length === 0 ? (
                                                    <option value={group.category}>{group.category || 'Loading categories...'}</option>
                                                ) : (
                                                    categories.map(category => (
                                                        <option key={category.id} value={category.name}>{category.name}</option>
                                                    ))
                                                )}
                                            </select>
                                            {addPlanForm.project_info_groups.length > 1 && (
                                                <button type="button" onClick={() => removeGroup(group.id)} className="px-3 py-2 text-xs font-bold text-red-600 bg-red-50 rounded-lg">Remove</button>
                                            )}
                                        </div>
                                        <div className="space-y-2">
                                            <div className="hidden md:grid grid-cols-[1.2fr_1.4fr_90px_auto] gap-2 px-1">
                                                <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Anchor Text</span>
                                                <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Target URL</span>
                                                <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Quantity</span>
                                                <span />
                                            </div>
                                            {group.placement_target.map(target => (
                                                <div key={target.id} className="grid grid-cols-1 md:grid-cols-[1.2fr_1.4fr_90px_auto] gap-2">
                                                    <input required value={target.anchor_text} onChange={e => updateTarget(group.id, target.id, 'anchor_text', e.target.value)} className="px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500" placeholder="Anchor text" aria-label="Anchor text" />
                                                    <input required value={target.target_url} onChange={e => updateTarget(group.id, target.id, 'target_url', e.target.value)} className="px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500" placeholder="Target URL" aria-label="Target URL" />
                                                    <input required type="number" min="1" value={target.ratio} onChange={e => updateTarget(group.id, target.id, 'ratio', e.target.value)} className="px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500" placeholder="Qty" aria-label="Quantity" title="Quantity" />
                                                    {group.placement_target.length > 1 && (
                                                        <button type="button" onClick={() => removeTarget(group.id, target.id)} className="p-2 text-slate-400 hover:text-red-600">
                                                            <Trash2 className="w-4 h-4" />
                                                        </button>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                        <button type="button" onClick={() => addTarget(group.id)} className="text-[10px] font-black uppercase tracking-widest text-indigo-600 hover:text-indigo-800">Add Target</button>
                                    </div>
                                ))}
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <label className="flex items-center gap-3 bg-white border border-slate-200 rounded-lg px-3 py-3">
                                    <input type="checkbox" checked={addPlanForm.randomize_languages} onChange={e => updateAddPlanField('randomize_languages', e.target.checked)} className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />
                                    <span className="text-xs font-black uppercase tracking-widest text-slate-600">Randomize Languages</span>
                                </label>
                                <label className="flex items-center gap-3 bg-white border border-slate-200 rounded-lg px-3 py-3">
                                    <input type="checkbox" checked={addPlanForm.activate_immediately} onChange={e => updateAddPlanField('activate_immediately', e.target.checked)} className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500" />
                                    <span className="text-xs font-black uppercase tracking-widest text-slate-600">Activate Immediately</span>
                                </label>
                            </div>

                            <textarea value={addPlanForm.remarks} onChange={e => updateAddPlanField('remarks', e.target.value)} className="w-full min-h-20 px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500 bg-white" placeholder="Remarks" />
                        </div>

                        <div className="bg-white px-8 py-4 border-t border-slate-100 flex justify-end gap-3">
                            <button type="button" onClick={closeAddPlanModal} disabled={isAddingPlan} className="px-5 py-2.5 text-xs font-bold text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-all uppercase tracking-widest disabled:opacity-50">Cancel</button>
                            <button type="submit" disabled={isAddingPlan} className="px-5 py-2.5 text-xs font-black text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-500/20 uppercase tracking-widest disabled:opacity-50">
                                {isAddingPlan ? 'Adding...' : addPlanForm.activate_immediately ? 'Add & Activate' : 'Add Pending Plan'}
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {selectedTargets && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-slate-900/40 backdrop-blur-md">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl overflow-hidden animate-in zoom-in duration-200">
                        <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between">
                            <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest">Target Inventory</h3>
                            <button onClick={() => setSelectedTargets(null)} className="text-slate-400 hover:text-slate-900 transition-colors p-2">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="px-8 py-6 overflow-y-auto max-h-[60vh] bg-slate-50/30">
                            <ul className="space-y-4">
                                {[...new Set(selectedTargets.map(t => t.target_url))].map((url, idx) => (
                                    <li key={idx} className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm flex items-center gap-4 group">
                                        <span className="text-[10px] font-black text-slate-300 tracking-widest">{String(idx + 1).padStart(2, '0')}</span>
                                        <a href={url} target="_blank" rel="noopener noreferrer" className="text-xs font-bold text-indigo-600 hover:text-indigo-900 flex-1 truncate">{url}</a>
                                    </li>
                                ))}
                            </ul>
                        </div>
                        <div className="bg-white px-8 py-4 border-t border-slate-100 flex justify-end">
                            <button onClick={() => setSelectedTargets(null)} className="px-6 py-2.5 text-[10px] font-black text-white bg-slate-900 rounded-lg hover:bg-slate-800 transition-all uppercase tracking-widest">Close Window</button>
                        </div>
                    </div>
                </div>
            )}

            {projectToDelete && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in duration-200 border border-slate-200">
                        <div className="p-6">
                            <h3 className="text-lg font-black text-slate-900 tracking-tight mb-2">Delete Project</h3>
                            <p className="text-sm text-slate-500 mb-6 font-medium">
                                Are you sure you want to delete <span className="font-bold text-slate-800">{projectToDelete.project_name}</span>? This action is permanent.
                            </p>
                            <div className="flex gap-3 justify-end">
                                <button onClick={() => setProjectToDelete(null)} className="px-4 py-2 text-xs font-bold text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-all uppercase tracking-widest">Cancel</button>
                                <button onClick={() => {
                                    deletedIdsRef.current.add(projectToDelete.id);
                                    setProjects(prev => prev.filter(p => p.id !== projectToDelete.id));
                                    startTransition(async () => { await deleteProject(projectToDelete.id); });
                                    setProjectToDelete(null);
                                }} className="px-4 py-2 text-xs font-black text-white bg-red-500 rounded-lg hover:bg-red-600 transition-all shadow-lg shadow-red-500/20 uppercase tracking-widest">
                                    Confirm
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
