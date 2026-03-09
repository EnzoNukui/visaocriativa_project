-- Fix 3: Add CASCADE DELETE to import_batch_id foreign key
ALTER TABLE orders 
DROP CONSTRAINT IF EXISTS orders_import_batch_id_fkey;

ALTER TABLE orders
ADD CONSTRAINT orders_import_batch_id_fkey
FOREIGN KEY (import_batch_id) 
REFERENCES import_batches(id) 
ON DELETE CASCADE;

-- Fix 4: Ensure DB trigger for order number generation exists
CREATE OR REPLACE FUNCTION generate_order_number()
RETURNS TRIGGER AS $$
DECLARE
  last_number INTEGER;
  new_number TEXT;
BEGIN
  SELECT COALESCE(MAX(CAST(REPLACE(order_number, 'VC-', '') AS INTEGER)), 0)
  INTO last_number
  FROM orders
  WHERE order_number LIKE 'VC-%';
  
  new_number := 'VC-' || LPAD(CAST(last_number + 1 AS TEXT), 4, '0');
  NEW.order_number := new_number;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_order_number ON orders;

CREATE TRIGGER set_order_number
  BEFORE INSERT ON orders
  FOR EACH ROW
  WHEN (NEW.order_number IS NULL OR NEW.order_number = '')
  EXECUTE FUNCTION generate_order_number();