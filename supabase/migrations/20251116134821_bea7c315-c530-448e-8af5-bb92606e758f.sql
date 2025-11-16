-- Fix 1: Create user_roles table and migrate roles (MISSING_RLS)
-- Create app_role enum
CREATE TYPE public.app_role AS ENUM ('Admin', 'Manager', 'TeamLead', 'Member', 'Viewer');

-- Create user_roles table
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  assigned_by UUID REFERENCES auth.users(id),
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Create security definer function to check roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role TEXT)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role::app_role
  )
$$;

-- Migrate existing role data from profiles to user_roles
INSERT INTO public.user_roles (user_id, role)
SELECT id, global_role::text::app_role FROM public.profiles;

-- RLS policies for user_roles
CREATE POLICY "Users can view own roles"
ON public.user_roles FOR SELECT
USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'Admin'));

CREATE POLICY "Only admins can assign roles"
ON public.user_roles FOR INSERT
WITH CHECK (public.has_role(auth.uid(), 'Admin'));

CREATE POLICY "Only admins can remove roles"
ON public.user_roles FOR DELETE
USING (public.has_role(auth.uid(), 'Admin'));

-- Fix 2: Update profiles SELECT policy (PUBLIC_DATA_EXPOSURE)
DROP POLICY IF EXISTS "Profiles are viewable by authenticated users" ON public.profiles;

CREATE POLICY "Users can view own and relevant profiles"
ON public.profiles FOR SELECT
USING (
  auth.uid() = id 
  OR
  EXISTS (
    SELECT 1 FROM team_members tm1
    JOIN team_members tm2 ON tm1.team_id = tm2.team_id
    WHERE tm1.user_id = auth.uid() AND tm2.user_id = profiles.id
  )
  OR
  EXISTS (
    SELECT 1 FROM tasks t1
    JOIN tasks t2 ON t1.project_id = t2.project_id
    WHERE (t1.assignee_id = auth.uid() OR t1.created_by = auth.uid())
    AND (t2.assignee_id = profiles.id OR t2.created_by = profiles.id)
  )
  OR
  public.has_role(auth.uid(), 'Admin')
  OR
  public.has_role(auth.uid(), 'Manager')
);

-- Update all existing RLS policies to use has_role() instead of profiles.global_role

-- Teams policies
DROP POLICY IF EXISTS "Team leads and admins can update teams" ON public.teams;
CREATE POLICY "Team leads and admins can update teams"
ON public.teams FOR UPDATE
USING (
  team_lead_id = auth.uid() OR
  public.has_role(auth.uid(), 'Admin') OR
  public.has_role(auth.uid(), 'Manager')
);

DROP POLICY IF EXISTS "Admins and managers can create teams" ON public.teams;
CREATE POLICY "Admins and managers can create teams"
ON public.teams FOR INSERT
WITH CHECK (
  public.has_role(auth.uid(), 'Admin') OR
  public.has_role(auth.uid(), 'Manager')
);

-- Team members policies
DROP POLICY IF EXISTS "Team leads and admins can manage team members" ON public.team_members;
CREATE POLICY "Team leads and admins can manage team members"
ON public.team_members FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.teams t
    WHERE t.id = team_id AND (
      t.team_lead_id = auth.uid() OR
      public.has_role(auth.uid(), 'Admin') OR
      public.has_role(auth.uid(), 'Manager')
    )
  )
);

-- Projects policies
DROP POLICY IF EXISTS "Project owners and admins can update projects" ON public.projects;
CREATE POLICY "Project owners and admins can update projects"
ON public.projects FOR UPDATE
USING (
  owner_id = auth.uid() OR
  public.has_role(auth.uid(), 'Admin') OR
  public.has_role(auth.uid(), 'Manager')
);

DROP POLICY IF EXISTS "Project owners and admins can delete projects" ON public.projects;
CREATE POLICY "Project owners and admins can delete projects"
ON public.projects FOR DELETE
USING (
  owner_id = auth.uid() OR
  public.has_role(auth.uid(), 'Admin') OR
  public.has_role(auth.uid(), 'Manager')
);

-- Tasks policies
DROP POLICY IF EXISTS "Task creators and assignees can update tasks" ON public.tasks;
CREATE POLICY "Task creators and assignees can update tasks"
ON public.tasks FOR UPDATE
USING (
  created_by = auth.uid() OR
  assignee_id = auth.uid() OR
  public.has_role(auth.uid(), 'Admin') OR
  public.has_role(auth.uid(), 'Manager')
);

-- Task dependencies policies
DROP POLICY IF EXISTS "Task creators and assignees can create dependencies" ON public.task_dependencies;
CREATE POLICY "Task creators and assignees can create dependencies"
ON public.task_dependencies FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.tasks t
    WHERE t.id = task_id AND (
      t.created_by = auth.uid() OR
      t.assignee_id = auth.uid() OR
      public.has_role(auth.uid(), 'Admin') OR
      public.has_role(auth.uid(), 'Manager')
    )
  )
);

DROP POLICY IF EXISTS "Task creators and assignees can delete dependencies" ON public.task_dependencies;
CREATE POLICY "Task creators and assignees can delete dependencies"
ON public.task_dependencies FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.tasks t
    WHERE t.id = task_id AND (
      t.created_by = auth.uid() OR
      t.assignee_id = auth.uid() OR
      public.has_role(auth.uid(), 'Admin') OR
      public.has_role(auth.uid(), 'Manager')
    )
  )
);

-- Task teams policies
DROP POLICY IF EXISTS "Task creators and admins can manage task teams" ON public.task_teams;
CREATE POLICY "Task creators and admins can manage task teams"
ON public.task_teams FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.tasks t
    WHERE t.id = task_id AND (
      t.created_by = auth.uid() OR
      t.assignee_id = auth.uid() OR
      public.has_role(auth.uid(), 'Admin') OR
      public.has_role(auth.uid(), 'Manager')
    )
  )
);

-- Profiles policies
DROP POLICY IF EXISTS "Users can update own profile or admins can update any" ON public.profiles;
CREATE POLICY "Users can update own profile or admins can update any"
ON public.profiles FOR UPDATE
USING (
  auth.uid() = id OR
  public.has_role(auth.uid(), 'Admin') OR
  public.has_role(auth.uid(), 'Manager')
);

DROP POLICY IF EXISTS "Admins can manage user status" ON public.profiles;
CREATE POLICY "Admins can manage user status"
ON public.profiles FOR UPDATE
USING (
  public.has_role(auth.uid(), 'Admin') OR
  public.has_role(auth.uid(), 'Manager')
);

-- Approval workflows policy
DROP POLICY IF EXISTS "Admins and managers can create workflows" ON public.task_approval_workflows;
CREATE POLICY "Admins and managers can create workflows"
ON public.task_approval_workflows FOR INSERT
WITH CHECK (
  public.has_role(auth.uid(), 'Admin') OR
  public.has_role(auth.uid(), 'Manager')
);

-- Fix 3: Add storage RLS policies (STORAGE_EXPOSURE)
-- Allow users to upload files to their own folder
CREATE POLICY "Users can upload own files"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'task-attachments' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow task participants to access files
CREATE POLICY "Task participants can access files"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'task-attachments' AND
  EXISTS (
    SELECT 1 FROM attachments a
    JOIN tasks t ON t.id = a.task_id
    WHERE a.file_url LIKE '%' || storage.objects.name || '%'
    AND (t.assignee_id = auth.uid() OR t.created_by = auth.uid())
  )
);

-- Allow file uploaders to delete their own files
CREATE POLICY "Users can delete own files"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'task-attachments' AND
  (storage.foldername(name))[1] = auth.uid()::text
);