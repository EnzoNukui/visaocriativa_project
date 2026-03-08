
-- Create import_batches table
CREATE TABLE public.import_batches (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  batch_number text NOT NULL UNIQUE,
  imported_by uuid NOT NULL,
  imported_at timestamptz NOT NULL DEFAULT now(),
  file_name text NOT NULL,
  total_rows_read integer NOT NULL DEFAULT 0,
  total_errors integer NOT NULL DEFAULT 0,
  total_orders integer NOT NULL DEFAULT 0,
  total_items integer NOT NULL DEFAULT 0,
  total_sale_amount numeric NOT NULL DEFAULT 0,
  total_supplier_amount numeric NOT NULL DEFAULT 0,
  total_profit numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'active'
);

-- Enable RLS
ALTER TABLE public.import_batches ENABLE ROW LEVEL SECURITY;

-- Admins can do everything
CREATE POLICY "Admins manage import_batches"
ON public.import_batches
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Suppliers can read import_batches
CREATE POLICY "Suppliers read import_batches"
ON public.import_batches
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'supplier'::app_role));

-- Drop existing FK on orders.import_batch_id -> import_logs
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_import_batch_id_fkey;

-- Add new FK on orders.import_batch_id -> import_batches
ALTER TABLE public.orders
ADD CONSTRAINT orders_import_batch_id_fkey
FOREIGN KEY (import_batch_id) REFERENCES public.import_batches(id) ON DELETE SET NULL;
