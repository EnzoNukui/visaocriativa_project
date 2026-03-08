
-- Add import_batch_id to orders so we can link orders to import batches
ALTER TABLE public.orders ADD COLUMN import_batch_id uuid REFERENCES public.import_logs(id) ON DELETE SET NULL;

-- Supplier needs to read import_logs for batch list (currently admin-only)
CREATE POLICY "Suppliers read import logs"
ON public.import_logs
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'supplier'::app_role));
