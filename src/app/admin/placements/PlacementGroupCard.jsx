'use client';

import { useState } from 'react';
import { ChevronDown, ChevronRight, Users, Layers } from 'lucide-react';
import PlacementProjectRow from './PlacementProjectRow';

function CampaignSubGroup({ campaignTitle, projects, isCompletedView }) {
    const [open, setOpen] = useState(true);

    return (
        <div className="rounded-xl border border-slate-100 overflow-hidden mb-3">
            {/* Campaign title bar */}
            <button
                type="button"
                onClick={() => setOpen(v => !v)}
                className="w-full flex items-center gap-3 px-4 py-2.5 bg-slate-50 hover:bg-slate-100 transition-colors text-left"
            >
                <Layers className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                <span className="text-xs font-black uppercase tracking-widest text-slate-700 flex-1 truncate">{campaignTitle}</span>
                <span className="text-[9px] font-bold text-slate-400 shrink-0">{projects.length} plan{projects.length !== 1 ? 's' : ''}</span>
                {open ? <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" /> : <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />}
            </button>

            {open && (
                <div className="space-y-3 p-3 bg-white">
                    {projects.map((project, idx) => (
                        <PlacementProjectRow key={project.id || idx} project={project} isCompletedView={isCompletedView} />
                    ))}
                </div>
            )}
        </div>
    );
}

export default function PlacementGroupCard({ group, isCompletedView }) {
    const [isCollapsed, setIsCollapsed] = useState(true);

    const { vendorName, projects } = group;

    // Sub-group by project_name (= campaign title in new kickoff flow)
    const campaignGroups = projects.reduce((acc, project) => {
        const title = project.project_name || 'Unnamed Campaign';
        if (!acc[title]) acc[title] = [];
        acc[title].push(project);
        return acc;
    }, {});
    const campaignEntries = Object.entries(campaignGroups);
    const isMultiCampaign = campaignEntries.length > 1;

    const vendorSlug = vendorName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');

    return (
        <div id={`vendor-${vendorSlug}`} className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm mb-6 transition-all border-l-4 border-l-indigo-500">
            {/* Vendor Header */}
            <div className={`p-6 flex items-center justify-between transition-colors ${isCompletedView ? 'bg-emerald-50/10' : 'bg-white'}`}>
                <div className="flex items-center gap-5">
                    <div className="w-14 h-14 bg-indigo-50/80 rounded-2xl flex items-center justify-center border border-indigo-100/50">
                        <Users className="w-7 h-7 text-indigo-600" />
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <h2 className="text-xl font-black text-slate-900 tracking-tight uppercase">{vendorName}</h2>
                        </div>
                        {isMultiCampaign && (
                            <p className="text-[10px] text-slate-400 font-semibold mt-0.5">{campaignEntries.length} campaigns</p>
                        )}
                    </div>
                </div>

                <div className="flex items-center min-w-[320px] justify-between">
                    <div className="flex flex-col items-start w-[140px]">
                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Status</span>
                        <div className="flex items-center gap-2">
                            <div className={`w-2 h-2 rounded-full ${isCompletedView ? 'bg-emerald-500' : 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]'}`} />
                            <span className="text-sm font-bold text-slate-800">
                                {isCompletedView ? 'Finalized Archive' : 'Live & Tracking'}
                            </span>
                        </div>
                    </div>

                    <div className="flex flex-col items-end mr-6 min-w-[120px]">
                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Available Projects</span>
                        <span className="text-sm font-bold text-slate-800 tracking-tight">{projects.length} {projects.length === 1 ? 'Project' : 'Projects'}</span>
                    </div>

                    <button
                        onClick={() => setIsCollapsed(!isCollapsed)}
                        className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-xl transition-colors shrink-0"
                    >
                        {isCollapsed ? <ChevronRight className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                    </button>
                </div>
            </div>

            {/* Sub-table */}
            {!isCollapsed && (
                <div className="bg-slate-50/80 border-t border-slate-100 pb-2 shadow-inner">
                    {isMultiCampaign ? (
                        // Multiple campaigns: show sub-group headers
                        <div className="px-6 pb-6 pt-4 max-h-[800px] overflow-y-auto">
                            {campaignEntries.map(([title, projs]) => (
                                <CampaignSubGroup key={title} campaignTitle={title} projects={projs} isCompletedView={isCompletedView} />
                            ))}
                        </div>
                    ) : (
                        // Single campaign (most common): flat list with column headers
                        <>
                            {/* Headers: [ID:2] [Name+Info:3] [Region:1] [Fulfillment:2] [Portal:1] [Actions:3] = 12 */}
                            <div className="hidden md:grid grid-cols-12 px-6 py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-200">
                                <div className="col-span-2">Project ID</div>
                                <div className="col-span-3">Project Name</div>
                                <div className="col-span-1">Region</div>
                                <div className="col-span-2">Fulfillment</div>
                                <div className="col-span-1 text-center">Portal</div>
                                <div className="col-span-3 text-right">
                                    {isCompletedView ? 'Status & Security' : 'Status & Actions'}
                                </div>
                            </div>
                            <div className="px-6 pb-6 pt-4 space-y-4 max-h-[640px] overflow-y-auto">
                                {projects.map((project, idx) => (
                                    <PlacementProjectRow key={project.id || idx} project={project} isCompletedView={isCompletedView} />
                                ))}
                            </div>
                        </>
                    )}
                </div>
            )}
        </div>
    );
}
