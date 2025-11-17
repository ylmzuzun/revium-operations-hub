-- Step 2 & 3: Stricter RLS for Tasks and Projects

-- Drop existing permissive SELECT policies
DROP POLICY IF EXISTS "Tasks are viewable by authenticated users" ON public.tasks;
DROP POLICY IF EXISTS "Projects are viewable by authenticated users" ON public.projects;

-- Create new strict SELECT policy for tasks
CREATE POLICY "Tasks are viewable by relevant users"
ON public.tasks
FOR SELECT
USING (
  -- Creator can see their tasks
  created_by = auth.uid()
  OR
  -- Assignee can see their tasks
  assignee_id = auth.uid()
  OR
  -- Watchers can see tasks they watch
  EXISTS (
    SELECT 1
    FROM task_watchers tw
    WHERE tw.task_id = tasks.id AND tw.user_id = auth.uid()
  )
  OR
  -- Team members can see tasks assigned to their teams
  EXISTS (
    SELECT 1
    FROM task_teams tt
    JOIN team_members tm ON tm.team_id = tt.team_id
    WHERE tt.task_id = tasks.id AND tm.user_id = auth.uid()
  )
  OR
  -- Project owners can see tasks in their projects
  EXISTS (
    SELECT 1
    FROM projects p
    WHERE p.id = tasks.project_id AND p.owner_id = auth.uid()
  )
  OR
  -- Admins and Managers can see all tasks
  has_role(auth.uid(), 'Admin') OR has_role(auth.uid(), 'Manager')
);

-- Create new strict SELECT policy for projects
CREATE POLICY "Projects are viewable by relevant users"
ON public.projects
FOR SELECT
USING (
  -- Owner can see their projects
  owner_id = auth.uid()
  OR
  -- Users involved in project tasks can see the project
  EXISTS (
    SELECT 1
    FROM tasks t
    WHERE t.project_id = projects.id 
    AND (t.created_by = auth.uid() OR t.assignee_id = auth.uid())
  )
  OR
  -- Team members working on project tasks can see the project
  EXISTS (
    SELECT 1
    FROM tasks t
    JOIN task_teams tt ON tt.task_id = t.id
    JOIN team_members tm ON tm.team_id = tt.team_id
    WHERE t.project_id = projects.id AND tm.user_id = auth.uid()
  )
  OR
  -- Admins and Managers can see all projects
  has_role(auth.uid(), 'Admin') OR has_role(auth.uid(), 'Manager')
);