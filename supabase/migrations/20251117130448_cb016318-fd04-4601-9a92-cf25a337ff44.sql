-- Fix infinite recursion in RLS policies by removing circular dependencies

-- Drop the problematic policies
DROP POLICY IF EXISTS "Tasks are viewable by relevant users" ON public.tasks;
DROP POLICY IF EXISTS "Projects are viewable by relevant users" ON public.projects;

-- Recreate tasks policy WITHOUT checking projects (breaks circular dependency)
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
  -- Admins and Managers can see all tasks
  has_role(auth.uid(), 'Admin') OR has_role(auth.uid(), 'Manager')
);

-- Recreate projects policy WITHOUT checking tasks (breaks circular dependency)
CREATE POLICY "Projects are viewable by relevant users"
ON public.projects
FOR SELECT
USING (
  -- Owner can see their projects
  owner_id = auth.uid()
  OR
  -- Team members working on project-related teams can see the project
  EXISTS (
    SELECT 1
    FROM task_teams tt
    JOIN team_members tm ON tm.team_id = tt.team_id
    JOIN tasks t ON t.id = tt.task_id
    WHERE t.project_id = projects.id AND tm.user_id = auth.uid()
  )
  OR
  -- Admins and Managers can see all projects
  has_role(auth.uid(), 'Admin') OR has_role(auth.uid(), 'Manager')
);