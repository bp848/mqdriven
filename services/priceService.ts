import { getSupabase } from './supabaseClient';
import type { Customer, Product, PriceList } from '../types';

const supabase = getSupabase();

export const priceService = {
    /**
     * Calculate the applicable price for a product based on customer and their rank.
     * Priority:
     * 1. Customer Specific Price (price_lists with customer_id)
     * 2. Rank Specific Price (price_lists with rank_id)
     * 3. Product Standard Price (products.standard_price)
     */
    async getPrice(productId: string, customerId: string): Promise<{ price: number; source: 'customer' | 'rank' | 'standard' | 'none' }> {
        try {
            // 1. Fetch Customer to get Rank
            const { data: customer, error: customerError } = await supabase
                .from('customers')
                .select('rank_id')
                .eq('id', customerId)
                .single();

            if (customerError) {
                console.error('Error fetching customer:', customerError);
                // Fallback to minimal logic if customer fetch fails (though unlikely)
            }

            const rankId = customer?.rank_id;

            // 2. Fetch all applicable price lists for this product
            // We want prices where (customer_id = X) OR (rank_id = Y)
            let query = supabase
                .from('price_lists')
                .select('*')
                .eq('product_id', productId);

            if (rankId) {
                query = query.or(`customer_id.eq.${customerId},rank_id.eq.${rankId}`);
            } else {
                query = query.eq('customer_id', customerId);
            }

            const { data: priceLists, error: priceError } = await query;

            if (priceError) {
                console.error('Error fetching price lists:', priceError);
                return { price: 0, source: 'none' };
            }

            // Check for Customer Specific Price
            const customerPrice = priceLists?.find(p => p.customer_id === customerId);
            if (customerPrice) {
                return { price: Number(customerPrice.price), source: 'customer' };
            }

            // Check for Rank Specific Price
            const rankPrice = priceLists?.find(p => p.rank_id === rankId);
            if (rankPrice) {
                return { price: Number(rankPrice.price), source: 'rank' };
            }

            // 3. Fallback to Standard Price
            const { data: product, error: productError } = await supabase
                .from('products')
                .select('standard_price')
                .eq('id', productId)
                .single();

            if (productError || !product) {
                return { price: 0, source: 'none' };
            }

            return { price: Number(product.standard_price), source: 'standard' };

        } catch (error) {
            console.error('Unexpected error in getPrice:', error);
            return { price: 0, source: 'none' };
        }
    },

    /**
     * Fetch all products for selection
     */
    async getProducts(): Promise<Product[]> {
        const { data, error } = await supabase
            .from('products')
            .select('*')
            .eq('is_active', true)
            .order('code', { ascending: true });

        if (error) {
            console.error('Error fetching products:', error);
            return [];
        }
        return data || [];
    },

    /**
     * Fetch all ranks
     */
    async getRanks() {
        const { data, error } = await supabase
            .from('customer_ranks')
            .select('*')
            .order('id', { ascending: true }); // S, A, B, C order usually works alphabetically or needs custom sort

        if (error) {
            console.error('Error fetching ranks:', error);
            return [];
        }
        return data || [];
    }
};
