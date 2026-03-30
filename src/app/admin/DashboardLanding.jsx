'use client';

import { useMemo } from 'react';
import { Activity, CheckCircle, Clock, AlertTriangle, DollarSign, TrendingUp, BarChart4 } from 'lucide-react';

export default function DashboardLanding({ placements = [], projects = [] }) {
    
    const metrics = useMemo(() => {
        // --- Index Rate ---
        const totalPlacements = placements.length;
        const indexedPlacements = placements.filter(p => 
            p.indexed_status && p.indexed_status.toLowerCase() === 'indexed'
        ).length;
        const indexRate = totalPlacements > 0 
            ? ((indexedPlacements / totalPlacements) * 100).toFixed(1) 
            : 0;

        // --- Error Rate ---
        const errorPlacements = placements.filter(p => 
            p.status === 'rejected' || (p.indexed_status && p.indexed_status.toLowerCase().includes('error'))
        ).length;
        const errorRate = totalPlacements > 0 
            ? ((errorPlacements / totalPlacements) * 100).toFixed(1) 
            : 0;

        // --- Total Cost ---
        const totalCost = projects.reduce((sum, p) => {
            const price = parseFloat(p.price) || 0;
            if (p.price_type === 'package') return sum + price;
            const quantity = parseInt(p.total_quantity || 1, 10);
            return sum + (price * quantity);
        }, 0);

        // --- Submission Speed ---
        // Calculate average days to complete a project
        const completedProjects = projects.filter(p => p.status === 'Finalized' || p.completed_date);
        let totalDays = 0;
        let speedCount = 0;
        
        completedProjects.forEach(p => {
            if (p.created_date && p.completed_date) {
                const start = new Date(p.created_date);
                const end = new Date(p.completed_date);
                const diffTime = Math.abs(end - start);
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                totalDays += diffDays;
                speedCount++;
            }
        });
        
        const avgSpeed = speedCount > 0 ? (totalDays / speedCount).toFixed(1) : 0;

        return {
            indexRate,
            errorRate,
            totalCost,
            avgSpeed,
            totalPlacements,
            activeProjects: projects.filter(p => p.status !== 'Finalized').length
        };
    }, [placements, projects]);

    const MetricCard = ({ title, value, subtitle, icon: Icon, color, bg }) => (
        <div className={`p-6 rounded-2xl border ${bg} shadow-sm flex items-start gap-4 transition-all duration-300 hover:shadow-md`}>
            <div className={`p-3 rounded-xl ${color}`}>
                <Icon className="w-6 h-6" />
            </div>
            <div>
                <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest mb-1">{title}</h3>
                <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-black text-slate-800">{value}</span>
                </div>
                <p className="text-xs font-medium text-slate-400 mt-1">{subtitle}</p>
            </div>
        </div>
    );

    return (
        <div className="max-w-screen-2xl mx-auto space-y-8 animate-in fade-in duration-500">
            <div>
                <h1 className="text-4xl font-black text-slate-900 tracking-tight uppercase flex items-center gap-3">
                    <BarChart4 className="w-10 h-10 text-indigo-600" />
                    Performance Metrics
                </h1>
                <p className="mt-2 text-sm font-medium text-slate-500 max-w-2xl">
                    High-level actionable insights across all vendors and placements. Track indexation success, identify bottlenecks, and monitor total expenditure.
                </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <MetricCard 
                    title="Index Rate" 
                    value={`${metrics.indexRate}%`}
                    subtitle={`${metrics.totalPlacements} total placements`}
                    icon={TrendingUp}
                    color="bg-emerald-100 text-emerald-600"
                    bg="border-emerald-100 bg-emerald-50/30"
                />
                <MetricCard 
                    title="Avg Submission Speed" 
                    value={`${metrics.avgSpeed} Days`}
                    subtitle="from Start to Finalized"
                    icon={Clock}
                    color="bg-amber-100 text-amber-600"
                    bg="border-amber-100 bg-amber-50/30"
                />
                <MetricCard 
                    title="Error Rate" 
                    value={`${metrics.errorRate}%`}
                    subtitle="Rejected or Error status"
                    icon={AlertTriangle}
                    color="bg-red-100 text-red-600"
                    bg="border-red-100 bg-red-50/30"
                />
                <MetricCard 
                    title="Total Vendor Cost" 
                    value={`$${metrics.totalCost.toLocaleString()}`}
                    subtitle={`${metrics.activeProjects} active projects`}
                    icon={DollarSign}
                    color="bg-indigo-100 text-indigo-600"
                    bg="border-indigo-100 bg-indigo-50/30"
                />
            </div>

            {/* Placeholder for future detailed visual charts (e.g. Chart.js, Recharts) */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-8">
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm min-h-[300px] flex flex-col">
                    <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest mb-4">Indexation Over Time</h3>
                    <div className="flex-1 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center">
                         <div className="text-center space-y-2">
                             <Activity className="w-8 h-8 text-slate-300 mx-auto" />
                             <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Chart Visualization Pending Data</p>
                         </div>
                    </div>
                </div>
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm min-h-[300px] flex flex-col">
                    <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest mb-4">Vendor Speed Distribution</h3>
                    <div className="flex-1 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center">
                         <div className="text-center space-y-2">
                             <BarChart4 className="w-8 h-8 text-slate-300 mx-auto" />
                             <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Chart Visualization Pending Data</p>
                         </div>
                    </div>
                </div>
            </div>

        </div>
    );
}
