import React, { useState, useEffect, useRef } from 'react';
import { Lead, LeadStatus, Toast, ConfirmationDialogProps, EmployeeUser, LeadScore, CompanyInvestigation, CustomProposalContent, LeadProposalPackage, EstimateStatus } from '../../types';
import { X, Save, Loader, Pencil, Trash2, Mail, CheckCircle, Lightbulb, Search, FileText } from '../Icons';
import LeadStatusBadge from './LeadStatusBadge';
import { INQUIRY_TYPES } from '../../constants';
import LeadScoreBadge from '../ui/LeadScoreBadge';
import { createLeadProposalPackage, generateLeadSummary, investigateLeadCompany } from '../../services/geminiService';
import ProposalPdfContent from './ProposalPdfContent';
import { formatDateTime, formatJPY, generateMultipagePdf } from '../../utils';
import InvestigationReportPdfContent from '../reports/InvestigationReportPdfContent';
import { sendEmail } from '../../services/emailService';
import { EmailStatusIndicator } from './EmailStatusIndicator';

// Reusable Detail Section Component
export const DetailSection: React.FC<{ 
    title: string; 
    children: React.ReactNode; 
    className?: string 
}> = ({ title, children, className = '' }) => (
    <div className={`pt-4 ${className}`}>
        <h3 className="text-base font-semibold text-slate-600 dark:text-slate-300 mb-4">{title}</h3>
        <div className="space-y-4">
            {children}
        </div>
    </div>
);

// Reusable Field Component
export const Field: React.FC<{
    label: string;
    name: string;
    value: string | string[] | null | undefined;
    isEditing: boolean;
    onChange: (e: React.ChangeEvent<any>) => void;
    type?: 'text' | 'email' | 'select' | 'textarea';
    options?: any[];
    className?: string;
}> = ({ label, name, value, isEditing, onChange, type = 'text', options = [], className = '' }) => {
    const inputClass = "w-full bg-slate-50 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 text-slate-900 dark:text-white rounded-lg p-2.5 focus:ring-blue-500 focus:border-blue-500";
    
    return (
        <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                {label}
            </label>
            {isEditing ? (
                type === 'textarea' ? (
                    <textarea
                        name={name}
                        value={value || ''}
                        onChange={onChange}
                        rows={4}
                        className={`${inputClass} resize-none ${className}`}
                    />
                ) : type === 'select' ? (
                    <select
                        name={name}
                        value={value || ''}
                        onChange={onChange}
                        className={`${inputClass} ${className}`}
                    >
                        {options.map((option) => (
                            <option key={option} value={option}>{option}</option>
                        ))}
                    </select>
                ) : (
                    <input
                        type={type}
                        name={name}
                        value={value || ''}
                        onChange={onChange}
                        className={`${inputClass} ${className}`}
                    />
                )
            ) : (
                <div className="text-slate-900 dark:text-white bg-slate-50 dark:bg-slate-700 rounded-lg p-2.5 min-h-[44px] flex items-center">
                    {Array.isArray(value) ? value.join(', ') : (value || '-')}
                </div>
            )}
        </div>
    );
};

// Reusable Summary Card Component
export const SummaryCard: React.FC<{
    title: string;
    children: React.ReactNode;
    className?: string;
}> = ({ title, children, className = '' }) => (
    <div className={`bg-white dark:bg-slate-800 rounded-lg p-3 ${className}`}>
        <div className="text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">{title}</div>
        {children}
    </div>
);

// Reusable AI Tab Component
export const AITab: React.FC<{
    title: string;
    isActive: boolean;
    onClick: () => void;
    disabled?: boolean;
    icon?: React.ReactNode;
}> = ({ title, isActive, onClick, disabled = false, icon }) => (
    <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        className={`px-2 py-1 text-xs font-semibold rounded-md transition-colors ${
            isActive 
                ? 'bg-white dark:bg-slate-800 shadow text-slate-900 dark:text-white' 
                : 'text-slate-500 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
        } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
    >
        {icon && <span className="mr-1">{icon}</span>}
        {title}
    </button>
);

// Reusable Status Indicator Component
export const StatusIndicator: React.FC<{
    label: string;
    status: 'success' | 'warning' | 'error' | 'info' | 'default';
    icon?: React.ReactNode;
    className?: string;
}> = ({ label, status, icon, className = '' }) => {
    const statusColors = {
        success: 'bg-green-100 text-green-800 border-green-200',
        warning: 'bg-amber-100 text-amber-800 border-amber-200',
        error: 'bg-red-100 text-red-800 border-red-200',
        info: 'bg-blue-100 text-blue-800 border-blue-200',
        default: 'bg-slate-100 text-slate-800 border-slate-200'
    };

    return (
        <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium border ${statusColors[status]} ${className}`}>
            {icon}
            {label}
        </div>
    );
};

// Reusable Progress Step Component
export const ProgressStep: React.FC<{
    step: number;
    currentStep: number;
    title: string;
    completed?: boolean;
}> = ({ step, currentStep, title, completed = false }) => {
    const isActive = step === currentStep;
    const isCompleted = completed || step < currentStep;

    return (
        <div className="flex items-center gap-3">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold ${
                isCompleted 
                    ? 'bg-green-500 text-white' 
                    : isActive 
                    ? 'bg-blue-500 text-white' 
                    : 'bg-gray-300 text-gray-600'
            }`}>
                {isCompleted ? '✓' : step}
            </div>
            <div className={`text-sm ${isActive ? 'font-semibold text-slate-900' : 'text-slate-500'}`}>
                {title}
            </div>
        </div>
    );
};

// Reusable Action Button Component
export const ActionButton: React.FC<{
    children: React.ReactNode;
    onClick?: () => void;
    variant?: 'primary' | 'secondary' | 'danger' | 'success';
    disabled?: boolean;
    loading?: boolean;
    icon?: React.ReactNode;
    className?: string;
}> = ({ children, onClick, variant = 'primary', disabled = false, loading = false, icon, className = '' }) => {
    const variantStyles = {
        primary: 'bg-blue-600 text-white hover:bg-blue-700 disabled:bg-slate-400',
        secondary: 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600',
        danger: 'bg-red-600 text-white hover:bg-red-700 disabled:bg-slate-400',
        success: 'bg-green-600 text-white hover:bg-green-700 disabled:bg-slate-400'
    };

    return (
        <button
            onClick={onClick}
            disabled={disabled || loading}
            className={`flex items-center gap-2 font-semibold py-2 px-4 rounded-lg transition-colors ${variantStyles[variant]} ${className}`}
        >
            {loading && <Loader className="w-4 h-4 animate-spin" />}
            {icon && <span>{icon}</span>}
            {children}
        </button>
    );
};

// Reusable Loading Spinner Component
export const LoadingSpinner: React.FC<{
    size?: 'sm' | 'md' | 'lg';
    className?: string;
}> = ({ size = 'md', className = '' }) => {
    const sizeClasses = {
        sm: 'w-4 h-4',
        md: 'w-6 h-6',
        lg: 'w-8 h-8'
    };

    return (
        <Loader className={`${sizeClasses[size]} animate-spin text-blue-600 ${className}`} />
    );
};

// Reusable Empty State Component
export const EmptyState: React.FC<{
    title: string;
    description?: string;
    icon?: React.ReactNode;
    action?: React.ReactNode;
}> = ({ title, description, icon, action }) => (
    <div className="text-center py-12">
        {icon && <div className="text-slate-400 mb-4">{icon}</div>}
        <h3 className="text-lg font-medium text-slate-900 dark:text-white mb-2">{title}</h3>
        {description && <p className="text-slate-500 dark:text-slate-400 mb-4">{description}</p>}
        {action && <div className="mt-4">{action}</div>}
    </div>
);

// Reusable Badge Component
export const Badge: React.FC<{
    children: React.ReactNode;
    variant?: 'default' | 'primary' | 'success' | 'warning' | 'danger';
    size?: 'sm' | 'md' | 'lg';
    className?: string;
}> = ({ children, variant = 'default', size = 'md', className = '' }) => {
    const variantStyles = {
        default: 'bg-slate-100 text-slate-800',
        primary: 'bg-blue-100 text-blue-800',
        success: 'bg-green-100 text-green-800',
        warning: 'bg-amber-100 text-amber-800',
        danger: 'bg-red-100 text-red-800'
    };

    const sizeStyles = {
        sm: 'px-2 py-1 text-xs',
        md: 'px-3 py-1 text-sm',
        lg: 'px-4 py-2 text-base'
    };

    return (
        <span className={`inline-flex items-center rounded-full font-medium ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}>
            {children}
        </span>
    );
};

// Reusable Card Component
export const Card: React.FC<{
    children: React.ReactNode;
    className?: string;
    hover?: boolean;
}> = ({ children, className = '', hover = false }) => (
    <div className={`bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 ${hover ? 'hover:shadow-md transition-shadow' : ''} ${className}`}>
        {children}
    </div>
);

// Reusable Grid Layout Component
export const Grid: React.FC<{
    children: React.ReactNode;
    cols?: number | string;
    gap?: number | string;
    className?: string;
}> = ({ children, cols = 1, gap = 4, className = '' }) => {
    const gridCols = typeof cols === 'number' ? `grid-cols-${cols}` : cols;
    const gridGap = typeof gap === 'number' ? `gap-${gap}` : gap;

    return (
        <div className={`grid ${gridCols} ${gridGap} ${className}`}>
            {children}
        </div>
    );
};

// Reusable Flex Layout Component
export const Flex: React.FC<{
    children: React.ReactNode;
    direction?: 'row' | 'col';
    align?: 'start' | 'center' | 'end' | 'stretch';
    justify?: 'start' | 'center' | 'end' | 'between' | 'around' | 'evenly';
    gap?: number | string;
    className?: string;
}> = ({ children, direction = 'row', align = 'start', justify = 'start', gap = 4, className = '' }) => {
    const flexDirection = direction === 'col' ? 'flex-col' : 'flex-row';
    const alignItems = `items-${align}`;
    const justifyContent = `justify-${justify}`;
    const flexGap = typeof gap === 'number' ? `gap-${gap}` : gap;

    return (
        <div className={`flex ${flexDirection} ${alignItems} ${justifyContent} ${flexGap} ${className}`}>
            {children}
        </div>
    );
};

// Reusable Container Component
export const Container: React.FC<{
    children: React.ReactNode;
    size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
    className?: string;
}> = ({ children, size = 'md', className = '' }) => {
    const sizeClasses = {
        sm: 'max-w-2xl',
        md: 'max-w-4xl',
        lg: 'max-w-6xl',
        xl: 'max-w-7xl',
        full: 'max-w-full'
    };

    return (
        <div className={`mx-auto px-4 ${sizeClasses[size]} ${className}`}>
            {children}
        </div>
    );
};

// Reusable Modal Component
export const Modal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    title: string;
    children: React.ReactNode;
    size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
    className?: string;
}> = ({ isOpen, onClose, title, children, size = 'md', className = '' }) => {
    if (!isOpen) return null;

    const sizeClasses = {
        sm: 'max-w-2xl',
        md: 'max-w-4xl',
        lg: 'max-w-6xl',
        xl: 'max-w-7xl',
        full: 'max-w-full'
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50 p-4">
            <div className={`${sizeClasses[size]} w-full bg-white dark:bg-slate-800 rounded-2xl shadow-2xl ${className}`}>
                <div className="flex justify-between items-center p-4 border-b border-slate-200 dark:border-slate-700">
                    <h2 className="text-xl font-bold text-slate-900 dark:text-white">{title}</h2>
                    <button
                        onClick={onClose}
                        className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                    >
                        <X className="w-6 h-6" />
                    </button>
                </div>
                <div className="p-4">
                    {children}
                </div>
            </div>
        </div>
    );
};

// Export all components as a namespace for easier importing
export const DetailComponents = {
    DetailSection,
    Field,
    SummaryCard,
    AITab,
    StatusIndicator,
    ProgressStep,
    ActionButton,
    LoadingSpinner,
    EmptyState,
    Badge,
    Card,
    Grid,
    Flex,
    Container,
    Modal
};

// Default export for convenience
export default DetailComponents;
