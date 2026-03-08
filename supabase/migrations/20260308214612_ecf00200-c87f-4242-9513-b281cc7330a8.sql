
-- Create order_adjustments table
CREATE TABLE public.order_adjustments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid REFERENCES public.orders(id) ON DELETE CASCADE NOT NULL,
  product_name text NOT NULL,
  old_size text NOT NULL,
  new_size text NOT NULL,
  old_unit_price numeric(10,2) NOT NULL,
  new_unit_price numeric(10,2) NOT NULL,
  quantity integer NOT NULL,
  adjustment_value numeric(10,2) NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  notes text,
  created_by uuid NOT NULL,
  created_at timestamptz DEFAULT now(),
  resolved_by uuid,
  resolved_at timestamptz
);

-- Add validation trigger instead of CHECK constraint
CREATE OR REPLACE FUNCTION public.validate_adjustment_status()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  IF NEW.status NOT IN ('pending', 'resolved') THEN
    RAISE EXCEPTION 'Invalid adjustment status: %', NEW.status;
  END IF;
  RETURN NEW;
END;
$function$;

CREATE TRIGGER validate_adjustment_status_trigger
  BEFORE INSERT OR UPDATE ON public.order_adjustments
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_adjustment_status();

-- Enable RLS
ALTER TABLE public.order_adjustments ENABLE ROW LEVEL SECURITY;

-- Admins can do everything
CREATE POLICY "Admins manage order_adjustments"
  ON public.order_adjustments
  FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Suppliers can read
CREATE POLICY "Suppliers read order_adjustments"
  ON public.order_adjustments
  FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'supplier'::app_role));
