
-- Create storage bucket for backups (private, not public)
INSERT INTO storage.buckets (id, name, public) VALUES ('backups', 'backups', false);

-- Create storage bucket for financial reports (private)
INSERT INTO storage.buckets (id, name, public) VALUES ('reports', 'reports', false);

-- Only admins can read from backups bucket
CREATE POLICY "Admins read backups"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'backups' AND public.has_role(auth.uid(), 'admin'::app_role));

-- Only service role (edge functions) can insert backups
CREATE POLICY "Service insert backups"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'backups' AND public.has_role(auth.uid(), 'admin'::app_role));

-- Only admins can read reports
CREATE POLICY "Admins read reports"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'reports' AND public.has_role(auth.uid(), 'admin'::app_role));

-- Service insert reports
CREATE POLICY "Service insert reports"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'reports' AND public.has_role(auth.uid(), 'admin'::app_role));

-- Enable pg_cron and pg_net extensions
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Create a table to track backup/export history
CREATE TABLE public.backup_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  backup_type text NOT NULL, -- 'full_backup' or 'financial_report'
  file_path text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  created_by text, -- 'system' or user_id
  file_size bigint,
  month_ref text -- for financial reports: 'YYYY-MM'
);

ALTER TABLE public.backup_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read backup history"
ON public.backup_history
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins insert backup history"
ON public.backup_history
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
