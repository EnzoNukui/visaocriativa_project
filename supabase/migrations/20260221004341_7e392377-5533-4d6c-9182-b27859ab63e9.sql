
-- Step 1: Drop the old check constraint
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_status_check;

-- Step 2: Migrate existing status values
UPDATE public.orders SET status = 'awaiting_payment' WHERE status = 'pending';
UPDATE public.orders SET status = 'in_production' WHERE status = 'production';

-- Step 3: Add new check constraint with all new statuses
ALTER TABLE public.orders ADD CONSTRAINT orders_status_check 
  CHECK (status = ANY (ARRAY['awaiting_payment','paid','in_production','ready','delivered','cancelled']));

-- Step 4: Add new columns to orders (if not already added)
ALTER TABLE public.orders 
  ADD COLUMN IF NOT EXISTS supplier_id uuid,
  ADD COLUMN IF NOT EXISTS repasse_completed boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS repasse_date timestamptz,
  ADD COLUMN IF NOT EXISTS repasse_amount numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS repasse_confirmed_by uuid;

-- Step 5: Create audit_log table
CREATE TABLE IF NOT EXISTS public.audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type text NOT NULL,
  entity_id text NOT NULL,
  action text NOT NULL,
  field_name text,
  old_value text,
  new_value text,
  performed_by uuid NOT NULL,
  performed_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read audit logs"
  ON public.audit_log FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Authenticated insert audit logs"
  ON public.audit_log FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = performed_by);

-- Step 6: Update orders RLS for supplier visibility
DROP POLICY IF EXISTS "Authenticated read orders" ON public.orders;

CREATE POLICY "Read orders by role"
  ON public.orders FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') 
    OR supplier_id = auth.uid()
  );

DROP POLICY IF EXISTS "Authenticated read order items" ON public.order_items;

CREATE POLICY "Read order items by role"
  ON public.order_items FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR EXISTS (
      SELECT 1 FROM public.orders 
      WHERE orders.id = order_items.order_id 
      AND orders.supplier_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Authenticated update orders" ON public.orders;

CREATE POLICY "Admin update orders"
  ON public.orders FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Supplier update own orders"
  ON public.orders FOR UPDATE
  TO authenticated
  USING (supplier_id = auth.uid());
