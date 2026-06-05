'use client';

import { useState } from 'react';
import TriageStrip from './TriageStrip';
import TodaysFocus from './TodaysFocus';

export default function DashboardTriage({ overdue, dueToday, newAssignments, pendingIndex, vendorName, vendorUuid }) {
    const [activeFilter, setActiveFilter] = useState('overdue');
    const [isCollapsed, setIsCollapsed] = useState(true);

    function handleToggleCollapsed() {
        setIsCollapsed(prev => !prev);
    }

    const counts = {
        overdue: overdue.length,
        'due-today': dueToday.length,
        new: newAssignments.length,
        'pending-index': pendingIndex.length,
    };

    function handleSelect(key) {
        setActiveFilter(prev => (prev === key ? null : key));
    }

    const filteredData = activeFilter
        ? {
            overdue: activeFilter === 'overdue' ? overdue : [],
            dueToday: activeFilter === 'due-today' ? dueToday : [],
            newAssignments: activeFilter === 'new' ? newAssignments : [],
            pendingIndex: activeFilter === 'pending-index' ? pendingIndex : [],
        }
        : { overdue, dueToday, newAssignments, pendingIndex };

    return (
        <>
            <TriageStrip
                counts={counts}
                activeFilter={activeFilter}
                onSelect={handleSelect}
                isCollapsed={isCollapsed}
                onToggleCollapsed={handleToggleCollapsed}
            />
            {!isCollapsed && (
                <TodaysFocus
                    overdue={filteredData.overdue}
                    dueToday={filteredData.dueToday}
                    newAssignments={filteredData.newAssignments}
                    pendingIndex={filteredData.pendingIndex}
                    vendorName={vendorName}
                    vendorUuid={vendorUuid}
                />
            )}
        </>
    );
}
