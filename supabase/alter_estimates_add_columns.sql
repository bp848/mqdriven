-- Adds missing columns to public.estimates. Safe to rerun.
ALTER TABLE public.estimates
  ADD COLUMN IF NOT EXISTS delivery_date text,
  ADD COLUMN IF NOT EXISTS status text,
  ADD COLUMN IF NOT EXISTS subtotal text;
