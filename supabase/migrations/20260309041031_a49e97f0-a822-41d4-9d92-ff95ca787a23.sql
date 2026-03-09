CREATE OR REPLACE FUNCTION public.generate_order_number()
RETURNS TRIGGER 
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
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
$$;