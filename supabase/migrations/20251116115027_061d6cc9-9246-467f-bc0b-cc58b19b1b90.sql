-- Update profiles RLS policy to allow admins to manage all users
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;

CREATE POLICY "Users can update own profile or admins can update any"
ON public.profiles
FOR UPDATE
TO authenticated
USING (
  auth.uid() = id 
  OR 
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() 
    AND global_role IN ('Admin', 'Manager')
  )
);

-- Allow admins to deactivate users (update is_active)
CREATE POLICY "Admins can manage user status"
ON public.profiles
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() 
    AND global_role IN ('Admin', 'Manager')
  )
);