
-- Create repasse_complementar table
CREATE TABLE public.repasse_complementar (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id uuid REFERENCES public.import_batches(id) ON DELETE CASCADE NOT NULL,
  order_id uuid REFERENCES public.orders(id) ON DELETE CASCADE NOT NULL,
  adjustment_id uuid REFERENCES public.order_adjustments(id) ON DELETE CASCADE NOT NULL,
  adjustment_value numeric(10,2) NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz DEFAULT now(),
  confirmed_by uuid,
  confirmed_at timestamptz
);

-- Validation trigger for status
CREATE OR REPLACE FUNCTION public.validate_repasse_complementar_status()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NEW.status NOT IN ('pending', 'confirmed') THEN
    RAISE EXCEPTION 'Invalid repasse_complementar status: %', NEW.status;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER validate_repasse_complementar_status_trigger
  BEFORE INSERT OR UPDATE ON public.repasse_complementar
  FOR EACH ROW EXECUTE FUNCTION public.validate_repasse_complementar_status();

-- RLS
ALTER TABLE public.repasse_complementar ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage repasse_complementar"
  ON public.repasse_complementar FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Suppliers read repasse_complementar"
  ON public.repasse_complementar FOR SELECT
  USING (has_role(auth.uid(), 'supplier'::app_role));
