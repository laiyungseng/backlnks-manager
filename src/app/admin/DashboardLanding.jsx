'use client';

import { useMemo } from 'react';
import { Activity, CheckCircle, Clock, AlertTriangle, DollarSign, TrendingUp, BarChart4, Users } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line, ComposedChart } from 'recharts';

export default function DashboardLanding({ placements = [], projects = [], vendors = [] }) {
    
    const metrics = useMemo(() => {
        // --- Index Rate ---
        const totalPlacements = placements.length;
        const indexedPlacements = placements.filter(p => 
            p.indexed_status && p.indexed_status.toLowerCase() === 'page_indexed'
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
            avgSpeed,
            totalPlacements,
            activeProjects: projects.filter(p => p.status !== 'Finalized').length
        };
    }, [placements, projects]);

    const chartData = useMemo(() => {
        // 1. Indexation by Vendor
        const indexationMap = {};
        placements.forEach(p => {
            const vName = p.vendors?.vendor_name || 'Unknown';
            if (!indexationMap[vName]) {
                indexationMap[vName] = { vendor: vName, total: 0, indexed: 0 };
            }
            indexationMap[vName].total += 1;
            if (p.indexed_status && p.indexed_status.toLowerCase() === 'page_indexed') {
                indexationMap[vName].indexed += 1;
            }
        });
        const indexationData = Object.values(indexationMap).sort((a,b) => b.total - a.total).slice(0, 10);

        // 2. Vendor Speed (using placements published_date vs created_at)
        const speedMap = {};
        placements.forEach(p => {
            const vName = p.vendors?.vendor_name || 'Unknown';
            if (p.published_date && p.created_at) {
                const start = new Date(p.created_at);
                const end = new Date(p.published_date);
                const diffDays = Math.ceil(Math.abs(end - start) / (1000 * 60 * 60 * 24));
                if (!speedMap[vName]) {
                    speedMap[vName] = { vendor: vName, maxDays: 0, totalDays: 0, count: 0 };
                }
                speedMap[vName].totalDays += diffDays;
                speedMap[vName].count += 1;
                if (diffDays > speedMap[vName].maxDays) {
                    speedMap[vName].maxDays = diffDays;
                }
            }
        });
        const speedData = Object.values(speedMap).map(v => ({
            vendor: v.vendor,
            avgDays: Math.round(v.totalDays / v.count),
            maxDays: v.maxDays
        }));

        // 3. Vendor Price (sum of (price * qty) from projects by vendor)
        const priceMap = {};
        projects.forEach(p => {
            const vName = p.vendors?.vendor_name || 'Unknown';
            const price = parseFloat(p.price) || 0;
            let cost = 0;
            if (p.price_type === 'package') cost = price;
            else {
                const quantity = parseInt(p.total_quantity || 1, 10);
                cost = price * quantity;
            }
            if (!priceMap[vName]) priceMap[vName] = { vendor: vName, totalCost: 0 };
            priceMap[vName].totalCost += cost;
        });
        const priceData = Object.values(priceMap).sort((a,b) => b.totalCost - a.totalCost).slice(0, 10);

        return { indexationData, speedData, priceData };
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

            {/* Charts Section */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-8">
                {/* Indexation by Vendor */}
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm min-h-[300px] flex flex-col">
                    <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest mb-4">Indexation by Vendor</h3>
                    <div className="flex-1 w-full h-full min-h-[250px]">
                        {chartData.indexationData.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <ComposedChart data={chartData.indexationData}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                    <XAxis dataKey="vendor" style={{ fontSize: '10px', fontWeight: 'bold', fill: '#94a3b8' }} tick={{ width: 80 }} />
                                    <YAxis style={{ fontSize: '10px', fontWeight: 'bold', fill: '#94a3b8' }} />
                                    <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} cursor={{ fill: 'transparent' }} />
                                    <Legend wrapperStyle={{ fontSize: '12px', fontWeight: 'bold' }} />
                                    <Bar dataKey="total" name="Total Placements" fill="#cbd5e1" radius={[4, 4, 0, 0]} />
                                    <Bar dataKey="indexed" name="Indexed" fill="#10b981" radius={[4, 4, 0, 0]} />
                                </ComposedChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="h-full rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center">
                                <div className="text-center space-y-2">
                                    <Activity className="w-8 h-8 text-slate-300 mx-auto" />
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">No indexation data</p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Vendor Speed Distribution */}
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm min-h-[300px] flex flex-col">
                    <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest mb-4">Vendor Speed (Avg vs Max Days)</h3>
                    <div className="flex-1 w-full h-full min-h-[250px]">
                        {chartData.speedData.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={chartData.speedData}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                    <XAxis dataKey="vendor" style={{ fontSize: '10px', fontWeight: 'bold', fill: '#94a3b8' }} tick={{ width: 80 }} />
                                    <YAxis style={{ fontSize: '10px', fontWeight: 'bold', fill: '#94a3b8' }} />
                                    <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} cursor={{ fill: 'transparent' }} />
                                    <Legend wrapperStyle={{ fontSize: '12px', fontWeight: 'bold' }} />
                                    <Bar dataKey="avgDays" name="Avg Days" fill="#6366f1" radius={[4, 4, 0, 0]} />
                                    <Bar dataKey="maxDays" name="Max Days" fill="#fbbf24" radius={[4, 4, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="h-full rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center">
                                <div className="text-center space-y-2">
                                    <Clock className="w-8 h-8 text-slate-300 mx-auto" />
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">No speed data</p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Vendor Price (Spent) */}
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm min-h-[300px] flex flex-col">
                    <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest mb-4">Total Spent by Vendor</h3>
                    <div className="flex-1 w-full h-full min-h-[250px]">
                        {chartData.priceData.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={chartData.priceData} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                                    <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                                    <XAxis type="number" style={{ fontSize: '10px', fontWeight: 'bold', fill: '#94a3b8' }} />
                                    <YAxis dataKey="vendor" type="category" style={{ fontSize: '10px', fontWeight: 'bold', fill: '#94a3b8' }} width={80} />
                                    <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} cursor={{ fill: 'transparent' }} formatter={(value) => `$${value.toLocaleString()}`} />
                                    <Bar dataKey="totalCost" name="Total Spent" fill="#14b8a6" radius={[0, 4, 4, 0]} barSize={20} />
                                </BarChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="h-full rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center">
                                <div className="text-center space-y-2">
                                    <DollarSign className="w-8 h-8 text-slate-300 mx-auto" />
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">No price data</p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Vendor Employ Status */}
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm min-h-[300px] flex flex-col">
                    <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest flex items-center justify-between mb-4">
                        Vendor Employ Status
                        <Users className="w-4 h-4 text-slate-400" />
                    </h3>
                    <div className="flex-1 overflow-auto rounded-xl border border-slate-100">
                        <table className="min-w-full divide-y divide-slate-100">
                            <thead className="bg-slate-50 sticky top-0">
                                <tr>
                                    <th className="px-4 py-3 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Vendor</th>
                                    <th className="px-4 py-3 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Status</th>
                                    <th className="px-4 py-3 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Perf</th>
                                    <th className="px-4 py-3 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Remark</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-slate-50">
                                {vendors.map(v => {
                                    const isContinue = v.employ_status === 'continue';
                                    const isDiscontinue = v.employ_status === 'discontinue';
                                    
                                    let perfColor = 'bg-slate-100 text-slate-600';
                                    const pScore = parseInt(v.performance, 10) || 0;
                                    if (pScore >= 4) perfColor = 'bg-emerald-100 text-emerald-700';
                                    else if (pScore === 3) perfColor = 'bg-amber-100 text-amber-700';
                                    else if (pScore > 0 && pScore <= 2) perfColor = 'bg-red-100 text-red-700';

                                    return (
                                        <tr key={v.id} className="hover:bg-slate-50 transition-colors">
                                            <td className="px-4 py-3 text-xs font-bold text-slate-800">{v.vendor_name}</td>
                                            <td className="px-4 py-3">
                                                {isContinue && <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-widest bg-emerald-100 text-emerald-700">Continue</span>}
                                                {isDiscontinue && <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-widest bg-red-100 text-red-700">Discontinue</span>}
                                                {!isContinue && !isDiscontinue && <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-widest bg-slate-100 text-slate-500">{v.employ_status || 'Unknown'}</span>}
                                            </td>
                                            <td className="px-4 py-3">
                                                <span className={`px-2 auto py-0.5 rounded text-[10px] font-black uppercase tracking-widest ${perfColor}`}>
                                                    {pScore ? `${pScore}/5` : '—'}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-xs font-medium text-slate-500 truncate max-w-[120px]">
                                                {v.remark || '—'}
                                            </td>
                                        </tr>
                                    );
                                })}
                                {vendors.length === 0 && (
                                    <tr>
                                        <td colSpan="4" className="px-4 py-8 text-center text-[10px] font-bold text-slate-400 uppercase tracking-widest">No vendors found</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

        </div>
    );
}
