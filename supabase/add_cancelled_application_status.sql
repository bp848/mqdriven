-- Allow applicants to retract submissions by adding the missing enum value.
ALTER TYPE public.application_status ADD VALUE IF NOT EXISTS 'cancelled';
