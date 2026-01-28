DROP FUNCTION IF EXISTS public.get_payables(text);
DROP FUNCTION IF EXISTS public.get_receivables(text);

NOTIFY pgrst, 'reload schema';
