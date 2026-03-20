'use client';

import { useState, useEffect } from 'react';
import { Search } from 'lucide-react';
import PlacementGroupCard from './PlacementGroupCard';

export default function PlacementsMonitoringPage() {
    const [projects, setProjects] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        // Use SSE stream for real-time updates without leaking Supabase keys
        const eventSource = new EventSource('/api/realtime/dashboard');

        eventSource.addEventListener('projects', (event) => {
            try {
                const data = JSON.parse(event.data);
                console.log('[SSE] Dashboard update received');
                setProjects(data || []);
                setIsLoading(false);
            } catch (err) {
                console.error('[SSE] Parse error:', err);
            }
        });

        eventSource.addEventListener('error', (event) => {
            console.error('[SSE] Connection error:', event);
            // Optionally implement reconnection logic or fallback fetch
        });

        return () => {
            eventSource.close();
        };
    }, []);

    // Filter: Only show active projects
    const activeProjects = (projects || []).filter(p => {
        const hasPlacements = p.placements && p.placements.length > 0;
        const isProjApproved = p.is_approved === true;
        const projectStatus = p.status;
        return isProjApproved === true && projectStatus !== 'Finalized' && !hasPlacements;
    });

    // Global Metrics Calculation
    let globalOrdered = 0;
    let globalFulfilled = 0;

    activeProjects.forEach(p => {
        const hub = p.projects_hub?.[0] || {};
        const hubTargets = Array.isArray(hub.targets) ? hub.targets : [];
        const totalLinks = hubTargets.length > 0
            ? hubTargets.reduce((acc, t) => acc + (parseInt(t.quantity || '0', 10)), 0)
            : (p.total_quantity || 0);
            
        const stagingData = hub.vendor_staging_data || [];
        const completedLinks = Array.isArray(stagingData) 
            ? stagingData.filter(s => s.published_url && s.published_url.trim().length > 0).length 
            : 0;

        globalOrdered += totalLinks;
        globalFulfilled += completedLinks;
    });

    // Grouping strictly by Vendor
    const groupedProjects = activeProjects.reduce((acc, project) => {
        const vendorName = project.vendors?.vendor_name || 'Generic Vendor';
        const key = vendorName;
        if (!acc[key]) acc[key] = { id: key, vendorName, projects: [] };
        acc[key].projects.push(project);
        return acc;
    }, {});
    
    // Sort array safely (by newest created project in the group)
    let groupArray = Object.values(groupedProjects).sort((a, b) => {
        const ad = new Date(b.projects[0]?.created_date || 0);
        const bd = new Date(a.projects[0]?.created_date || 0);
        return ad - bd;
    });

    // Filtering by Search Term
    if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase();
        groupArray = groupArray.map(group => {
            const groupMatch = group.vendorName.toLowerCase().includes(term);
            const matchingProjects = group.projects.filter(p => {
                const nameMatch = (p.project_name || '').toLowerCase().includes(term);
                const targets = p.projects_hub?.[0]?.targets || [];
                const keywordMatch = targets.some(t => 
                    (t.anchor_text || '').toLowerCase().includes(term) || 
                    (t.category || '').toLowerCase().includes(term) ||
                    (t.sheet_name || '').toLowerCase().includes(term)
                );
                return nameMatch || keywordMatch;
            });

            if (groupMatch) return group;
            if (matchingProjects.length > 0) return { ...group, projects: matchingProjects };
            return null;
        }).filter(Boolean);
    }

    if (isLoading && projects.length === 0) {
        return (
            <div className="max-w-7xl mx-auto py-20 text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
                <p className="mt-4 text-gray-500 font-medium">Connecting to live placement feed...</p>
            </div>
        );
    }

    const percentage = globalOrdered > 0 ? (globalFulfilled / globalOrdered) * 100 : 0;

    return (
        <div className="max-w-screen-2xl mx-auto space-y-8 pb-20 px-4">
            <div className="pt-8 flex flex-col xl:flex-row xl:items-end justify-between gap-6 relative z-20">
                <div>
                    <h1 className="text-4xl font-black text-slate-900 tracking-tight uppercase">Active Monitoring</h1>
                    <p className="mt-2 text-[10px] font-black uppercase tracking-widest text-slate-400">
                        Real-time oversight of SEO link injection and vendor fulfillment.
                    </p>
                </div>

                <div className="flex flex-col sm:flex-row items-end gap-6 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                    {/* Total Fulfillment Quick Metric */}
                    <div className="flex flex-col min-w-[160px]">
                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Total Fulfillment</span>
                        <div className="flex items-baseline gap-2">
                            <span className="text-2xl font-black text-indigo-600 leading-none">{globalFulfilled}</span>
                            <span className="text-sm font-bold text-slate-400">/ {globalOrdered}</span>
                        </div>
                        <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden mt-3">
                            <div 
                                className="h-full rounded-full bg-indigo-500 transition-all duration-1000"
                                style={{ width: `${percentage}%` }}
                            />
                        </div>
                    </div>
                    
                    {/* Search Bar */}
                    <div className="relative w-full sm:w-72">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <Search className="h-4 w-4 text-slate-400" />
                        </div>
                        <input
                            type="text"
                            placeholder="Search domains, projects, keywords..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="block w-full pl-10 pr-3 py-3 border border-slate-200 rounded-xl leading-5 bg-slate-50 hover:bg-white placeholder-slate-400 focus:outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm transition-all text-slate-900 font-medium"
                        />
                    </div>
                </div>
            </div>

            <div className="space-y-6">
                {groupArray.length > 0 ? (
                    groupArray.map((group) => (
                        <PlacementGroupCard key={group.id} group={group} isCompletedView={false} />
                    ))
                ) : (
                    <div className="text-center py-40 bg-slate-50 rounded-3xl border-2 border-dashed border-slate-200">
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-300">
                            No active injection flows match your criteria
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}
