'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Trash2 } from 'lucide-react';
import CopyButton from './CopyButton';
import { supabase } from '@/lib/supabase';
import { deleteProject } from './actions';

export default function DashboardClient({ initialProjects }) {
    const [projects, setProjects] = useState(initialProjects || []);

    useEffect(() => {
        // Setup Realtime subscription on the project_list table
        const channel = supabase.channel('dashboard-project-list-changes')
            .on(
                'postgres_changes',
                { event: 'UPDATE', schema: 'public', table: 'project_list' },
                (payload) => {
                    console.log('Realtime Update Received (project_list):', payload);

                    // We need to update the specific project's vendor_staging_data in our local state
                    setProjects(currentProjects => {
                        return currentProjects.map(project => {
                            // Find the project that owns this project_list row
                            if (project.project_list && project.project_list[0] && project.project_list[0].hash === payload.new.hash) {
                                return {
                                    ...project,
                                    project_list: [{
                                        ...project.project_list[0],
                                        vendor_staging_data: payload.new.vendor_staging_data
                                    }]
                                };
                            }
                            return project;
                        });
                    });
                }
            )
            .subscribe();

        // Cleanup subscription on unmount
        return () => {
            supabase.removeChannel(channel);
        };
    }, []);

    // Helper for safe URL parsing
    const getSafeHostname = (urlString) => {
        if (!urlString) return 'Unknown';
        try {
            return new URL(urlString).hostname;
        } catch (e) {
            return urlString;
        }
    };

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
                    <Link
                        href="/admin/new-project"
                        className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors"
                    >
                        Kickoff New Project
                    </Link>
                </div>
            </div>

            {/* Dashboard Stats row */}
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
                                return p.status === 'Completed' || p.status === 'Finalized' || hasPlacements;
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
                                return p.status !== 'Completed' && p.status !== 'Finalized' && !hasPlacements;
                            }).length || 0}
                        </dd>
                    </div>
                </div>
            </div>

            {/* Recent Projects Table */}
            <div className="bg-white shadow-sm rounded-lg border border-gray-200 overflow-hidden">
                <div className="px-4 py-5 sm:px-6 border-b border-gray-200 bg-gray-50">
                    <h3 className="text-lg leading-6 font-medium text-gray-900">Recent Projects</h3>
                </div>
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-white">
                            <tr>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Project ID</th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Project Name</th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Vendor</th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Target Domain</th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Category</th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Progress</th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Start Date</th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Deadline</th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Created At</th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Updated At</th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                                <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {projects && projects.length > 0 ? (
                                projects.map((project) => {
                                    // Calculate total quantity requested
                                    const totalLinks = project.project_targets ? project.project_targets.reduce((acc, t) => acc + (t.quantity || 1), 0) : parseInt(project.quantity || 0);

                                    // Parse virtual JSON staging data for progress matching
                                    const stagingData = project.project_list?.[0]?.vendor_staging_data || [];
                                    const completedLinks = Array.isArray(stagingData) ? stagingData.filter(p => p.published_url && p.published_url.trim().length > 0).length : 0;

                                    const progressPercent = totalLinks > 0 ? Math.round((completedLinks / totalLinks) * 100) : 0;

                                    return (
                                        <tr key={project.id} className="hover:bg-gray-50 transition-colors">
                                            <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-500">
                                                <div className="flex items-center group">
                                                    <span title={project.id}>{project.id.split('-')[0]}...</span>
                                                    <CopyButton textToCopy={project.id} />
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{project.project_name}</td>

                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{project.vendor_name}</td>

                                            {/* Target Domain Logic for 1-to-Many */}
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                <div className="flex flex-col gap-2">
                                                    {/* Targets Block */}
                                                    <div>
                                                        {project.project_targets && project.project_targets.length > 0 ? (
                                                            project.project_targets.length === 1 ? (
                                                                <a href={project.project_targets[0].target_url} target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:text-indigo-900 font-medium">
                                                                    {getSafeHostname(project.project_targets[0].target_url)}
                                                                </a>
                                                            ) : (
                                                                <span className="text-indigo-600 font-medium bg-indigo-50 px-2 py-1 rounded-md text-xs">{project.project_targets.length} Target URLs</span>
                                                            )
                                                        ) : (
                                                            <span className="text-gray-400 italic">No Targets</span>
                                                        )}
                                                    </div>

                                                    {/* Dripfeed Status Card */}
                                                    {project.dripfeed_enabled && (
                                                        <div className="mt-1 bg-amber-50 border border-amber-200 rounded-md p-2">
                                                            <p className="text-[10px] font-bold text-amber-800 uppercase tracking-wider mb-1">Dripfeed Status</p>
                                                            <div className="flex items-center gap-3 text-xs text-amber-900">
                                                                <span>Period: <span className="font-semibold">{project.dripfeed_period || '-'} Days</span></span>
                                                                <span className="text-amber-300">|</span>
                                                                <span>URLs/day: <span className="font-semibold">{project.urls_per_day || '-'}</span></span>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            </td>

                                            <td className="px-6 py-4 whitespace-nowrap">
                                                {project.backlinks_category ? (
                                                    <span className="px-2 py-0.5 rounded-full text-xs font-medium border bg-purple-50 text-purple-700 border-purple-200" title="Category">
                                                        {project.backlinks_category}
                                                    </span>
                                                ) : (
                                                    <span className="text-gray-400 italic text-xs">-</span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="flex flex-col">
                                                    <span className="text-sm font-semibold text-gray-900">{completedLinks} / {totalLinks}</span>
                                                    <div className="w-full bg-gray-200 rounded-full h-1.5 mt-1">
                                                        <div className={`h-1.5 rounded-full ${progressPercent === 100 ? 'bg-green-500' : 'bg-indigo-600'}`} style={{ width: `${progressPercent}%` }}></div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{new Date(project.start_date).toLocaleDateString()}</td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{new Date(project.deadline).toLocaleDateString()}</td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-400 text-xs">{new Date(project.created_at).toLocaleDateString()}</td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-400 text-xs">{new Date(project.updated_at).toLocaleDateString()}</td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                {(() => {
                                                    const hasPlacements = project.placements && project.placements.length > 0;
                                                    const isFinalized = project.status === 'Finalized' || hasPlacements;
                                                    return (
                                                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full 
                                                            ${(project.status === 'Completed' || isFinalized || progressPercent === 100) ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                                                            {isFinalized ? 'Completed & Finalized' : (project.status === 'Completed' || progressPercent === 100) ? 'Completed' : (project.status || 'In Progress')}
                                                        </span>
                                                    );
                                                })()}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                                <form action={deleteProject.bind(null, project.id)}>
                                                    <button type="submit" className="text-red-600 hover:text-red-900 p-1 rounded-full hover:bg-red-50 transition-colors cursor-pointer" title="Delete Project">
                                                        <Trash2 className="w-5 h-5" />
                                                    </button>
                                                </form>
                                            </td>
                                        </tr>
                                    );
                                })
                            ) : (
                                <tr>
                                    <td colSpan="11" className="px-6 py-10 whitespace-nowrap text-sm text-gray-500 text-center flex-col items-center">
                                        <span className="block">No projects have been kicked off yet.</span>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
