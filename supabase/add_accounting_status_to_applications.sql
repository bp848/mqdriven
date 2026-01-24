-- applications繝・・繝悶Ν縺ｫ莨夊ｨ医せ繝・・繧ｿ繧ｹ繧ｫ繝ｩ繝繧定ｿｽ蜉
ALTER TABLE public.applications
ADD COLUMN IF NOT EXISTS accounting_status TEXT NOT NULL DEFAULT 'none';

COMMENT ON COLUMN public.applications.accounting_status IS '莨夊ｨ亥・逅・せ繝・・繧ｿ繧ｹ (none: 譛ｪ蜃ｦ逅・ draft: 莉戊ｨｳ菴懈・貂・ posted: 霆｢險俶ｸ・';

-- 繝代ヵ繧ｩ繝ｼ繝槭Φ繧ｹ蜷台ｸ翫・縺溘ａ縺ｫ繧､繝ｳ繝・ャ繧ｯ繧ｹ繧剃ｽ懈・
CREATE INDEX IF NOT EXISTS idx_applications_accounting_status
ON public.applications(accounting_status);
