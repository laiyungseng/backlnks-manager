'use client';

import { useState, useTransition, useEffect } from 'react';
import { getVendorStats } from './actions';
import {
    ResponsiveContainer,
    PieChart, Pie, Cell,
    LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
    BarChart, Bar,
} from 'recharts';
import { Search, TrendingUp, DollarSign, Package, Zap } from 'lucide-react';

const PALETTE = ['#6366f1', '#22d3ee', '#f59e0b', '#10b981', '#f43f5e', '#8b5cf6', '#06b6d4', '#84cc16', '#f97316', '#ec4899'];

function ChartCard({ title, children, className = '' }) {
    return (
        <div className={`bg-white rounded-xl border border-slate-200 shadow-sm p-5 ${className}`}>
            <h3 className="text-sm font-bold text-slate-700 mb-4">{title}</h3>
            {children}
        </div>
    );
}

function KpiCard({ label, value, icon: Icon, color = 'indigo' }) {
    const colors = {
        indigo: 'bg-indigo-50 text-indigo-600',
        green: 'bg-green-50 text-green-600',
        amber: 'bg-amber-50 text-amber-600',
        cyan: 'bg-cyan-50 text-cyan-600',
    };
    return (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 flex items-center gap-4">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${colors[color]}`}>
                <Icon className="w-5 h-5" />
            </div>
            <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{label}</p>
                <p className="text-2xl font-black text-slate-900">{value}</p>
            </div>
        </div>
    );
}

function IndexGauge({ indexRate }) {
    const pct = indexRate.total > 0 ? Math.round((indexRate.indexed / indexRate.total) * 100) : 0;
    const gaugeData = [
        { name: 'Indexed', value: pct },
        { name: 'Remaining', value: 100 - pct },
    ];
    return (
        <div className="flex flex-col items-center">
            <div className="relative">
                <PieChart width={220} height={130}>
                    <Pie
                        data={gaugeData}
                        cx={110}
                        cy={120}
                        startAngle={180}
                        endAngle={0}
                        innerRadius={65}
                        outerRadius={100}
                        dataKey="value"
                        strokeWidth={0}
                    >
                        <Cell fill="#6366f1" />
                        <Cell fill="#e2e8f0" />
                    </Pie>
                </PieChart>
                <div className="absolute inset-0 flex flex-col items-center justify-end pb-2 pointer-events-none">
                    <span className="text-3xl font-black text-slate-900">{pct}%</span>
                </div>
            </div>
            <p className="text-xs text-slate-500 mt-1">
                {indexRate.indexed.toLocaleString()} / {indexRate.total.toLocaleString()} placements indexed
            </p>
        </div>
    );
}

function EmployStatusDonut({ data }) {
    const scrollable = data.length > 5;
    return (
        <div className="flex flex-col gap-3">
            <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                    <Pie data={data} dataKey="count" innerRadius={45} outerRadius={75} strokeWidth={0}>
                        {data.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
                    </Pie>
                    <Tooltip formatter={(v) => [v, 'Vendors']} />
                </PieChart>
            </ResponsiveContainer>
            <div className={`space-y-1.5 ${scrollable ? 'max-h-32 overflow-y-auto pr-1' : ''}`}>
                {data.map((entry, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs">
                        <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: PALETTE[i % PALETTE.length] }} />
                        <span className="text-slate-600 capitalize">{entry.status}</span>
                        <span className="ml-auto font-bold text-slate-900">{entry.count}</span>
                    </div>
                ))}
            </div>
        </div>
    );
}

function EmptyState({ label }) {
    return <div className="flex items-center justify-center h-40 text-slate-300 text-sm">{label}</div>;
}

export default function VendorAnalyticsDashboard({ vendors, initialStats }) {
    const [stats, setStats] = useState(initialStats);
    const [selectedId, setSelectedId] = useState(null);
    const [search, setSearch] = useState('');
    const [isPending, startTransition] = useTransition();

    const filteredVendors = vendors.filter(v =>
        v.vendor_name.toLowerCase().includes(search.toLowerCase())
    );

    const selectVendor = (id) => {
        setSelectedId(id);
        startTransition(async () => {
            const res = await getVendorStats(id);
            if (res.success) setStats(res);
        });
    };

    const selectedName = selectedId ? (vendors.find(v => v.id === selectedId)?.vendor_name || 'Unknown') : 'All Vendors';

    if (!stats) {
        return <div className="text-slate-400 text-sm py-10 text-center">Failed to load analytics data.</div>;
    }

    const indexPct = stats.indexRate.total > 0
        ? Math.round((stats.indexRate.indexed / stats.indexRate.total) * 100)
        : 0;

    return (
        <div className="space-y-6">
            {/* Vendor Selector */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
                <div className="flex items-center gap-2 mb-3">
                    <Search className="w-4 h-4 text-slate-400" />
                    <input
                        type="text"
                        placeholder="Search vendor…"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        className="flex-1 text-sm border-0 outline-none text-slate-700 placeholder-slate-400"
                    />
                    {isPending && <span className="text-xs text-indigo-500 animate-pulse">Loading…</span>}
                </div>
                <div className="flex flex-wrap gap-2 max-h-28 overflow-y-auto">
                    <button
                        onClick={() => selectVendor(null)}
                        className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors ${selectedId === null ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
                    >
                        All Vendors
                    </button>
                    {filteredVendors.map(v => (
                        <button
                            key={v.id}
                            onClick={() => selectVendor(v.id)}
                            className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors ${selectedId === v.id ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
                        >
                            {v.vendor_name}
                        </button>
                    ))}
                </div>
                <p className="text-xs text-slate-400 mt-2">Showing: <span className="font-semibold text-slate-600">{selectedName}</span></p>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <KpiCard label="Total Spend" value={`$${stats.totalSpend.toLocaleString(undefined, { maximumFractionDigits: 0 })}`} icon={DollarSign} color="green" />
                <KpiCard label="Total Projects" value={stats.totalProjects.toLocaleString()} icon={Package} color="indigo" />
                <KpiCard label="Total Placements" value={stats.totalPlacements.toLocaleString()} icon={TrendingUp} color="cyan" />
                <KpiCard label="Index Rate" value={`${indexPct}%`} icon={Zap} color="amber" />
            </div>

            {/* Row 1: Gauge + Employ Status */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <ChartCard title="Index Rate Gauge" className="lg:col-span-2">
                    <IndexGauge indexRate={stats.indexRate} />
                </ChartCard>
                <ChartCard title="Vendor Fleet Status">
                    {stats.employStatus.length === 0
                        ? <EmptyState label="No vendor data" />
                        : <EmployStatusDonut data={stats.employStatus} />
                    }
                </ChartCard>
            </div>

            {/* Row 2: Monthly Completions (full width) */}
            <ChartCard title="Monthly Completions">
                {stats.monthlyCompletions.length === 0
                    ? <EmptyState label="No completed projects yet" />
                    : (
                        <ResponsiveContainer width="100%" height={200}>
                            <LineChart data={stats.monthlyCompletions} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                                <Tooltip />
                                <Line type="monotone" dataKey="count" stroke="#6366f1" strokeWidth={2} dot={{ fill: '#6366f1', r: 4 }} name="Completions" />
                            </LineChart>
                        </ResponsiveContainer>
                    )
                }
            </ChartCard>

            {/* Row 3: Cost Per Category + Vendor Speed + Domain Diversity */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <ChartCard title="Cost Per Category">
                    {stats.costPerCategory.length === 0
                        ? <EmptyState label="No cost data" />
                        : (
                            <ResponsiveContainer width="100%" height={200}>
                                <BarChart data={stats.costPerCategory} margin={{ top: 5, right: 10, bottom: 25, left: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                                    <XAxis dataKey="category" tick={{ fontSize: 10 }} angle={-30} textAnchor="end" interval={0} />
                                    <YAxis tick={{ fontSize: 11 }} />
                                    <Tooltip formatter={(v) => [`$${v.toLocaleString()}`, 'Cost']} />
                                    <Bar dataKey="cost" fill="#6366f1" radius={[3, 3, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        )
                    }
                </ChartCard>

                <ChartCard title="Avg. Completion Speed">
                    <div className="flex flex-col items-center justify-center h-40 gap-2">
                        <span className="text-5xl font-black text-indigo-600">{stats.vendorSpeed.avgDays}</span>
                        <span className="text-sm font-semibold text-slate-500">avg days per project</span>
                        <span className="text-xs text-slate-400">based on {stats.vendorSpeed.projectCount} completed project{stats.vendorSpeed.projectCount !== 1 ? 's' : ''}</span>
                    </div>
                </ChartCard>

                <ChartCard title="Domain Diversity">
                    <div className="flex flex-col items-center justify-center h-40 gap-3">
                        <div className="flex items-end gap-6">
                            <div className="text-center">
                                <div className="text-3xl font-black text-indigo-600">{stats.domainDiversity.uniqueDomains}</div>
                                <div className="text-xs text-slate-500 mt-1">Unique Domains</div>
                            </div>
                            <div className="text-center">
                                <div className="text-3xl font-black text-slate-400">{stats.domainDiversity.totalPlacements}</div>
                                <div className="text-xs text-slate-500 mt-1">Total Placements</div>
                            </div>
                        </div>
                        {stats.domainDiversity.totalPlacements > 0 && (
                            <div className="w-full bg-slate-100 rounded-full h-2">
                                <div
                                    className="bg-indigo-500 h-2 rounded-full"
                                    style={{ width: `${Math.min(100, (stats.domainDiversity.uniqueDomains / stats.domainDiversity.totalPlacements) * 100)}%` }}
                                />
                            </div>
                        )}
                        <p className="text-xs text-slate-400">
                            {stats.domainDiversity.totalPlacements > 0
                                ? `${Math.round((stats.domainDiversity.uniqueDomains / stats.domainDiversity.totalPlacements) * 100)}% domain diversity`
                                : 'No placements'}
                        </p>
                    </div>
                </ChartCard>
            </div>

            {/* Row 4: Anchor Text + Placement Status */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <ChartCard title="Top Anchor Texts" className="lg:col-span-2">
                    {stats.anchorTextDist.length === 0
                        ? <EmptyState label="No placement data" />
                        : (
                            <ResponsiveContainer width="100%" height={220}>
                                <BarChart layout="vertical" data={stats.anchorTextDist} margin={{ top: 5, right: 20, bottom: 5, left: 10 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                                    <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
                                    <YAxis type="category" dataKey="text" tick={{ fontSize: 10 }} width={130} />
                                    <Tooltip />
                                    <Bar dataKey="count" fill="#22d3ee" radius={[0, 3, 3, 0]} name="Count" />
                                </BarChart>
                            </ResponsiveContainer>
                        )
                    }
                </ChartCard>

                <ChartCard title="Placement Status">
                    {stats.placementStatusDist.length === 0
                        ? <EmptyState label="No placements" />
                        : (
                            <>
                                <ResponsiveContainer width="100%" height={160}>
                                    <PieChart>
                                        <Pie data={stats.placementStatusDist} dataKey="count" innerRadius={40} outerRadius={65} strokeWidth={0}>
                                            {stats.placementStatusDist.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
                                        </Pie>
                                        <Tooltip formatter={(v, n, p) => [v, p.payload.status]} />
                                    </PieChart>
                                </ResponsiveContainer>
                                <div className="space-y-1.5 mt-2">
                                    {stats.placementStatusDist.map((entry, i) => (
                                        <div key={i} className="flex items-center gap-2 text-xs">
                                            <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: PALETTE[i % PALETTE.length] }} />
                                            <span className="text-slate-600 capitalize">{entry.status}</span>
                                            <span className="ml-auto font-bold text-slate-900">{entry.count}</span>
                                        </div>
                                    ))}
                                </div>
                            </>
                        )
                    }
                </ChartCard>
            </div>
        </div>
    );
}
