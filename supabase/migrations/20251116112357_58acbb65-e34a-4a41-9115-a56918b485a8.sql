-- Create enums for type safety
CREATE TYPE global_role AS ENUM ('Admin', 'Manager', 'TeamLead', 'Member', 'Viewer');
CREATE TYPE department_type AS ENUM ('Management', 'Mechanical', 'Electrical', 'Software', 'Sales', 'Logistics', 'Finance', 'Other');
CREATE TYPE task_type AS ENUM ('Task', 'Request', 'Bug', 'Idea', 'Improvement');
CREATE TYPE task_status AS ENUM ('Backlog', 'To Do', 'In Progress', 'Blocked', 'Waiting Approval', 'Done', 'Canceled');
CREATE TYPE task_priority AS ENUM ('Low', 'Medium', 'High', 'Critical');
CREATE TYPE project_status AS ENUM ('Planned', 'In Progress', 'On Hold', 'Completed');
CREATE TYPE notification_type AS ENUM ('MENTION', 'TASK_ASSIGNED', 'TASK_STATUS_CHANGED', 'TASK_COMMENT', 'NEW_OPEN_TASK', 'TASK_TAKEN');

-- Profiles table (extends auth.users)
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  surname TEXT NOT NULL,
  avatar_url TEXT,
  phone TEXT,
  title TEXT,
  bio TEXT,
  global_role global_role NOT NULL DEFAULT 'Member',
  department department_type NOT NULL DEFAULT 'Other',
  skills TEXT[] DEFAULT ARRAY[]::TEXT[],
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Teams table
CREATE TABLE public.teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  team_lead_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Team members junction table
CREATE TABLE public.team_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(team_id, user_id)
);

-- Projects table
CREATE TABLE public.projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  status project_status NOT NULL DEFAULT 'Planned',
  priority task_priority NOT NULL DEFAULT 'Medium',
  owner_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  start_date DATE,
  end_date DATE,
  tags TEXT[] DEFAULT ARRAY[]::TEXT[],
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Tasks table (central entity)
CREATE TABLE public.tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  type task_type NOT NULL DEFAULT 'Task',
  status task_status NOT NULL DEFAULT 'Backlog',
  priority task_priority NOT NULL DEFAULT 'Medium',
  created_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  assignee_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  skill_tags TEXT[] DEFAULT ARRAY[]::TEXT[],
  due_date TIMESTAMPTZ,
  estimate_hours DECIMAL(10,2),
  actual_hours DECIMAL(10,2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Task watchers junction table
CREATE TABLE public.task_watchers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(task_id, user_id)
);

-- Task related teams junction table
CREATE TABLE public.task_teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(task_id, team_id)
);

-- Comments table
CREATE TABLE public.comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  mentioned_users UUID[] DEFAULT ARRAY[]::UUID[],
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Attachments table
CREATE TABLE public.attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  uploaded_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_type TEXT,
  file_size BIGINT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Notifications table
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type notification_type NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  related_task_id UUID REFERENCES public.tasks(id) ON DELETE CASCADE,
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Activity log table
CREATE TABLE public.activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  changed_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  change_type TEXT NOT NULL,
  field_name TEXT,
  old_value TEXT,
  new_value TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_watchers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for profiles
CREATE POLICY "Profiles are viewable by authenticated users"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can insert their own profile"
  ON public.profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

-- RLS Policies for teams
CREATE POLICY "Teams are viewable by authenticated users"
  ON public.teams FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Team leads and admins can update teams"
  ON public.teams FOR UPDATE
  TO authenticated
  USING (
    team_lead_id = auth.uid() OR
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND global_role IN ('Admin', 'Manager'))
  );

CREATE POLICY "Admins and managers can create teams"
  ON public.teams FOR INSERT
  TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND global_role IN ('Admin', 'Manager')));

-- RLS Policies for team_members
CREATE POLICY "Team members are viewable by authenticated users"
  ON public.team_members FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Team leads and admins can manage team members"
  ON public.team_members FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.teams t
      WHERE t.id = team_id AND (
        t.team_lead_id = auth.uid() OR
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND global_role IN ('Admin', 'Manager'))
      )
    )
  );

-- RLS Policies for projects
CREATE POLICY "Projects are viewable by authenticated users"
  ON public.projects FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Project owners and admins can update projects"
  ON public.projects FOR UPDATE
  TO authenticated
  USING (
    owner_id = auth.uid() OR
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND global_role IN ('Admin', 'Manager'))
  );

CREATE POLICY "Authenticated users can create projects"
  ON public.projects FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- RLS Policies for tasks
CREATE POLICY "Tasks are viewable by authenticated users"
  ON public.tasks FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Task creators and assignees can update tasks"
  ON public.tasks FOR UPDATE
  TO authenticated
  USING (
    created_by = auth.uid() OR
    assignee_id = auth.uid() OR
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND global_role IN ('Admin', 'Manager'))
  );

CREATE POLICY "Authenticated users can create tasks"
  ON public.tasks FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = created_by);

-- RLS Policies for task_watchers
CREATE POLICY "Task watchers are viewable by authenticated users"
  ON public.task_watchers FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can manage their own watches"
  ON public.task_watchers FOR ALL
  TO authenticated
  USING (user_id = auth.uid());

-- RLS Policies for task_teams
CREATE POLICY "Task teams are viewable by authenticated users"
  ON public.task_teams FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Task creators and admins can manage task teams"
  ON public.task_teams FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.tasks t
      WHERE t.id = task_id AND (
        t.created_by = auth.uid() OR
        t.assignee_id = auth.uid() OR
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND global_role IN ('Admin', 'Manager'))
      )
    )
  );

-- RLS Policies for comments
CREATE POLICY "Comments are viewable by authenticated users"
  ON public.comments FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can create comments"
  ON public.comments FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = author_id);

CREATE POLICY "Comment authors can update their comments"
  ON public.comments FOR UPDATE
  TO authenticated
  USING (author_id = auth.uid());

-- RLS Policies for attachments
CREATE POLICY "Attachments are viewable by authenticated users"
  ON public.attachments FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can upload attachments"
  ON public.attachments FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = uploaded_by);

-- RLS Policies for notifications
CREATE POLICY "Users can view their own notifications"
  ON public.notifications FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "System can create notifications"
  ON public.notifications FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update their own notifications"
  ON public.notifications FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid());

-- RLS Policies for activity_logs
CREATE POLICY "Activity logs are viewable by authenticated users"
  ON public.activity_logs FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "System can create activity logs"
  ON public.activity_logs FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Create function to handle new user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, name, surname, global_role, department)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', 'User'),
    COALESCE(NEW.raw_user_meta_data->>'surname', ''),
    'Member',
    'Other'
  );
  RETURN NEW;
END;
$$;

-- Trigger to create profile on user signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- Triggers for updated_at
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_teams_updated_at BEFORE UPDATE ON public.teams FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_projects_updated_at BEFORE UPDATE ON public.projects FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_tasks_updated_at BEFORE UPDATE ON public.tasks FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_comments_updated_at BEFORE UPDATE ON public.comments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Create indexes for better performance
CREATE INDEX idx_profiles_department ON public.profiles(department);
CREATE INDEX idx_profiles_global_role ON public.profiles(global_role);
CREATE INDEX idx_tasks_status ON public.tasks(status);
CREATE INDEX idx_tasks_assignee_id ON public.tasks(assignee_id);
CREATE INDEX idx_tasks_created_by ON public.tasks(created_by);
CREATE INDEX idx_tasks_project_id ON public.tasks(project_id);
CREATE INDEX idx_comments_task_id ON public.comments(task_id);
CREATE INDEX idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX idx_notifications_is_read ON public.notifications(is_read);
CREATE INDEX idx_activity_logs_task_id ON public.activity_logs(task_id);