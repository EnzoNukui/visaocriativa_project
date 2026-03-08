-- Allow supplier to read orders (only id, status, import_batch_id needed for production queries)
CREATE POLICY "Suppliers read orders for production"
ON public.orders FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'supplier'::app_role));

-- Allow supplier to read order_items for production
CREATE POLICY "Suppliers read order_items for production"
ON public.order_items FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'supplier'::app_role));