import React, { useState, useEffect, useRef } from 'react';
import { getSupabase } from '../../services/supabaseClient';
import { Customer } from '../../types';

const supabase = getSupabase();

interface CustomerSelectProps {
    value: string; // customerId
    onChange: (customerId: string, customer: Customer | null) => void;
    className?: string;
    required?: boolean;
    label?: string;
}

export const CustomerSelect: React.FC<CustomerSelectProps> = ({
    value,
    onChange,
    className = '',
    required = false,
    label = 'Customer'
}) => {
    const [query, setQuery] = useState('');
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [isOpen, setIsOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const wrapperRef = useRef<HTMLDivElement>(null);

    // Fetch specific customer when value changes (for initial load)
    useEffect(() => {
        const fetchInitial = async () => {
            if (!value) {
                setQuery('');
                return;
            }

            // If we already have the customer in the list, just set name
            const found = customers.find(c => c.id === value);
            if (found) {
                setQuery(found.customer_name || '');
                return;
            }

            const { data } = await supabase
                .from('customers')
                .select('*')
                .eq('id', value)
                .single();

            if (data) {
                setQuery(data.customer_name || '');
                // We typically don't add to list to avoid clutter, 
                // but for a select it might be good. 
                // For now just setting the display query.
            }
        };
        fetchInitial();
    }, [value]);

    // Search customers
    useEffect(() => {
        const searchCustomers = async () => {
            setLoading(true);
            const { data, error } = await supabase
                .from('customers')
                .select('*')
                .or(`customer_name.ilike.%${query}%,customer_code.ilike.%${query}%`)
                .limit(20);

            if (!error && data) {
                setCustomers(data);
            }
            setLoading(false);
        };

        const timer = setTimeout(() => {
            if (isOpen) searchCustomers();
        }, 300);

        return () => clearTimeout(timer);
    }, [query, isOpen]);

    // Close on click outside
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, [wrapperRef]);

    const handleSelect = (customer: Customer) => {
        setQuery(customer.customer_name || '');
        onChange(customer.id, customer);
        setIsOpen(false);
    };

    return (
        <div className={`relative ${className}`} ref={wrapperRef}>
            {label && <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>}
            <input
                type="text"
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                placeholder="Search customer..."
                value={query}
                onChange={(e) => {
                    setQuery(e.target.value);
                    setIsOpen(true);
                    if (e.target.value === '') {
                        onChange('', null);
                    }
                }}
                onFocus={() => setIsOpen(true)}
            />

            {isOpen && customers.length > 0 && (
                <ul className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-60 overflow-auto">
                    {loading ? (
                        <li className="px-4 py-2 text-gray-500">Loading...</li>
                    ) : (
                        customers.map((c) => (
                            <li
                                key={c.id}
                                className="px-4 py-2 hover:bg-blue-50 cursor-pointer text-sm"
                                onClick={() => handleSelect(c)}
                            >
                                <div className="font-bold">{c.customer_name}</div>
                                <div className="text-xs text-gray-500">
                                    {c.customer_code} {c.rank_id && <span className="ml-2 bg-gray-200 px-1 rounded text-[10px]">Rank: {c.rank_id}</span>}
                                </div>
                            </li>
                        ))
                    )}
                </ul>
            )}
        </div>
    );
};
