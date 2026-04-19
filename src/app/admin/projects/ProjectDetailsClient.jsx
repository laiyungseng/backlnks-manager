'use client';

import { useState, useEffect, useRef, useTransition } from 'react';
import Link from 'next/link';
import { Trash2, CheckCircle2 } from 'lucide-react';
import CopyButton from './CopyButton';
import { deleteProject, approveProject, updateDashboardProjects } from '../actions';

export default function ProjectDetailsClient({ initialProjects }) {
    const [projects, setProjects] = useState(initialProjects || []);
    const [selectedTargets, setSelectedTargets] = useState(null);
    const [projectToDelete, setProjectToDelete] = useState(null);

    const [isCollapsed, setIsCollapsed] = useState({
        pending: true,
        active: false,
        completed: true
    });

    // Edit Mode State
    const [isEditMode, setIsEditMode] = useState(false);
    const [editedProjects, setEditedProjects] = useState([]);
    const [isSaving, setIsSaving] = useState(false);
    const [isPending, startTransition] = useTransition();

    // Track recently deleted projects so old SSE polls don't resurrect them
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
                    // Filter out any projects we just deleted locally to prevent flicker
                    const filteredData = data.filter(p => !deletedIdsRef.current.has(p.id));
                    setProjects(filteredData);
                }
            } catch {
                // Malformed event
            }
        });

        source.addEventListener('error', () => {
            console.warn('[Dashboard SSE] Connection error — will retry automatically.');
        });

        return () => {
            source.close();
        };
    }, []);

    const getSafeHostname = (urlString) => {
        if (!urlString) return 'Unknown';
        try {
            return new URL(urlString).hostname;
        } catch (e) {
            return urlString;
        }
    };

    const handleEnterEditMode = () => {
        // Deep copy the current projects array 
        const snap = JSON.parse(JSON.stringify(projects));
        setEditedProjects(snap);
        setIsEditMode(true);
    };

    const handleCancelEdit = () => {
        setIsEditMode(false);
        setEditedProjects([]);
    };

    const handleSaveEdits = async () => {
        setIsSaving(true);
        // Identify changes (optional: we just pass exactly what's currently in editedProjects)
        const res = await updateDashboardProjects(editedProjects);
        if (res.success) {
            setProjects([...editedProjects]); // Optimistic update
            setIsEditMode(false);
        } else {
            alert(`Failed to save edits: ${res.message}`);
        }
        setIsSaving(false);
    };

    const handleFieldChange = (projectId, field, value) => {
        setEditedProjects(prev => prev.map(p => {
            if (p.id === projectId) {
                return { ...p, [field]: value };
            }
            return p;
        }));
    };

    const handleCategoryChange = (projectId, oldCategory, newCategoryValue) => {
        setEditedProjects(prev => prev.map(p => {
            if (p.id === projectId) {
                const currentUpdates = p.categoryUpdates || {};
                return { 
                    ...p, 
                    categoryUpdates: {
                        ...currentUpdates,
                        [oldCategory]: newCategoryValue
                    }
                };
            }
            return p;
        }));
    };

    const handleApprove = (projectId) => {
        if (confirm("Approve this project? It will become active and available in Placements.")) {
            // Optimistic update
            const updateProj = p => {
                if (p.id === projectId) {
                    return { ...p, is_approved: true };
                }
                return p;
            };
            setProjects(prev => prev.map(updateProj));
            if (isEditMode) {
                setEditedProjects(prev => prev.map(updateProj));
            }
            startTransition(async () => {
                try {
                    const res = await approveProject(projectId);
                    if (!res.success) alert(res.message);
                } catch (err) {
                    console.error("Action error:", err);
                    alert("Action threw an error: " + err.message);
                }
            });
        }
    };

    const displayProjects = isEditMode ? editedProjects : projects;
    
    // Split projects into three groups
    const pendingProjects = displayProjects.filter(p => !p.is_approved);

    const activeProjects = displayProjects.filter(p => {
        if (!p.is_approved) return false;
        const hasPlacements = p.placements && p.placements.length > 0;
        const isFinalized = p.status === 'Finalized' || hasPlacements;
        return !isFinalized;
    });

    const completedProjects = displayProjects.filter(p => {
        if (!p.is_approved) return false;
        const hasPlacements = p.placements && p.placements.length > 0;
        const isFinalized = p.status === 'Finalized' || hasPlacements;
        return isFinalized;
    });

    const renderProjectTable = (title, data, isEdit = false, collapsed = false, onToggleCollapse = null) => (
        <div className="bg-white shadow-soft rounded-xl border border-slate-200 overflow-hidden w-full">
            <div 
                className={`px-6 py-5 border-b border-slate-100 bg-white flex items-center justify-between ${onToggleCollapse ? 'cursor-pointer hover:bg-slate-50' : ''}`}
                onClick={onToggleCollapse}
            >
                <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
                    {title}
                    {isEdit && <span className="text-indigo-600 text-[10px] font-black uppercase tracking-widest animate-pulse">(Edit Mode)</span>}
                </h3>
                <div className="flex items-center gap-3">
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">{data.length} Items</span>
                    {onToggleCollapse && (
                        <span className="text-slate-400 px-2 font-bold">{collapsed ? '▼' : '▲'}</span>
                    )}
                </div>
            </div>
            {!collapsed && (
            <div className="overflow-x-auto max-h-[640px] overflow-y-auto w-full border-t border-slate-100">
                <table className="min-w-full divide-y divide-slate-200 relative">
                    <thead className="bg-white sticky top-0 z-10 shadow-sm ring-1 ring-slate-100">
                        <tr>
                            <th className="px-6 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest bg-white">Project ID</th>
                            <th className="px-6 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest bg-white">Project Name</th>
                            <th className="px-6 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest bg-white">Category</th>
                            <th className="px-6 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest bg-white">Vendor</th>
                            <th className="px-6 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest bg-white">Progress</th>
                            <th className="px-6 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest bg-white">Price</th>
                            <th className="px-6 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest bg-white">Status</th>
                            <th className="px-6 py-4 text-center text-[10px] font-black text-slate-400 uppercase tracking-widest bg-white">Approve</th>
                            <th className="px-6 py-4 text-right text-[10px] font-black text-slate-400 uppercase tracking-widest bg-white">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-slate-100">
                        {data.length > 0 ? data.map((project) => {
                            const hub = project.projects_hub?.[0] || {};
                            const hubTargets = Array.isArray(hub.targets) ? hub.targets : [];
                            const totalLinks = hubTargets.length > 0 ? hubTargets.reduce((acc, t) => acc + (parseInt(t.quantity || '0', 10)), 0) : (project.total_quantity || 0);
                            const completedLinks = hub.completed_count ?? 0;
                            const progressPercent = totalLinks > 0 ? Math.round((completedLinks / totalLinks) * 100) : 0;

                            return (
                                <tr key={project.id} className="hover:bg-slate-50 transition-all duration-200 group h-16">
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="flex items-center gap-2">
                                            <span className="font-mono text-[12px] font-medium text-slate-500 bg-slate-50 px-2 py-0.5 rounded border border-slate-100" title={project.id}>
                                                {project.id.split('-')[0]}...
                                            </span>
                                            {!isEditMode && <CopyButton textToCopy={project.id} />}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-slate-800">
                                        {isEditMode ? <input type="text" value={project.project_name || ''} onChange={(e) => handleFieldChange(project.id, 'project_name', e.target.value)} className="w-40 px-3 py-1.5 border border-slate-200 focus:ring-2 focus:ring-indigo-500 rounded-md font-medium text-sm outline-none" /> : project.project_name}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        {(() => {
                                            const targets = Array.isArray(project.project_targets) ? project.project_targets : [];
                                            const uniqueCategories = [...new Set(targets.map(t => t.category).filter(c => c && c !== 'NULL'))];
                                            
                                            if (uniqueCategories.length === 0) {
                                                return isEditMode ? (
                                                    <input 
                                                        type="text" 
                                                        value={project.categoryUpdates?.['NULL'] !== undefined ? project.categoryUpdates['NULL'] : ''} 
                                                        onChange={(e) => handleCategoryChange(project.id, 'NULL', e.target.value)} 
                                                        className="w-24 px-2 py-1 border border-slate-200 focus:ring-2 focus:ring-indigo-500 rounded-md font-medium text-xs outline-none" 
                                                        placeholder="Add Category"
                                                    />
                                                ) : <span className="text-[10px] font-bold text-slate-400 italic">None</span>;
                                            }

                                            return (
                                                <div className="flex flex-col gap-1.5">
                                                    {uniqueCategories.map((cat, idx) => {
                                                        const currentEditVal = project.categoryUpdates?.[cat] !== undefined ? project.categoryUpdates[cat] : cat;
                                                        return isEditMode ? (
                                                            <input 
                                                                key={idx}
                                                                type="text" 
                                                                value={currentEditVal} 
                                                                onChange={(e) => handleCategoryChange(project.id, cat, e.target.value)} 
                                                                className="w-24 px-2 py-1 border border-slate-200 focus:ring-2 focus:ring-indigo-500 rounded-md font-medium text-xs outline-none" 
                                                                placeholder={cat}
                                                            />
                                                        ) : (
                                                            <span key={idx} className="px-2 py-0.5 text-[9px] font-black uppercase tracking-widest rounded bg-slate-100 text-slate-600 border border-slate-200 w-fit">
                                                                {cat}
                                                            </span>
                                                        );
                                                    })}
                                                </div>
                                            );
                                        })()}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-500">
                                        {project.vendors?.vendor_name || '—'}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="flex flex-col gap-1.5 w-32">
                                            <div className="flex justify-between items-center px-0.5">
                                                <span className="text-[10px] font-black text-slate-400 tracking-widest">{completedLinks}/{totalLinks}</span>
                                                <span className="text-[10px] font-black text-indigo-600 tracking-widest">{progressPercent}%</span>
                                            </div>
                                            <div className="w-full bg-slate-100 rounded-full h-1.5">
                                                <div className={`h-1.5 rounded-full transition-all duration-500 ${progressPercent === 100 ? 'bg-emerald-500' : 'bg-indigo-600'}`} style={{ width: `${progressPercent}%` }}></div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        {isEditMode ? (
                                            <div className="flex items-center gap-2">
                                                <span className="text-slate-400 text-xs">$</span>
                                                <input type="number" step="0.01" value={project.price ?? ''} onChange={(e) => handleFieldChange(project.id, 'price', e.target.value)} className="w-20 px-2 py-1.5 border border-slate-200 focus:ring-2 focus:ring-indigo-500 rounded-md text-sm outline-none" />
                                            </div>
                                        ) : (
                                            <div className="flex flex-col">
                                                <span className="text-sm font-black text-slate-800">${project.price ?? '0.00'}</span>
                                                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{project.price_type === 'package' ? 'Package' : 'URL'}</span>
                                            </div>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        {(() => {
                                            const isFinalized = project.status === 'Finalized' || (project.placements && project.placements.length > 0);
                                            let config = { bg: 'bg-indigo-50', text: 'text-indigo-600', label: 'In Progress' };
                                            if (isFinalized) config = { bg: 'bg-emerald-50', text: 'text-emerald-700', label: 'Finalized' };
                                            else if (project.status === 'Completed' || progressPercent === 100) config = { bg: 'bg-indigo-50', text: 'text-indigo-700', label: 'Completed' };
                                            else if (!project.is_approved) config = { bg: 'bg-amber-50', text: 'text-amber-700', label: 'Pending Approval' };

                                            return (
                                                <span className={`px-2.5 py-1 text-[10px] font-black uppercase tracking-widest rounded-md ${config.bg} ${config.text} border border-transparent`}>
                                                    {config.label}
                                                </span>
                                            );
                                        })()}
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
                                    <td className="px-6 py-4 whitespace-nowrap text-right">
                                        <button disabled={isEditMode} onClick={() => setProjectToDelete(project)} className="text-slate-800 hover:text-red-600 p-2 rounded-md hover:bg-red-50 transition-all disabled:hidden">
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </td>
                                </tr>
                            );
                        }) : (
                            <tr>
                                <td colSpan="8" className="px-6 py-12 text-center border-2 border-dashed border-slate-100 m-4 rounded-xl">
                                    <p className="text-[10px] font-black text-slate-300 uppercase tracking-[0.2em] italic">Archive entry empty / awaiting data feed</p>
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
            )}
        </div>
    );

    return (
        <div className="max-w-screen-2xl mx-auto space-y-12">
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
                                {isSaving ? 'Saving...' : 'Save Changes'}
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

            {/* Stats Overview */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {[
                    { label: 'Total Projects', value: projects.length, color: 'slate' },
                    { label: 'Completed', value: completedProjects.length, color: 'emerald' },
                    { label: 'Pending', value: activeProjects.length, color: 'indigo' }
                ].map((stat, i) => (
                    <div key={i} className="bg-white p-6 rounded-xl border border-slate-200 shadow-soft group hover:border-indigo-200 transition-colors">
                        <dt className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{stat.label}</dt>
                        <dd className={`text-4xl font-black text-slate-900 tracking-tighter`}>{stat.value}</dd>
                        <div className={`h-1 w-8 mt-4 rounded-full bg-${stat.color}-500/30 group-hover:w-16 transition-all duration-500`} />
                    </div>
                ))}
            </div>

            {/* Layout Grid */}
            <div className="flex flex-col gap-8 items-start w-full">
                {/* Pending Approval / Payment */}
                <div className="w-full flex flex-col gap-6">
                    {renderProjectTable("Pending Payment / Approval", pendingProjects, isEditMode, isCollapsed.pending, () => setIsCollapsed(prev => ({...prev, pending: !prev.pending})))}
                </div>

                {/* Active and Complete */}
                <div className="w-full flex flex-col gap-6">
                    {renderProjectTable("Active & In-Process", activeProjects, isEditMode, isCollapsed.active, () => setIsCollapsed(prev => ({...prev, active: !prev.active})))}
                    {renderProjectTable("Recently Completed & Finalized", completedProjects, false, isCollapsed.completed, () => setIsCollapsed(prev => ({...prev, completed: !prev.completed})))}
                </div>
            </div>

            {/* Target Modal with Indigo styling */}
            {selectedTargets && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-slate-900/40 backdrop-blur-md">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl overflow-hidden animate-in zoom-in duration-200">
                        <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between">
                            <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest">Target Inventory</h3>
                            <button onClick={() => setSelectedTargets(null)} className="text-slate-400 hover:text-slate-900 transition-colors p-2">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12"></path></svg>
                            </button>
                        </div>
                        <div className="px-8 py-6 overflow-y-auto max-h-[60vh] bg-slate-50/30">
                            <ul className="space-y-4">
                                {[...new Set(selectedTargets.map(t => t.target_url))].map((url, idx) => (
                                    <li key={idx} className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm flex items-center gap-4 group">
                                        <span className="text-[10px] font-black text-slate-300 tracking-widest">{String(idx + 1).padStart(2, '0')}</span>
                                        <a href={url} target="_blank" rel="noopener noreferrer" className="text-xs font-bold text-indigo-600 hover:text-indigo-900 flex-1 truncate">
                                            {url}
                                        </a>
                                    </li>
                                ))}
                            </ul>
                        </div>
                        <div className="bg-white px-8 py-4 border-t border-slate-100 flex justify-end">
                            <button onClick={() => setSelectedTargets(null)} className="px-6 py-2.5 text-[10px] font-black text-white bg-slate-900 rounded-lg hover:bg-slate-800 transition-all uppercase tracking-widest">
                                Close Window
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Delete Confirmation Modal */}
            {projectToDelete && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in duration-200 border border-slate-200">
                        <div className="p-6">
                            <h3 className="text-lg font-black text-slate-900 tracking-tight mb-2">Delete Project</h3>
                            <p className="text-sm text-slate-500 mb-6 font-medium">
                                Are you sure you want to delete <span className="font-bold text-slate-800">{projectToDelete.project_name}</span>? This action is permanent.
                            </p>
                            <div className="flex gap-3 justify-end">
                                <button onClick={() => setProjectToDelete(null)} className="px-4 py-2 text-xs font-bold text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-all uppercase tracking-widest">
                                    Cancel
                                </button>
                                <button onClick={() => {
                                    deletedIdsRef.current.add(projectToDelete.id);
                                    setProjects(prev => prev.filter(p => p.id !== projectToDelete.id));
                                    startTransition(async () => {
                                        await deleteProject(projectToDelete.id); 
                                    });
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

