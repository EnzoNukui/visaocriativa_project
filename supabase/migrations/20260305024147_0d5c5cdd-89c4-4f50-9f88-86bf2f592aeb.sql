
CREATE TABLE public.import_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  imported_by uuid NOT NULL,
  imported_at timestamptz NOT NULL DEFAULT now(),
  file_name text NOT NULL,
  total_rows integer NOT NULL DEFAULT 0,
  total_success integer NOT NULL DEFAULT 0,
  total_errors integer NOT NULL DEFAULT 0
);

ALTER TABLE public.import_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage import logs"
  ON public.import_logs
  FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
