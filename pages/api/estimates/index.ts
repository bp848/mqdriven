// pages/api/estimates/index.ts
import { NextApiRequest, NextApiResponse } from 'next';
import { createSupabaseBrowser } from '../../../lib/supabase';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { method } = req;

  switch (method) {
    case 'GET':
      return handleGetEstimates(req, res);
    case 'POST':
      return handleCreateEstimate(req, res);
    default:
      res.setHeader('Allow', 'GET, POST');
      res.status(405).json({ error: 'Method not allowed' });
  }
}

async function handleGetEstimates(req: NextApiRequest, res: NextApiResponse) {
  try {
    const supabase = createSupabaseBrowser();
    const { data, error } = await supabase
      .from('estimate_invoices')
      .select('*')
      .eq('document_type', 'estimate')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Estimates fetch error:', error);
      return res.status(500).json({ error: 'Failed to fetch estimates' });
    }

    res.status(200).json(data || []);
  } catch (error) {
    console.error('Estimates API error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

async function handleCreateEstimate(req: NextApiRequest, res: NextApiResponse) {
  try {
    const supabase = createSupabaseBrowser();
    const estimateData = req.body;

    const { data, error } = await supabase
      .from('estimate_invoices')
      .insert(estimateData)
      .select()
      .single();

    if (error) {
      console.error('Estimate creation error:', error);
      return res.status(500).json({ error: 'Failed to create estimate' });
    }

    res.status(201).json(data);
  } catch (error) {
    console.error('Estimate creation API error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
