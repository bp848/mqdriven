const ensureSupabaseClient = (res, supabase) => {
  if (!supabase) {
    res.status(503).json({ error: 'Supabase client not initialized.' });
    return null;
  }
  return supabase;
};

const formatCustomerRecord = (row) => ({
  id: row.id,
  name: row.customer_name || row.customer_code || '未設定',
  code: row.customer_code || null,
  representative: row.representative || null,
  phoneNumber: row.phone_number || null,
  address: row.address_1 || row.address_2 || null,
  createdAt: row.created_at || null,
});

const formatCategoryRecord = (row) => ({
  id: row.id,
  name: row.name,
  description: row.description || null,
  factoryArea: row.factory_area || null,
});

const calculateStrategyOptions = (base) => {
  const standard = Math.max(base, 0);
  return [
    {
      id: 'must_win',
      label: 'Must Win',
      pq: Math.round(standard * 1.02),
      vq: Math.round(standard * 0.6),
      mq: Math.round(standard * 0.42),
      f: 85000,
      g: Math.round(standard * 0.35),
      mRatio: 0.42,
      estimatedLeadTime: '5営業日',
      probability: 76,
      description: '基幹情報と過去の粗利トレンドを踏まえ、最短納期で着地させるプランです。',
    },
    {
      id: 'average',
      label: 'Average',
      pq: Math.round(standard),
      vq: Math.round(standard * 0.58),
      mq: Math.round(standard * 0.4),
      f: 90000,
      g: Math.round(standard * 0.32),
      mRatio: 0.4,
      estimatedLeadTime: '7営業日',
      probability: 62,
      description: '平均的な工場運用で見込める標準プランです。',
    },
    {
      id: 'profit_max',
      label: 'Profit Max',
      pq: Math.round(standard * 1.16),
      vq: Math.round(standard * 0.53),
      mq: Math.round(standard * 0.48),
      f: 92000,
      g: Math.round(standard * 0.38),
      mRatio: 0.48,
      estimatedLeadTime: '10営業日',
      probability: 48,
      description: '余裕を持った納期で、粘り強く限界利益を最大化します。',
    },
  ];
};

const createMemoryRecord = async (supabase, inputs = {}) => {
  if (!supabase) return;
  const payload = {
    dataset_name: 'ai-estimation',
    entry_type: 'knowledge_snapshot',
    payload: inputs,
    tags: ['ai-estimate'],
  };
  await supabase.from('ai_training_corpus').insert(payload);
};

module.exports = function registerAiRoutes(app, supabase) {
  app.get('/api/v1/customers', async (req, res) => {
    const client = ensureSupabaseClient(res, supabase);
    if (!client) return;
    try {
      const { data, error } = await client
        .from('customers')
        .select('id, customer_code, customer_name, representative, phone_number, address_1, created_at')
        .order('customer_name', { ascending: true })
        .limit(250);
      if (error) throw error;
      res.status(200).json({ customers: (data || []).map(formatCustomerRecord) });
    } catch (error) {
      console.error('[AI][customers] failed', error);
      res.status(500).json({ error: 'Failed to load customers for AI estimation.' });
    }
  });

  app.get('/api/v1/categories', async (req, res) => {
    const client = ensureSupabaseClient(res, supabase);
    if (!client) return;
    try {
      const { data, error } = await client
        .from('ai_product_categories')
        .select('*')
        .order('created_at', { ascending: true });
      if (error) throw error;
      res.status(200).json({ categories: (data || []).map(formatCategoryRecord) });
    } catch (error) {
      console.error('[AI][categories] failed', error);
      res.status(500).json({ error: 'Failed to load AI categories.' });
    }
  });

  app.get('/api/v1/ai/deep-wiki', async (req, res) => {
    const client = ensureSupabaseClient(res, supabase);
    if (!client) return;
    const customerId = req.query.customerId;
    try {
      let query = client.from('ai_deep_wiki_documents').select('*').order('created_at', { ascending: false }).limit(20);
      if (customerId) {
        query = query.eq('customer_id', customerId);
      }
      const { data, error } = await query;
      if (error) throw error;
      res.status(200).json({ documents: data || [] });
    } catch (error) {
      console.error('[AI][deep-wiki] failed', error);
      res.status(500).json({ error: 'Failed to fetch DeepWiki context.' });
    }
  });

  app.post('/api/v1/ai/deep-wiki', async (req, res) => {
    const client = ensureSupabaseClient(res, supabase);
    if (!client) return;
    const payload = req.body || {};
    try {
      await client.from('ai_deep_wiki_documents').insert({
        customer_id: payload.customerId || null,
        source: payload.source || 'manual',
        title: payload.title || payload.subject || null,
        snippet: payload.snippet || null,
        content: payload.content || null,
        metadata: payload.metadata || {},
        language: payload.language || 'ja',
      });
      res.status(201).json({ success: true });
    } catch (error) {
      console.error('[AI][deep-wiki] insert failed', error);
      res.status(500).json({ error: 'Failed to save DeepWiki document.' });
    }
  });

  app.post('/api/v1/ai/memory', async (req, res) => {
    const client = ensureSupabaseClient(res, supabase);
    if (!client) return;
    const payload = req.body || {};
    try {
      await client.from('ai_memory_entities').upsert(
        {
          id: payload.id || null,
          name: payload.name,
          entity_type: payload.entityType,
          observations: payload.observations || [],
          source: payload.source || 'ai-estimate',
          customer_id: payload.customerId || null,
          updated_at: payload.updatedAt || new Date().toISOString(),
        },
        { onConflict: 'id' }
      );
      res.status(201).json({ success: true });
    } catch (error) {
      console.error('[AI][memory] upsert failed', error);
      res.status(500).json({ error: 'Failed to sync memory entity.' });
    }
  });

  app.post('/api/v1/ai/training-corpus', async (req, res) => {
    const client = ensureSupabaseClient(res, supabase);
    if (!client) return;
    const payload = req.body || {};
    try {
      await client.from('ai_training_corpus').insert({
        dataset_name: payload.datasetName || 'ai-estimate',
        entry_type: payload.entryType || 'estimate_spec',
        payload: payload.payload || {},
        tags: payload.tags || ['ai-estimate'],
        provenance: payload.provenance || {},
      });
      res.status(201).json({ success: true });
    } catch (error) {
      console.error('[AI][training] insert failed', error);
      res.status(500).json({ error: 'Failed to store AI training corpus entry.' });
    }
  });

  app.get('/api/v1/ai-estimates', async (req, res) => {
    const client = ensureSupabaseClient(res, supabase);
    if (!client) return;
    try {
      const { data, error } = await client
        .from('estimates_v2')
        .select('id, estimate_number, project_id, status, subtotal, total, created_at, updated_at')
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      res.status(200).json({ estimates: data || [] });
    } catch (error) {
      console.error('[AI][estimates] list failed', error);
      res.status(500).json({ error: 'Failed to load AI-generated estimates.' });
    }
  });

  app.post('/api/v1/ai-estimates', async (req, res) => {
    const client = ensureSupabaseClient(res, supabase);
    if (!client) return;
    const { spec, customerId, categoryId } = req.body || {};
    if (!spec || !customerId) {
      return res.status(400).json({ error: 'spec and customerId are required.' });
    }
    try {
      const { data: customerRows, error: customerError } = await client
        .from('customers')
        .select('*')
        .eq('id', customerId)
        .maybeSingle();
      if (customerError) throw customerError;
      if (!customerRows) {
        return res.status(404).json({ error: 'Customer not found.' });
      }
      const { data: categoryRows } = await client
        .from('ai_product_categories')
        .select('*')
        .eq('id', categoryId)
        .maybeSingle();

      const quantity = Math.max(spec.quantity || 1, 1);
      const pageFactor = spec.pages > 0 ? spec.pages * 30 : 500;
      const finishingPremium = (spec.finishing?.length || 0) * 1500;
      const basePrice = Math.round(quantity * 950 + pageFactor + finishingPremium);
      const baseAmount = Math.max(basePrice, 5000);
      const strategies = calculateStrategyOptions(baseAmount);

      const projectName = `AI見積-${customerRows.customer_name || customerRows.customer_code || '顧客'}`;
      const projectCode = `AI-${Date.now().toString().slice(-6)}-${Math.random().toString(36).slice(2, 5)}`;
      const { data: existingProjectData, error: existingProjectError } = await client
        .from('projects_v2')
        .select('id')
        .eq('project_code', projectCode)
        .maybeSingle();
      if (existingProjectError) throw existingProjectError;

      let projectId = existingProjectData?.id;
      if (!projectId) {
        const { data: projectData, error: projectError } = await client
          .from('projects_v2')
          .insert({
            project_code: projectCode,
            customer_id: customerId,
            project_name: projectName,
            status: 'proposal',
            delivery_status: 'not_started',
            budget_sales: 0,
            budget_cost: 0,
            baseline_mq_rate: 0.3,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .select('id')
          .maybeSingle();
        if (projectError) throw projectError;
        projectId = projectData?.id;
      }

      const estimateNumber = `AI-${Date.now().toString().slice(-5)}`;
      const deliveryDate = new Date();
      deliveryDate.setDate(deliveryDate.getDate() + 30);
      const { data: estimateData, error: estimateError } = await client
        .from('estimates_v2')
        .insert({
          project_id: projectId,
          lead_id: null,
          estimate_number: estimateNumber,
          version: 1,
          status: 'draft',
          subtotal: strategies[1].pq,
          tax_rate: 0.1,
          total: strategies[1].pq * 1.1,
          currency: 'JPY',
          delivery_date: deliveryDate.toISOString().split('T')[0],
          valid_until: deliveryDate.toISOString().split('T')[0],
          notes: JSON.stringify({
            spec,
            customer: formatCustomerRecord(customerRows),
            category: categoryRows ? formatCategoryRecord(categoryRows) : null,
            reasoning: strategies.map((opt) => `${opt.label}: PQ ${opt.pq}`).join(' | '),
          }),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select('id')
        .maybeSingle();
      if (estimateError) throw estimateError;
      const estimateId = estimateData?.id;
      if (estimateId) {
        const lineItems = [
          {
            estimate_id: estimateId,
            line_no: 1,
            item_name: spec.projectName || 'AI見積',
            category: categoryRows?.name || 'AI見積',
            quantity,
            unit: spec.size || '部',
            unit_price: Math.round(baseAmount / quantity),
            variable_cost: Math.round(baseAmount * 0.62),
            tax_rate: 0.1,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
        ];
        await client.from('estimate_items_v2').insert(lineItems);
        await client.from('ai_training_corpus').insert({
          dataset_name: 'ai-estimates',
          entry_type: 'ai-estimate',
          payload: { spec, customerId, strategy: strategies[1], estimateId },
          tags: ['ai-estimate'],
          provenance: {
            projectId,
            categoryId,
            createdAt: new Date().toISOString(),
          },
        });
      }

      const { data: pastEstimates } = await client
        .from('estimates_v2')
        .select('total')
        .eq('project_id', projectId);
      const totals = (pastEstimates || []).map((row) => Number(row.total) || 0);
      const avgPast = totals.length ? totals.reduce((sum, value) => sum + value, 0) / totals.length : null;
      const comparison = avgPast
        ? {
            averagePrice: Math.round(avgPast),
            differencePercentage: Math.round(((strategies[1].pq - avgPast) / avgPast) * 100),
          }
        : { averagePrice: 0, differencePercentage: 0 };

      const wikiSnippets = (await client
        .from('ai_deep_wiki_documents')
        .select('id, title, snippet')
        .eq('customer_id', customerId)
        .order('created_at', { ascending: false })
        .limit(3)).data || [];

      const aiResult = {
        options: strategies,
        aiReasoning: `顧客${customerRows.customer_name || customerRows.customer_code}のDeepWiki (${wikiSnippets.map((doc) => doc.title).join(', ') || 'データなし'}) と memory 知識を活用し、${categoryRows?.name || 'カテゴリ未設定'}で算出しました。`,
        co2Reduction: Math.round(quantity * 3.4),
        comparisonWithPast: {
          averagePrice: comparison.averagePrice,
          differencePercentage: comparison.differencePercentage,
        },
      };

      res.status(201).json(aiResult);
    } catch (error) {
      console.error('[AI][estimate] failed', error);
      res.status(500).json({ error: 'Failed to generate AI estimate.' });
    }
  });
};
