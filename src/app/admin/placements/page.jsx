'use client';

import { useState, useEffect } from 'react';
import PlacementCard from './PlacementCard';

export default function PlacementsMonitoringPage() {
    const [projects, setProjects] = useState([]);
    const [isLoading, setIsLoading] = useState(true);

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

    // Filter: Only show projects that have NOT been uploaded to the placements table yet and ARE approved
    const activeProjects = (projects || []).filter(p => {
        const hasPlacements = p.placements && p.placements.length > 0;
        const isProjApproved = p.is_approved === true;
        const projectStatus = p.status;

        return isProjApproved === true && projectStatus !== 'Finalized' && !hasPlacements;
    });

    if (isLoading && projects.length === 0) {
        return (
            <div className="max-w-7xl mx-auto py-20 text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
                <p className="mt-4 text-gray-500 font-medium">Connecting to live placement feed...</p>
            </div>
        );
    }

    return (
        <div className="max-w-7xl mx-auto space-y-12 pb-20 px-4">
            <div>
                <h1 className="text-4xl font-bold text-slate-900 tracking-tight">Active Placements</h1>
                <p className="mt-2 text-slate-500">
                    Monitor active SEO projects and track vendor backlink fulfillment real-time.
                </p>
            </div>

            <div className="space-y-12">
                {activeProjects.length > 0 ? (
                    activeProjects.map((project) => {
                        const representativeHash = project.projects_hub?.[0]?.hash;

                        return (
                            <PlacementCard
                                key={project.id}
                                project={project}
                                representativeHash={representativeHash}
                            />
                        );
                    })
                ) : (
                    <div className="text-center py-32 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200">
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                            System Idle / No active projects pending finalization
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}
