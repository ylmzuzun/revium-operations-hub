-- Allow project owners and admins to delete projects
CREATE POLICY "Project owners and admins can delete projects"
ON public.projects
FOR DELETE
TO authenticated
USING (
  owner_id = auth.uid() 
  OR 
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() 
    AND global_role IN ('Admin', 'Manager')
  )
);