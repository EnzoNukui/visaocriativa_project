
-- 1. Create helper function to get the first supplier user_id
CREATE OR REPLACE FUNCTION public.get_default_supplier_id()
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT user_id FROM public.user_roles WHERE role = 'supplier' LIMIT 1
$$;

-- 2. Backfill existing orders with null supplier_id
UPDATE public.orders
SET supplier_id = (SELECT user_id FROM public.user_roles WHERE role = 'supplier' LIMIT 1)
WHERE supplier_id IS NULL;

-- 3. Drop existing supplier read policy (it allows reading ALL orders without supplier_id filter)
DROP POLICY IF EXISTS "Read orders by role" ON public.orders;

-- 4. Create new policy: admin sees all, supplier sees only own orders
CREATE POLICY "Read orders by role"
ON public.orders FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR supplier_id = auth.uid()
);

-- 5. Fix order_items SELECT policy too - supplier should only see items for their orders
DROP POLICY IF EXISTS "Read order items by role" ON public.order_items;

CREATE POLICY "Read order items by role"
ON public.order_items FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR EXISTS (
    SELECT 1 FROM public.orders
    WHERE orders.id = order_items.order_id
    AND orders.supplier_id = auth.uid()
  )
);

-- 6. Fix supplier update policy to ensure it works
DROP POLICY IF EXISTS "Supplier update own orders" ON public.orders;

CREATE POLICY "Supplier update own orders"
ON public.orders FOR UPDATE
TO authenticated
USING (supplier_id = auth.uid())
WITH CHECK (supplier_id = auth.uid());
