
-- Update the handle_new_user function to store requested_role from signup metadata
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, name, email, status, requested_role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', NEW.email),
    NEW.email,
    'pending',
    COALESCE(NEW.raw_user_meta_data->>'requested_role', 'supplier')
  );
  RETURN NEW;
END;
$$;
