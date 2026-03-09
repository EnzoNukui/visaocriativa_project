
-- FIX 1: Change default status to awaiting_payment
ALTER TABLE public.orders ALTER COLUMN status SET DEFAULT 'awaiting_payment';

-- FIX 2: Update existing pending orders
UPDATE public.orders SET status = 'awaiting_payment' WHERE status = 'pending';

-- FIX 7: Add CASCADE DELETE on import_batch_id FK
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_import_batch_id_fkey;
ALTER TABLE public.orders ADD CONSTRAINT orders_import_batch_id_fkey 
  FOREIGN KEY (import_batch_id) REFERENCES public.import_batches(id) ON DELETE CASCADE;

-- FIX 8: Create trigger for order number generation (if not exists)
DROP TRIGGER IF EXISTS set_order_number ON public.orders;
CREATE TRIGGER set_order_number
  BEFORE INSERT ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.generate_order_number();

-- FIX 6: Drop unrestricted supplier policies on orders and order_items
DROP POLICY IF EXISTS "Suppliers read orders for production" ON public.orders;
DROP POLICY IF EXISTS "Suppliers read order_items for production" ON public.order_items;
