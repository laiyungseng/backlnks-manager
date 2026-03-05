'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Trash2, CheckCircle2 } from 'lucide-react';
import CopyButton from './CopyButton';
import { deleteProject, approveProject, updateDashboardProjects } from './actions';

export default function DashboardClient({ initialProjects }) {
    const [projects, setProjects] = useState(initialProjects || []);
    const [selectedTargets, setSelectedTargets] = useState(null);

    // Edit Mode State
    const [isEditMode, setIsEditMode] = useState(false);
    const [editedProjects, setEditedProjects] = useState([]);
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        const source = new EventSource('/api/realtime/dashboard');

        source.addEventListener('projects', (e) => {
            try {
                const data = JSON.parse(e.data);
                if (Array.isArray(data)) setProjects(data);
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
                const newDetails = p.project_details ? [...p.project_details] : [{}];
                newDetails[0] = { ...newDetails[0], [field]: value };
                return { ...p, project_details: newDetails };
            }
            return p;
        }));
    };

    const handleApprove = async (projectId) => {
        if (confirm("Approve this project? It will become active and available in Placements.")) {
            // Optimistic update
            const updateProj = p => {
                if (p.id === projectId) {
                    const newDetails = p.project_details ? [...p.project_details] : [{}];
                    newDetails[0] = { ...newDetails[0], is_approved: true };
                    return { ...p, project_details: newDetails };
                }
                return p;
            };
            setProjects(prev => prev.map(updateProj));
            if (isEditMode) {
                setEditedProjects(prev => prev.map(updateProj));
            }
            const res = await approveProject(projectId);
            if (!res.success) alert(res.message);
        }
    };

    const displayProjects = isEditMode ? editedProjects : projects;

    return (
        <div className="max-w-6xl mx-auto space-y-8">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Dashboard Overview</h1>
                    <p className="mt-2 text-sm text-gray-500">
                        Monitor active SEO projects and track vendor backlink fulfillment real-time.
                    </p>
                </div>
                <div className="flex gap-3">
                    {isEditMode ? (
                        <>
                            <button
                                onClick={handleCancelEdit}
                                disabled={isSaving}
                                className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSaveEdits}
                                disabled={isSaving}
                                className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 transition-colors"
                            >
                                {isSaving ? 'Saving...' : 'Save Changes'}
                            </button>
                        </>
                    ) : (
                        <button
                            onClick={handleEnterEditMode}
                            className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors"
                        >
                            Edit Mode
                        </button>
                    )}
                    <Link
                        href="/admin/new-project"
                        className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors"
                    >
                        Kickoff New Project
                    </Link>
                </div>
            </div>

            {/* Dashboard Stats row text unchanged */}
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
                <div className="bg-white overflow-hidden shadow-sm rounded-lg border border-gray-100">
                    <div className="px-4 py-5 sm:p-6">
                        <dt className="text-sm font-medium text-gray-500 truncate">Total Kicked Off Projects</dt>
                        <dd className="mt-1 text-3xl font-semibold text-gray-900">{projects?.length || 0}</dd>
                    </div>
                </div>
                <div className="bg-white overflow-hidden shadow-sm rounded-lg border border-gray-100">
                    <div className="px-4 py-5 sm:p-6">
                        <dt className="text-sm font-medium text-green-600 truncate">Completed Projects</dt>
                        <dd className="mt-1 text-3xl font-semibold text-gray-900">
                            {projects?.filter(p => {
                                const hasPlacements = p.placements && p.placements.length > 0;
                                const details = p.project_details?.[0] || {};
                                return details.status === 'Completed' || details.status === 'Finalized' || hasPlacements;
                            }).length || 0}
                        </dd>
                    </div>
                </div>
                <div className="bg-white overflow-hidden shadow-sm rounded-lg border border-gray-100">
                    <div className="px-4 py-5 sm:p-6">
                        <dt className="text-sm font-medium text-indigo-600 truncate">Pending Projects</dt>
                        <dd className="mt-1 text-3xl font-semibold text-gray-900">
                            {projects?.filter(p => {
                                const hasPlacements = p.placements && p.placements.length > 0;
                                const details = p.project_details?.[0] || {};
                                return details.status !== 'Completed' && details.status !== 'Finalized' && !hasPlacements;
                            }).length || 0}
                        </dd>
                    </div>
                </div>
            </div>

            {/* Recent Projects Table */}
            <div className="bg-white shadow-sm rounded-lg border border-gray-200 overflow-hidden w-full overflow-x-auto">
                <div className="px-4 py-5 sm:px-6 border-b border-gray-200 bg-gray-50">
                    <h3 className="text-lg leading-6 font-medium text-gray-900">Recent Projects {isEditMode && <span className="ml-2 text-indigo-600 text-sm font-bold tracking-widest uppercase">(Edit Mode Active)</span>}</h3>
                </div>
                <div className="inline-block min-w-full align-middle">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-white">
                            <tr>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Project ID</th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Project Name</th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Vendor</th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Country</th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Target Domain</th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Category</th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Progress</th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Start/Deadline</th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Price Info</th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                                <th scope="col" className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Approve</th>
                                <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {displayProjects && displayProjects.length > 0 ? (
                                displayProjects.map((project) => {
                                    const hub = project.projects_hub?.[0] || {};
                                    const hubTargets = Array.isArray(hub.targets) ? hub.targets : [];
                                    const stagingData = Array.isArray(hub.vendor_staging_data) ? hub.vendor_staging_data : [];
                                    const details = project.project_details?.[0] || {};

                                    const totalLinks = hubTargets.length > 0
                                        ? hubTargets.reduce((acc, t) => acc + (parseInt(t.quantity || '0', 10)), 0)
                                        : parseInt(details.quantity || '0', 10);

                                    const completedLinks = stagingData.filter(p => p.published_url && p.published_url.trim().length > 0).length;
                                    const progressPercent = totalLinks > 0 ? Math.round((completedLinks / totalLinks) * 100) : 0;

                                    return (
                                        <tr key={project.id} className="hover:bg-gray-50 transition-colors">
                                            <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-500">
                                                <div className="flex items-center group">
                                                    <span title={project.id}>{project.id.split('-')[0]}...</span>
                                                    {!isEditMode && <CopyButton textToCopy={project.id} />}
                                                </div>
                                            </td>

                                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                                {isEditMode ? <input type="text" value={details.project_name || ''} onChange={(e) => handleFieldChange(project.id, 'project_name', e.target.value)} className="w-[140px] px-2 py-1 border border-indigo-300 focus:ring-1 focus:ring-indigo-500 rounded font-normal" /> : details.project_name}
                                            </td>

                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                {isEditMode ? <input type="text" value={details.vendor_name || ''} onChange={(e) => handleFieldChange(project.id, 'vendor_name', e.target.value)} className="w-24 px-2 py-1 border border-indigo-300 focus:ring-1 focus:ring-indigo-500 rounded font-normal" /> : details.vendor_name}
                                            </td>

                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 border-none font-mono">
                                                {isEditMode ? <input type="text" value={details.country || ''} onChange={(e) => handleFieldChange(project.id, 'country', e.target.value)} className="w-16 px-2 py-1 border border-indigo-300 focus:ring-1 focus:ring-indigo-500 rounded font-normal" maxLength={3} /> : details.country}
                                            </td>

                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                <div className="flex flex-col gap-2">
                                                    <div>
                                                        {hubTargets.length > 0 ? (
                                                            hubTargets.length === 1 ? (
                                                                <a href={hubTargets[0].target_url} target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:text-indigo-900 font-medium truncate max-w-[150px] inline-block align-bottom">
                                                                    {getSafeHostname(hubTargets[0].target_url)}
                                                                </a>
                                                            ) : (
                                                                <button
                                                                    onClick={() => setSelectedTargets(hubTargets)}
                                                                    disabled={isEditMode}
                                                                    className="text-indigo-600 font-medium bg-indigo-50 px-2 py-1 rounded-md text-xs hover:bg-indigo-100 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
                                                                >
                                                                    {hubTargets.length} Target URLs
                                                                </button>
                                                            )
                                                        ) : (
                                                            <span className="text-gray-400 italic">No Targets</span>
                                                        )}
                                                    </div>
                                                </div>
                                            </td>

                                            <td className="px-6 py-4 whitespace-nowrap">
                                                {isEditMode ? (
                                                    <select value={details.backlinks_category || 'NULL'} onChange={(e) => handleFieldChange(project.id, 'backlinks_category', e.target.value)} className="w-24 px-1 py-1 border border-indigo-300 bg-white rounded text-xs select-auto">
                                                        <option value="NULL">NULL</option>
                                                        <option value="PBN">PBN</option><option value="GP">GP</option>
                                                        <option value="Tier 2">Tier 2</option><option value="Tier 2 EDU">Tier 2 EDU</option>
                                                        <option value="Tier 2 GOV">Tier 2 GOV</option><option value="EDU GP">EDU GP</option>
                                                        <option value="GOV GP">GOV GP</option><option value="Web2.0">Web2.0</option>
                                                        <option value="Bookmark">Bookmark</option><option value="Forum">Forum</option>
                                                    </select>
                                                ) : (
                                                    details.backlinks_category ? <span className="px-2 py-0.5 rounded-full text-xs font-medium border bg-purple-50 text-purple-700 border-purple-200">{details.backlinks_category}</span> : <span className="text-gray-400 italic text-xs">-</span>
                                                )}
                                            </td>

                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="flex flex-col min-w-[80px]">
                                                    <span className="text-sm font-semibold text-gray-900">{completedLinks} / {totalLinks}</span>
                                                    <div className="w-full bg-gray-200 rounded-full h-1.5 mt-1">
                                                        <div className={`h-1.5 rounded-full ${progressPercent === 100 ? 'bg-green-500' : 'bg-indigo-600'}`} style={{ width: `${progressPercent}%` }}></div>
                                                    </div>
                                                </div>
                                            </td>

                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                {isEditMode ? (
                                                    <div className="flex flex-col gap-1">
                                                        <span className="text-xs font-bold text-gray-400">Start:</span>
                                                        <input type="date" value={details.start_date ? details.start_date.split('T')[0] : ''} onChange={(e) => handleFieldChange(project.id, 'start_date', e.target.value)} className="w-[124px] px-2 py-1 border border-indigo-300 rounded text-xs" />
                                                        <span className="text-xs font-bold text-gray-400 mt-1">End:</span>
                                                        <input type="date" value={details.deadline ? details.deadline.split('T')[0] : ''} onChange={(e) => handleFieldChange(project.id, 'deadline', e.target.value)} className="w-[124px] px-2 py-1 border border-indigo-300 rounded text-xs" />
                                                    </div>
                                                ) : (
                                                    <div className="flex flex-col gap-1 text-xs">
                                                        <span><span className="font-semibold text-gray-400">S:</span> {details.start_date ? new Date(details.start_date).toLocaleDateString() : '-'}</span>
                                                        <span><span className="font-semibold text-gray-400">E:</span> {details.deadline ? new Date(details.deadline).toLocaleDateString() : '-'}</span>
                                                    </div>
                                                )}
                                            </td>

                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                {isEditMode ? (
                                                    <div className="flex flex-col gap-2 min-w-[100px]">
                                                        <div className="flex items-center">
                                                            <span className="text-gray-500 mr-1 text-xs">$</span>
                                                            <input type="number" step="0.01" value={details.price ?? ''} onChange={(e) => handleFieldChange(project.id, 'price', e.target.value)} className="w-16 px-1.5 py-1 border border-indigo-300 rounded text-xs" />
                                                        </div>
                                                        <select value={details.price_type || 'per_url'} onChange={(e) => handleFieldChange(project.id, 'price_type', e.target.value)} className="w-[88px] px-1 py-1 border border-indigo-300 rounded text-[10px] bg-white">
                                                            <option value="per_url">Per URL</option>
                                                            <option value="package">Package</option>
                                                        </select>
                                                    </div>
                                                ) : (
                                                    <div className="flex flex-col bg-gray-50 p-1.5 rounded border border-gray-100 min-w-[90px]">
                                                        <span className="text-sm font-bold text-gray-900">${details.price || '0.00'}</span>
                                                        <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">
                                                            {details.price_type === 'package' ? 'Package' : 'Per URL'}
                                                        </span>
                                                    </div>
                                                )}
                                            </td>

                                            <td className="px-6 py-4 whitespace-nowrap">
                                                {(() => {
                                                    const hasPlacements = project.placements && project.placements.length > 0;
                                                    const isFinalized = details.status === 'Finalized' || hasPlacements;

                                                    let statusText = details.status || 'In Progress';
                                                    let badgeColor = 'bg-yellow-100 text-yellow-800';

                                                    if (isFinalized) {
                                                        statusText = 'Completed & Finalized';
                                                        badgeColor = 'bg-green-100 text-green-800';
                                                    } else if (details.status === 'Completed' || progressPercent === 100) {
                                                        statusText = 'Completed';
                                                        badgeColor = 'bg-green-100 text-green-800';
                                                    } else if (!details.is_approved) {
                                                        statusText = 'Inprocess-pending payment';
                                                        badgeColor = 'bg-amber-100 text-amber-800 border border-amber-200';
                                                    } else {
                                                        statusText = details.status || 'In Progress';
                                                        badgeColor = 'bg-indigo-100 text-indigo-800';
                                                    }

                                                    return (
                                                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${badgeColor}`}>
                                                            {statusText}
                                                        </span>
                                                    );
                                                })()}
                                            </td>

                                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                                <div className="flex space-x-2">
                                                    {details.is_approved ? (
                                                        <span className="inline-flex items-center justify-center text-green-600 px-2 py-1" title="Approved">
                                                            <CheckCircle2 className="w-5 h-5" />
                                                        </span>
                                                    ) : (
                                                        <button onClick={() => handleApprove(project.id)} className="text-white bg-green-600 hover:bg-green-700 px-3 py-1 rounded transition-colors shadow-sm font-bold">
                                                            Approve
                                                        </button>
                                                    )}
                                                </div>
                                            </td>

                                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                                <div className="flex items-center justify-end space-x-3">
                                                    <button
                                                        disabled={isEditMode}
                                                        onClick={async (e) => {
                                                            e.preventDefault();
                                                            if (confirm("Are you sure you want to delete this project?")) {
                                                                setProjects(prev => prev.filter(p => p.id !== project.id));
                                                                const res = await deleteProject(project.id);
                                                                if (!res.success) {
                                                                    alert(`Could not delete: ${res.message}`);
                                                                }
                                                            }
                                                        }}
                                                        className="text-red-500 hover:text-red-700 p-1.5 rounded-full hover:bg-red-50 transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                                                        title="Delete Project"
                                                    >
                                                        <Trash2 className="w-5 h-5" />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })
                            ) : (
                                <tr>
                                    <td colSpan="12" className="px-6 py-10 whitespace-nowrap text-sm text-gray-500 text-center flex-col items-center">
                                        <span className="block">No projects have been kicked off yet.</span>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Target URLs Modal */}
            {selectedTargets && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col max-h-[80vh]">
                        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                            <h3 className="text-lg font-bold text-gray-900">Target URLs</h3>
                            <button onClick={() => setSelectedTargets(null)} className="text-gray-400 hover:text-gray-600">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                            </button>
                        </div>
                        <div className="px-6 py-4 overflow-y-auto flex-1">
                            <ul className="divide-y divide-gray-100">
                                {[...new Set(selectedTargets.map(t => t.target_url))].map((url, idx) => (
                                    <li key={idx} className="py-3 flex items-center gap-3">
                                        <span className="text-xs font-mono text-gray-400">{idx + 1}.</span>
                                        <a href={url} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-indigo-600 hover:text-indigo-900 break-all">
                                            {url}
                                        </a>
                                    </li>
                                ))}
                            </ul>
                        </div>
                        <div className="bg-gray-50 px-6 py-3 border-t border-gray-100 flex justify-end">
                            <button
                                onClick={() => setSelectedTargets(null)}
                                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
}

