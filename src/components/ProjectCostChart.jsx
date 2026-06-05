'use client';

import { useState } from 'react';
import { X } from 'lucide-react';
import {
    ResponsiveContainer, BarChart, Bar,
    XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from 'recharts';

const PALETTE = ['#6366f1', '#22d3ee', '#f59e0b', '#10b981', '#f43f5e', '#8b5cf6', '#06b6d4', '#84cc16', '#f97316', '#ec4899'];

function EmptyState({ label }) {
    return <div className="flex items-center justify-center h-40 text-slate-300 text-sm">{label}</div>;
}

/**
 * Stacked bar chart with a click-to-show summary side panel.
 *
 * @param {string}   title
 * @param {object[]} data          - already-filtered chart rows; each row has { projectName, [seriesKey]: cost, totalCost }
 * @param {string[]} seriesKeys    - ordered list of series keys (categories or vendor names)
 * @param {string}   stackId       - recharts stackId string (keeps stacks isolated when two charts share a page)
 * @param {string}   emptyLabel
 * @param {string}   summaryNoun   - "category" | "vendor" — shown in panel footer
 */
export default function ProjectCostChart({ title, data, seriesKeys, stackId, emptyLabel, summaryNoun = 'category' }) {
    const [selected, setSelected] = useState(null); // projectName string | null

    function handleBarClick(chartState) {
        const name = chartState?.activeLabel;
        if (!name) return;
        setSelected(prev => (prev === name ? null : name));
    }

    const selectedRow = selected ? data.find(d => d.projectName === selected) : null;

    const breakdown = selectedRow
        ? seriesKeys
            .map((key, i) => ({ key, color: PALETTE[i % PALETTE.length], value: selectedRow[key] || 0 }))
            .filter(s => s.value > 0)
            .sort((a, b) => b.value - a.value)
        : [];

    const totalCost = selectedRow?.totalCost ?? 0;

    // Tighten right margin when panel is open (legend hidden in panel-open state to avoid clutter)
    const chartMargin = selected
        ? { top: 5, right: 20, bottom: 55, left: 15 }
        : { top: 5, right: 160, bottom: 55, left: 15 };

    return (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
            <h3 className="text-sm font-bold text-slate-700 mb-4">{title}</h3>

            <div className="flex gap-4">
                {/* Chart — shrinks when panel is open */}
                <div className={selected ? 'flex-1 min-w-0' : 'w-full'}>
                    {data.length === 0 ? (
                        <EmptyState label={emptyLabel} />
                    ) : (
                        <ResponsiveContainer width="100%" height={280}>
                            <BarChart
                                data={data}
                                margin={chartMargin}
                                onClick={handleBarClick}
                                style={{ cursor: 'pointer' }}
                            >
                                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                                <XAxis
                                    dataKey="projectName"
                                    tick={{ fontSize: 10 }}
                                    angle={-20}
                                    textAnchor="end"
                                    interval={0}
                                    label={{ value: 'Project Name', position: 'insideBottom', offset: -10, style: { fontSize: 11, fill: '#94a3b8' } }}
                                />
                                <YAxis
                                    tick={{ fontSize: 11 }}
                                    tickFormatter={v => `$${v.toLocaleString()}`}
                                    label={{ value: 'Cost (USD)', angle: -90, position: 'insideLeft', offset: 10, style: { fontSize: 11, fill: '#94a3b8' } }}
                                />
                                <Tooltip formatter={(v, name) => [`$${Number(v).toLocaleString()}`, name]} />
                                {!selected && (
                                    <Legend
                                        layout="vertical"
                                        verticalAlign="middle"
                                        align="right"
                                        wrapperStyle={{ fontSize: 11, paddingLeft: 16 }}
                                    />
                                )}
                                {seriesKeys.map((key, i) => (
                                    <Bar
                                        key={key}
                                        dataKey={key}
                                        stackId={stackId}
                                        fill={PALETTE[i % PALETTE.length]}
                                        radius={i === seriesKeys.length - 1 ? [3, 3, 0, 0] : [0, 0, 0, 0]}
                                        cursor="pointer"
                                    />
                                ))}
                            </BarChart>
                        </ResponsiveContainer>
                    )}
                </div>

                {/* Summary panel — only visible when a bar is selected */}
                {selected && selectedRow && (
                    <div className="w-56 shrink-0 border-l border-slate-100 pl-4 flex flex-col gap-3">
                        {/* Header */}
                        <div className="flex items-start justify-between gap-2">
                            <p className="text-xs font-bold text-slate-700 leading-snug break-words">{selected}</p>
                            <button
                                onClick={() => setSelected(null)}
                                className="shrink-0 rounded-full p-0.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                                aria-label="Close summary"
                            >
                                <X className="w-3.5 h-3.5" />
                            </button>
                        </div>

                        {/* Total */}
                        <div>
                            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-0.5">Total Cost</p>
                            <p className="text-2xl font-black text-indigo-600">
                                ${totalCost.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                            </p>
                        </div>

                        {/* Breakdown */}
                        <div>
                            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5">Breakdown</p>
                            <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                                {breakdown.map(({ key, color, value }) => {
                                    const pct = totalCost > 0 ? Math.round((value / totalCost) * 100) : 0;
                                    return (
                                        <div key={key} className="flex items-center gap-1.5 text-xs">
                                            <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: color }} />
                                            <span className="text-slate-600 truncate flex-1" title={key}>{key}</span>
                                            <span className="font-bold text-slate-800 shrink-0">${Math.round(value).toLocaleString()}</span>
                                            <span className="text-slate-400 w-8 text-right shrink-0">{pct}%</span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Footer */}
                        <p className="text-[10px] text-slate-400 mt-auto">
                            {breakdown.length} {summaryNoun}{breakdown.length !== 1 ? 's' : ''}
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}
