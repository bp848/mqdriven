import React, { useState } from 'react';
import { Lead, LeadStatus } from '../../types.ts';
import LeadStatusBadge from './LeadStatusBadge.tsx';

interface LeadKanbanViewProps {
  leads: Lead[];
  onUpdateLead: (leadId: string, updatedData: Partial<Lead>) => Promise<void>;
  onCardClick: (lead: Lead) => void;
}

const COLUMNS_ORDER: LeadStatus[] = [
    LeadStatus.Untouched,
    LeadStatus.New,
    LeadStatus.Contacted,
    LeadStatus.Qualified,
    LeadStatus.Disqualified,
    LeadStatus.Converted,
    LeadStatus.Closed,
];

const LeadCard: React.FC<{ lead: Lead; onClick: () => void; }> = ({ lead, onClick }) => {
    const handleDragStart = (e: React.DragEvent<HTMLDivElement>) => {
        e.dataTransfer.setData('leadId', lead.id);
        e.currentTarget.style.opacity = '0.4';
    };

    const handleDragEnd = (e: React.DragEvent<HTMLDivElement>) => {
        e.currentTarget.style.opacity = '1';
    };

    return (
        <div
            draggable
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            onClick={onClick}
            className="bg-white dark:bg-slate-800 p-4 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 cursor-pointer hover:shadow-md hover:border-blue-500 dark:hover:border-blue-500 transition-all duration-200"
        >
            <h4 className="font-bold text-slate-800 dark:text-white">{lead.company}</h4>
            <p className="text-sm text-slate-600 dark:text-slate-300">{lead.name}</p>
            <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-700 flex justify-between items-center">
                <p className="text-xs text-slate-400">{lead.source}</p>
                <LeadStatusBadge status={lead.status} />
            </div>
        </div>
    );
};


const KanbanColumn: React.FC<{
    status: LeadStatus;
    leads: Lead[];
    onCardClick: (lead: Lead) => void;
    onDrop: (status: LeadStatus) => void;
}> = ({ status, leads, onCardClick, onDrop }) => {
    const [isDraggedOver, setIsDraggedOver] = useState(false);

    const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        setIsDraggedOver(true);
    };

    const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
        setIsDraggedOver(false);
    };
    
    const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        setIsDraggedOver(false);
        onDrop(status);
    };

    return (
        <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`w-80 flex-shrink-0 bg-slate-100 dark:bg-slate-900/50 rounded-xl p-3 transition-colors duration-200 ${isDraggedOver ? 'bg-blue-100 dark:bg-blue-900/50' : ''}`}
        >
            <div className="flex justify-between items-center mb-4 px-1">
                <h3 className="font-semibold text-slate-700 dark:text-slate-200">{status}</h3>
                <span className="text-sm font-bold bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 px-2 py-0.5 rounded-full">{leads.length}</span>
            </div>
            <div className="space-y-3 h-full overflow-y-auto">
                {leads.map(lead => (
                    <LeadCard key={lead.id} lead={lead} onClick={() => onCardClick(lead)} />
                ))}
            </div>
        </div>
    );
};

const LeadKanbanView: React.FC<LeadKanbanViewProps> = ({ leads, onUpdateLead, onCardClick }) => {

    const handleDrop = (newStatus: LeadStatus) => (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        const leadId = e.dataTransfer.getData('leadId');
        const droppedLead = leads.find(l => l.id === leadId);

        if (droppedLead && droppedLead.status !== newStatus) {
            onUpdateLead(leadId, { status: newStatus, updatedAt: new Date().toISOString() });
        }
    };
    
    const leadsByStatus = React.useMemo(() => {
        return COLUMNS_ORDER.reduce((acc, status) => {
            acc[status] = leads.filter(l => l.status === status);
            return acc;
        }, {} as Record<LeadStatus, Lead[]>);
    }, [leads]);

    return (
        <div className="flex gap-4 overflow-x-auto pb-4">
            {COLUMNS_ORDER.map(status => (
                <KanbanColumn
                    key={status}
                    status={status}
                    leads={leadsByStatus[status]}
                    onCardClick={onCardClick}
                    onDrop={(newStatus) => {
                        const leadId = (window as any).draggedLeadId;
                        if(leadId) {
                            const droppedLead = leads.find(l => l.id === leadId);
                            if (droppedLead && droppedLead.status !== newStatus) {
                                onUpdateLead(leadId, { status: newStatus, updatedAt: new Date().toISOString() });
                            }
                        }
                    }}
                />
            ))}
        </div>
    );
};

// Simplified KanbanView without complex drag-n-drop state management

const SimpleLeadKanbanView: React.FC<LeadKanbanViewProps> = ({ leads, onUpdateLead, onCardClick }) => {
    
    const handleDropOnColumn = (e: React.DragEvent<HTMLDivElement>, newStatus: LeadStatus) => {
        e.preventDefault();
        const leadId = e.dataTransfer.getData('leadId');
        const droppedLead = leads.find(l => l.id === leadId);
        
        if (droppedLead && droppedLead.status !== newStatus) {
            onUpdateLead(leadId, { status: newStatus, updatedAt: new Date().toISOString() });
        }
        e.currentTarget.classList.remove('bg-blue-100', 'dark:bg-blue-900/50');
    };

    const handleDragOverColumn = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.currentTarget.classList.add('bg-blue-100', 'dark:bg-blue-900/50');
    };

    const handleDragLeaveColumn = (e: React.DragEvent<HTMLDivElement>) => {
        e.currentTarget.classList.remove('bg-blue-100', 'dark:bg-blue-900/50');
    };

    const leadsByStatus = React.useMemo(() => {
        return COLUMNS_ORDER.reduce((acc, status) => {
            acc[status] = leads.filter(l => l.status === status);
            return acc;
        }, {} as Record<LeadStatus, Lead[]>);
    }, [leads]);

    return (
        <div className="flex gap-4 overflow-x-auto pb-4 -mx-4 px-4 sm:-mx-8 sm:px-8">
            {COLUMNS_ORDER.map(status => (
                <div
                    key={status}
                    onDrop={(e) => handleDropOnColumn(e, status)}
                    onDragOver={handleDragOverColumn}
                    onDragLeave={handleDragLeaveColumn}
                    className="w-80 flex-shrink-0 bg-slate-100 dark:bg-slate-900/50 rounded-xl p-3 transition-colors duration-200 flex flex-col"
                >
                    <div className="flex justify-between items-center mb-4 px-1 flex-shrink-0">
                        <h3 className="font-semibold text-slate-700 dark:text-slate-200">{status}</h3>
                        <span className="text-sm font-bold bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 px-2 py-0.5 rounded-full">{leadsByStatus[status].length}</span>
                    </div>
                    <div className="space-y-3 flex-grow overflow-y-auto pr-1">
                        {leadsByStatus[status].map(lead => (
                            <LeadCard key={lead.id} lead={lead} onClick={() => onCardClick(lead)} />
                        ))}
                    </div>
                </div>
            ))}
        </div>
    );
};

export default SimpleLeadKanbanView;