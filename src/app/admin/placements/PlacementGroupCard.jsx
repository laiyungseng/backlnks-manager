'use client';

import { useState } from 'react';
import { ChevronDown, ChevronRight, Globe, ExternalLink, Users } from 'lucide-react';
import PlacementProjectRow from './PlacementProjectRow';

export default function PlacementGroupCard({ group, isCompletedView }) {
    const [isCollapsed, setIsCollapsed] = useState(true); // Collapsed by default for scannability

    const { vendorName, projects } = group;

    return (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm mb-6 transition-all border-l-4 border-l-indigo-500">
            {/* Header */}
            <div className={`p-6 flex items-center justify-between transition-colors ${isCompletedView ? 'bg-emerald-50/10' : 'bg-white'}`}>
                <div className="flex items-center gap-5">
                    <div className="w-14 h-14 bg-indigo-50/80 rounded-2xl flex items-center justify-center border border-indigo-100/50">
                        <Users className="w-7 h-7 text-indigo-600" />
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <h2 className="text-xl font-black text-slate-900 tracking-tight uppercase">{vendorName}</h2>
                        </div>
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
                    <div className="grid grid-cols-12 gap-4 px-12 py-5 text-[9px] font-black text-slate-400 uppercase tracking-widest items-center">
                        <div className="col-span-3">Project Name</div>
                        <div className="col-span-3">Region / Delivery</div>
                        <div className="col-span-2 pl-2">Fulfillment</div>
                        <div className="col-span-2 pl-2">Portal Access</div>
                        <div className="col-span-2 flex justify-end">
                            {isCompletedView ? 'Status & Security' : 'Status & Security Actions'}
                        </div>
                    </div>
                    
                    <div className="px-6 pb-6 space-y-4">
                        {projects.map((project, idx) => (
                            <PlacementProjectRow 
                                key={project.id || idx} 
                                project={project} 
                                isCompletedView={isCompletedView} 
                            />
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
