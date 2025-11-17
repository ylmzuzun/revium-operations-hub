-- Fix profiles RLS to avoid circular dependency with tasks
DROP POLICY IF EXISTS "Users can view own and relevant profiles" ON public.profiles;

CREATE POLICY "Admins and managers can view all profiles"
ON public.profiles
FOR SELECT
USING (
  has_role(auth.uid(), 'Admin') OR has_role(auth.uid(), 'Manager')
);

CREATE POLICY "Users can view own and same-team profiles"
ON public.profiles
FOR SELECT
USING (
  (auth.uid() = id)
  OR EXISTS (
    SELECT 1
    FROM team_members tm1
    JOIN team_members tm2 ON tm1.team_id = tm2.team_id
    WHERE tm1.user_id = auth.uid()
      AND tm2.user_id = profiles.id
  )
);

-- Fix projects RLS to avoid circular dependency with tasks
DROP POLICY IF EXISTS "Projects are viewable by relevant users" ON public.projects;

CREATE POLICY "Projects are viewable by owners and admins/managers"
ON public.projects
FOR SELECT
USING (
  (owner_id = auth.uid())
  OR EXISTS (
    SELECT 1 FROM project_owners po
    WHERE po.project_id = projects.id AND po.owner_id = auth.uid()
  )
  OR has_role(auth.uid(), 'Admin')
  OR has_role(auth.uid(), 'Manager')
);