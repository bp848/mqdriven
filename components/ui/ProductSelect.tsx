import React, { useState, useEffect, useRef } from 'react';
import { getSupabase } from '../../services/supabaseClient';
import { Product } from '../../types';

const supabase = getSupabase();

interface ProductSelectProps {
    value: string; // productId
    onChange: (productId: string, product: Product | null) => void;
    className?: string;
    required?: boolean;
    label?: string;
}

export const ProductSelect: React.FC<ProductSelectProps> = ({
    value,
    onChange,
    className = '',
    required = false,
    label = 'Product'
}) => {
    const [query, setQuery] = useState('');
    const [products, setProducts] = useState<Product[]>([]);
    const [isOpen, setIsOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const wrapperRef = useRef<HTMLDivElement>(null);

    // Fetch specific product when value changes (for initial load)
    useEffect(() => {
        const fetchInitial = async () => {
            if (!value) {
                setQuery('');
                return;
            }

            const found = products.find(p => p.id === value);
            if (found) {
                setQuery(found.name || '');
                return;
            }

            const { data } = await supabase
                .from('products')
                .select('*')
                .eq('id', value)
                .single();

            if (data) {
                setQuery(data.name || '');
            }
        };
        fetchInitial();
    }, [value]);

    // Search products
    useEffect(() => {
        const searchProducts = async () => {
            setLoading(true);
            const { data, error } = await supabase
                .from('products')
                .select('*')
                .ilike('name', `%${query}%`)
                .limit(20);

            if (!error && data) {
                setProducts(data);
            }
            setLoading(false);
        };

        const timer = setTimeout(() => {
            if (isOpen) searchProducts();
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

    const handleSelect = (product: Product) => {
        setQuery(product.name || '');
        onChange(product.id, product);
        setIsOpen(false);
    };

    return (
        <div className={`relative ${className}`} ref={wrapperRef}>
            {label && <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>}
            <input
                type="text"
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                placeholder="Search product..."
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

            {isOpen && products.length > 0 && (
                <ul className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-60 overflow-auto">
                    {loading ? (
                        <li className="px-4 py-2 text-gray-500">Loading...</li>
                    ) : (
                        products.map((p) => (
                            <li
                                key={p.id}
                                className="px-4 py-2 hover:bg-blue-50 cursor-pointer text-sm border-b last:border-b-0"
                                onClick={() => handleSelect(p)}
                            >
                                <div className="font-bold">{p.name}</div>
                                <div className="flex justify-between text-xs text-gray-500">
                                    <span>{p.code}</span>
                                    <span>¥{p.standard_price?.toLocaleString()}</span>
                                </div>
                            </li>
                        ))
                    )}
                </ul>
            )}
        </div>
    );
};
