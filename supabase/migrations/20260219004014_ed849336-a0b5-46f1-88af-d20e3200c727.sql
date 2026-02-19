
-- Add status system to profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS requested_role text DEFAULT 'supplier',
ADD COLUMN IF NOT EXISTS approved_by uuid,
ADD COLUMN IF NOT EXISTS approved_at timestamp with time zone;

-- Set existing users to active
UPDATE public.profiles SET status = 'active' WHERE status = 'pending';

-- Create a function to check if user is master (has both admin and supplier roles)
CREATE OR REPLACE FUNCTION public.is_master_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = 'admin')
    AND
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = 'supplier')
  )
$$;

-- Allow master admins to update any profile (for approval)
CREATE POLICY "Master admins update any profile"
ON public.profiles
FOR UPDATE
TO authenticated
USING (public.is_master_admin(auth.uid()));

-- Allow master admins to read all profiles
DROP POLICY IF EXISTS "Users read own profile" ON public.profiles;
CREATE POLICY "Users read own profile or admin"
ON public.profiles
FOR SELECT
TO authenticated
USING ((user_id = auth.uid()) OR has_role(auth.uid(), 'admin'::app_role));

-- Create function to check user status on login (usable by edge function or client)
CREATE OR REPLACE FUNCTION public.get_user_status(_user_id uuid)
RETURNS text
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT status FROM public.profiles WHERE user_id = _user_id LIMIT 1
$$;
