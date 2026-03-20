'use client';

import { useState } from 'react';
import { Search } from 'lucide-react';
import PlacementGroupCard from '../placements/PlacementGroupCard';

export default function CompletedDashboardClient({ projects }) {
    const [searchTerm, setSearchTerm] = useState('');

    let globalOrdered = 0;
    let globalFulfilled = 0;

    projects.forEach(p => {
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

    const groupedProjects = projects.reduce((acc, project) => {
        const vendorName = project.vendors?.vendor_name || 'Generic Vendor';
        const key = vendorName;
        if (!acc[key]) acc[key] = { id: key, vendorName, projects: [] };
        acc[key].projects.push(project);
        return acc;
    }, {});
    
    let groupArray = Object.values(groupedProjects).sort((a, b) => {
        const ad = new Date(b.projects[0]?.completed_date || b.projects[0]?.created_date || 0);
        const bd = new Date(a.projects[0]?.completed_date || a.projects[0]?.created_date || 0);
        return ad - bd;
    });

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

    const percentage = globalOrdered > 0 ? (globalFulfilled / globalOrdered) * 100 : 0;

    return (
        <div className="max-w-screen-2xl mx-auto space-y-8 pb-20 px-4">
            <div className="pt-8 flex flex-col xl:flex-row xl:items-end justify-between gap-6 relative z-20">
                <div>
                    <h1 className="text-4xl font-black text-slate-900 tracking-tight uppercase">Completed Archive</h1>
                    <p className="mt-2 text-[10px] font-black uppercase tracking-widest text-slate-400">
                        Vault of finalized projects and confirmed deliverables.
                    </p>
                </div>

                <div className="flex flex-col sm:flex-row items-end gap-6 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                    {/* Total Fulfillment Quick Metric */}
                    <div className="flex flex-col min-w-[160px]">
                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Total Fulfillment</span>
                        <div className="flex items-baseline gap-2">
                            <span className="text-2xl font-black text-emerald-600 leading-none">{globalFulfilled}</span>
                            <span className="text-sm font-bold text-slate-400">/ {globalOrdered}</span>
                        </div>
                        <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden mt-3">
                            <div 
                                className="h-full rounded-full bg-emerald-500 transition-all duration-1000"
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
                            className="block w-full pl-10 pr-3 py-3 border border-slate-200 rounded-xl leading-5 bg-slate-50 hover:bg-white placeholder-slate-400 focus:outline-none focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 sm:text-sm transition-all text-slate-900 font-medium"
                        />
                    </div>
                </div>
            </div>

            <div className="space-y-6">
                {groupArray.length > 0 ? (
                    groupArray.map((group) => (
                        <PlacementGroupCard key={group.id} group={group} isCompletedView={true} />
                    ))
                ) : (
                    <div className="text-center py-40 bg-slate-50 rounded-3xl border-2 border-dashed border-slate-200">
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-300">
                            No archived assets match your criteria
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}
