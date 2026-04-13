'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

export default function CurrentProjectIndicator({ vendorName, activeProjects }) {
    const [currentProject, setCurrentProject] = useState(null);

    useEffect(() => {
        if (!vendorName || !activeProjects || activeProjects.length === 0) return;
        
        const savedHash = localStorage.getItem(`lastProjectHash_${vendorName}`);
        if (savedHash) {
            // Find the project that matches this hash
            const project = activeProjects.find(p => p.projects_hub?.[0]?.hash === savedHash);
            if (project) {
                setCurrentProject({ ...project, hash: savedHash });
            }
        }
    }, [vendorName, activeProjects]);

    if (!currentProject) return null;

    return (
        <div className="absolute top-8 right-6 z-10 bg-white border border-indigo-100 rounded-xl p-3 shadow-md flex items-center gap-4 animate-in fade-in slide-in-from-top-4 duration-300">
            <div>
                <span className="text-gray-400 block text-[10px] font-black uppercase tracking-widest mb-0.5">Current Project</span>
                <span className="font-bold text-indigo-700 text-sm truncate max-w-[150px] inline-block align-bottom" title={currentProject.project_name || 'Unnamed Project'}>
                    {currentProject.project_name || 'Unnamed Project'}
                </span>
            </div>
            <Link 
                href={`/vendor/${vendorName}/${currentProject.hash}`} 
                className="text-xs font-bold bg-indigo-50 border border-indigo-100 text-indigo-600 px-3 py-1.5 rounded-lg hover:bg-indigo-100 transition-colors shadow-sm"
            >
                Return
            </Link>
        </div>
    );
}
