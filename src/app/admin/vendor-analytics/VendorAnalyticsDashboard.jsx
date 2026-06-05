'use client';

import { useState, useTransition } from 'react';
import { getVendorStats, generateReportLinkAction } from './actions';
import {
    ResponsiveContainer,
    PieChart, Pie, Cell,
    LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
    BarChart, Bar,
} from 'recharts';
import { Search, TrendingUp, DollarSign, Package, Zap, Share2, Check } from 'lucide-react';
import ProjectMultiSelect from '@/components/ProjectMultiSelect';
import ProjectCostChart from '@/components/ProjectCostChart';

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

const INDEX_STATUS_COLORS = {
    page_indexed:     '#10b981',
    page_not_indexed: '#f43f5e',
    no_data:          '#f59e0b',
    not_checked:      '#cbd5e1',
};

function IndexStatusBreakdown({ data }) {
    if (!data || data.length === 0) {
        return <div className="flex items-center justify-center h-full text-slate-300 text-sm">No placement data</div>;
    }
    const chartData = data.map(d => ({ name: d.label, value: d.count }));
    const colors = data.map(d => INDEX_STATUS_COLORS[d.key] || '#8b5cf6');
    return (
        <div className="flex flex-col h-full justify-center gap-3">
            <ResponsiveContainer width="100%" height={130}>
                <PieChart>
                    <Pie data={chartData} dataKey="value" innerRadius={38} outerRadius={58} strokeWidth={0}>
                        {chartData.map((_, i) => <Cell key={i} fill={colors[i]} />)}
                    </Pie>
                    <Tooltip formatter={(v, n, p) => [`${v} (${data[p.index]?.pct ?? 0}%)`, p.payload.name]} />
                </PieChart>
            </ResponsiveContainer>
            <div className="space-y-1.5 px-1">
                {data.map((entry, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs">
                        <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: colors[i] }} />
                        <span className="text-slate-600">{entry.label}</span>
                        <div className="ml-auto flex items-center gap-1.5">
                            <span className="font-bold text-slate-900">{entry.count.toLocaleString()}</span>
                            <span className="text-slate-400 w-8 text-right">{entry.pct}%</span>
                        </div>
                    </div>
                ))}
            </div>
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
    const [shareCopied, setShareCopied] = useState(false);
    const [shareLoading, setShareLoading] = useState(false);
    const [selectedProjects, setSelectedProjects] = useState([]);

    async function handleShare() {
        setShareLoading(true);
        const label = selectedId ? (vendors.find(v => v.id === selectedId)?.vendor_name || 'Vendor') : 'All Vendors';
        const res = await generateReportLinkAction(selectedId, label);
        setShareLoading(false);
        if (!res.success) return;
        await navigator.clipboard.writeText(res.url);
        setShareCopied(true);
        setTimeout(() => setShareCopied(false), 2500);
    }

    const filteredVendors = vendors.filter(v =>
        v.vendor_name.toLowerCase().includes(search.toLowerCase())
    );

    const selectVendor = (id) => {
        setSelectedId(id);
        setSelectedProjects([]);
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
                    <button
                        onClick={handleShare}
                        disabled={shareLoading}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-indigo-50 text-indigo-600 hover:bg-indigo-100 transition-colors disabled:opacity-50 shrink-0"
                        title="Copy shareable report link"
                    >
                        {shareCopied ? <Check className="w-3.5 h-3.5" /> : <Share2 className="w-3.5 h-3.5" />}
                        {shareCopied ? 'Copied!' : 'Share Report'}
                    </button>
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
                <ChartCard title="Index Rate" className="lg:col-span-2">
                    <div className="flex gap-4 min-h-[200px]">
                        {/* Left 2/5 — semicircle gauge */}
                        <div className="flex flex-col items-center justify-center w-2/5 shrink-0 border-r border-slate-100 pr-4">
                            <IndexGauge indexRate={stats.indexRate} />
                        </div>
                        {/* Right 3/5 — indexed_status breakdown */}
                        <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Status Breakdown</p>
                            <IndexStatusBreakdown data={stats.indexStatusBreakdown || []} />
                        </div>
                    </div>
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

            {/* Row 4: Published Placements by Category */}
            <ChartCard title="Published Placements by Category">
                {!stats.publishedPerCategory || stats.publishedPerCategory.length === 0
                    ? <EmptyState label="No published placements yet" />
                    : (
                        <ResponsiveContainer width="100%" height={220}>
                            <BarChart data={stats.publishedPerCategory} margin={{ top: 5, right: 20, bottom: 30, left: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                                <XAxis dataKey="category" tick={{ fontSize: 10 }} angle={-30} textAnchor="end" interval={0} />
                                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                                <Tooltip formatter={(v) => [v, 'Published']} />
                                <Bar dataKey="count" radius={[3, 3, 0, 0]} name="Published">
                                    {stats.publishedPerCategory.map((_, i) => (
                                        <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    )
                }
            </ChartCard>

            {/* Row 5: Cost Per Project + Vendor Participation — shared project filter */}
            {(() => {
                const cpp = stats.costPerProject || { data: [], categories: [] };
                const vcp = stats.vendorCostPerProject || { data: [], vendorNames: [] };
                const projectNames = cpp.data.map(d => d.projectName);
                const filteredCpp = selectedProjects.length ? cpp.data.filter(d => selectedProjects.includes(d.projectName)) : cpp.data;
                const filteredVcp = selectedProjects.length ? vcp.data.filter(d => selectedProjects.includes(d.projectName)) : vcp.data;

                return (
                    <div className="space-y-4">
                        {/* Project Filter — searchable multi-select */}
                        {projectNames.length > 0 && (
                            <ProjectMultiSelect
                                options={projectNames}
                                value={selectedProjects}
                                onChange={setSelectedProjects}
                            />
                        )}

                        <ProjectCostChart
                            title="Cost Per Project"
                            data={filteredCpp}
                            seriesKeys={cpp.categories}
                            stackId="cpp"
                            emptyLabel="No project cost data"
                            summaryNoun="category"
                        />

                        <ProjectCostChart
                            title="Vendor Participation Per Project"
                            data={filteredVcp}
                            seriesKeys={vcp.vendorNames}
                            stackId="vcp"
                            emptyLabel="No vendor participation data"
                            summaryNoun="vendor"
                        />
                    </div>
                );
            })()}

            {/* Row 6: Anchor Text + Placement Status */}
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

                <ChartCard title="Published Status">
                    {!stats.publishedStatusDist || stats.publishedStatusDist.length === 0
                        ? <EmptyState label="No placements" />
                        : (
                            <>
                                <ResponsiveContainer width="100%" height={160}>
                                    <PieChart>
                                        <Pie data={stats.publishedStatusDist} dataKey="count" innerRadius={40} outerRadius={65} strokeWidth={0}>
                                            {stats.publishedStatusDist.map((entry) => (
                                                <Cell key={entry.status} fill={entry.status === 'Published' ? '#10b981' : '#cbd5e1'} />
                                            ))}
                                        </Pie>
                                        <Tooltip formatter={(v, n, p) => [v, p.payload.status]} />
                                    </PieChart>
                                </ResponsiveContainer>
                                <div className="space-y-1.5 mt-2">
                                    {stats.publishedStatusDist.map((entry) => (
                                        <div key={entry.status} className="flex items-center gap-2 text-xs">
                                            <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: entry.status === 'Published' ? '#10b981' : '#cbd5e1' }} />
                                            <span className="text-slate-600">{entry.status}</span>
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
