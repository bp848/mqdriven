
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error('Supabase credentials missing in env');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function checkConsistency() {
    console.log('--- Checking Customer Consistency ---');

    // 1. Fetch projects and their customer links from the view used by Ranking
    const { data: rankingData, error: rankingError } = await supabase
        .from('project_financials_view')
        .select('project_name, customer_id');

    if (rankingError) {
        console.error('Error fetching project_financials_view:', rankingError.message);
        return;
    }

    // 2. Fetch all customers from master
    const { data: masterCustomers, error: masterError } = await supabase
        .from('customers')
        .select('id, customer_name, customer_code');

    if (masterError) {
        console.error('Error fetching customers master:', masterError.message);
        return;
    }

    const masterMap = new Map();
    masterCustomers.forEach(c => masterMap.set(c.id, c));

    console.log(`Total projects in ranking view: ${rankingData.length}`);
    console.log(`Total customers in master: ${masterCustomers.length}`);

    const inconsistencies = [];
    const uniqueCustomerIdsInRanking = new Set();

    rankingData.forEach(p => {
        if (!p.customer_id) {
            inconsistencies.push({ project: p.project_name, reason: 'No customer_id associated' });
        } else {
            uniqueCustomerIdsInRanking.add(p.customer_id);
            if (!masterMap.has(p.customer_id)) {
                inconsistencies.push({ 
                    project: p.project_name, 
                    customer_id: p.customer_id, 
                    reason: 'Customer ID not found in master' 
                });
            }
        }
    });

    console.log('\n--- Results ---');
    if (inconsistencies.length === 0) {
        console.log('✅ All customers in the ranking view exist in the master table.');
    } else {
        console.warn(`❌ Found ${inconsistencies.length} inconsistencies:`);
        console.table(inconsistencies);
    }

    // Check for duplicate names or codes in master
    const names = new Set();
    const codes = new Set();
    const duplicates = [];
    masterCustomers.forEach(c => {
        if (names.has(c.customer_name)) duplicates.push(`Duplicate name: ${c.customer_name}`);
        names.add(c.customer_name);
        if (c.customer_code && codes.has(c.customer_code)) duplicates.push(`Duplicate code: ${c.customer_code}`);
        if (c.customer_code) codes.add(c.customer_code);
    });

    if (duplicates.length > 0) {
        console.warn('\n--- Master Table Warnings ---');
        duplicates.forEach(d => console.log(d));
    }
}

checkConsistency();
