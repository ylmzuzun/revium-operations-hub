-- Create approval levels enum
CREATE TYPE public.approval_level AS ENUM ('LEVEL_1', 'LEVEL_2', 'LEVEL_3');

-- Create approval status enum
CREATE TYPE public.approval_status AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- Create task_approval_workflows table to define approval chains for projects/teams
CREATE TABLE public.task_approval_workflows (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  level_1_role TEXT, -- 'TeamLead', 'Manager', 'Admin', or specific user_id
  level_2_role TEXT,
  level_3_role TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID NOT NULL REFERENCES public.profiles(id)
);

-- Create task_approvals table to track approval requests
CREATE TABLE public.task_approvals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  workflow_id UUID REFERENCES public.task_approval_workflows(id),
  requested_by UUID NOT NULL REFERENCES public.profiles(id),
  requested_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  current_level approval_level NOT NULL DEFAULT 'LEVEL_1',
  is_complete BOOLEAN NOT NULL DEFAULT false,
  final_status approval_status,
  completed_at TIMESTAMP WITH TIME ZONE,
  notes TEXT,
  UNIQUE(task_id)
);

-- Create task_approval_actions table to track individual approval/rejection actions
CREATE TABLE public.task_approval_actions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  approval_id UUID NOT NULL REFERENCES public.task_approvals(id) ON DELETE CASCADE,
  level approval_level NOT NULL,
  approver_id UUID NOT NULL REFERENCES public.profiles(id),
  status approval_status NOT NULL,
  comments TEXT,
  actioned_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.task_approval_workflows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_approval_actions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for task_approval_workflows
CREATE POLICY "Workflows are viewable by authenticated users"
  ON public.task_approval_workflows
  FOR SELECT
  USING (true);

CREATE POLICY "Admins and managers can create workflows"
  ON public.task_approval_workflows
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() 
      AND global_role IN ('Admin', 'Manager')
    )
  );

-- RLS Policies for task_approvals
CREATE POLICY "Approvals are viewable by authenticated users"
  ON public.task_approvals
  FOR SELECT
  USING (true);

CREATE POLICY "Task creators and assignees can request approvals"
  ON public.task_approvals
  FOR INSERT
  WITH CHECK (
    auth.uid() = requested_by AND
    EXISTS (
      SELECT 1 FROM tasks t
      WHERE t.id = task_id
      AND (t.created_by = auth.uid() OR t.assignee_id = auth.uid())
    )
  );

CREATE POLICY "Requesters can update their own approval requests"
  ON public.task_approvals
  FOR UPDATE
  USING (requested_by = auth.uid());

-- RLS Policies for task_approval_actions
CREATE POLICY "Approval actions are viewable by authenticated users"
  ON public.task_approval_actions
  FOR SELECT
  USING (true);

CREATE POLICY "Approvers can create approval actions"
  ON public.task_approval_actions
  FOR INSERT
  WITH CHECK (auth.uid() = approver_id);

-- Create indexes
CREATE INDEX idx_task_approvals_task_id ON public.task_approvals(task_id);
CREATE INDEX idx_task_approvals_status ON public.task_approvals(is_complete, current_level);
CREATE INDEX idx_task_approval_actions_approval_id ON public.task_approval_actions(approval_id);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.task_approvals;
ALTER PUBLICATION supabase_realtime ADD TABLE public.task_approval_actions;

-- Create function to determine if user can approve at current level
CREATE OR REPLACE FUNCTION public.can_user_approve_task(
  p_approval_id UUID,
  p_user_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_level approval_level;
  v_workflow_id UUID;
  v_level_role TEXT;
  v_user_role TEXT;
  v_task_id UUID;
  v_team_lead_id UUID;
BEGIN
  -- Get approval details
  SELECT current_level, workflow_id, task_id
  INTO v_current_level, v_workflow_id, v_task_id
  FROM task_approvals
  WHERE id = p_approval_id AND is_complete = false;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  -- Get user's global role
  SELECT global_role INTO v_user_role
  FROM profiles
  WHERE id = p_user_id;

  -- If workflow exists, check workflow-defined approvers
  IF v_workflow_id IS NOT NULL THEN
    SELECT 
      CASE 
        WHEN v_current_level = 'LEVEL_1' THEN level_1_role
        WHEN v_current_level = 'LEVEL_2' THEN level_2_role
        WHEN v_current_level = 'LEVEL_3' THEN level_3_role
      END
    INTO v_level_role
    FROM task_approval_workflows
    WHERE id = v_workflow_id;

    -- Check if it's a specific user ID or a role
    IF v_level_role = p_user_id::text THEN
      RETURN true;
    END IF;

    IF v_level_role = v_user_role THEN
      RETURN true;
    END IF;
  ELSE
    -- Default approval logic without workflow
    -- Level 1: Team Lead of the task's team or Manager/Admin
    -- Level 2: Manager or Admin
    -- Level 3: Admin only
    
    IF v_current_level = 'LEVEL_1' THEN
      -- Check if user is team lead of any team associated with the task
      SELECT tm.team_lead_id INTO v_team_lead_id
      FROM task_teams tt
      JOIN teams tm ON tm.id = tt.team_id
      WHERE tt.task_id = v_task_id
      LIMIT 1;
      
      IF v_team_lead_id = p_user_id OR v_user_role IN ('Manager', 'Admin') THEN
        RETURN true;
      END IF;
    ELSIF v_current_level = 'LEVEL_2' THEN
      IF v_user_role IN ('Manager', 'Admin') THEN
        RETURN true;
      END IF;
    ELSIF v_current_level = 'LEVEL_3' THEN
      IF v_user_role = 'Admin' THEN
        RETURN true;
      END IF;
    END IF;
  END IF;

  RETURN false;
END;
$$;

-- Create trigger to send notifications on approval request
CREATE OR REPLACE FUNCTION public.notify_approval_requested()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  task_title text;
  requester_name text;
BEGIN
  SELECT title INTO task_title FROM tasks WHERE id = NEW.task_id;
  SELECT name || ' ' || surname INTO requester_name FROM profiles WHERE id = NEW.requested_by;
  
  -- Notify potential approvers (simplified - would need more logic for specific approvers)
  INSERT INTO notifications (user_id, title, message, type, related_task_id)
  SELECT 
    p.id,
    'Approval Request',
    requester_name || ' requested approval for task: ' || task_title,
    'TASK_ASSIGNED',
    NEW.task_id
  FROM profiles p
  WHERE p.global_role IN ('Admin', 'Manager', 'TeamLead')
  AND p.id != NEW.requested_by;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_approval_requested
  AFTER INSERT ON task_approvals
  FOR EACH ROW
  EXECUTE FUNCTION notify_approval_requested();

-- Create trigger to update task status when approval is complete
CREATE OR REPLACE FUNCTION public.handle_approval_completion()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.is_complete = true AND OLD.is_complete = false THEN
    IF NEW.final_status = 'APPROVED' THEN
      UPDATE tasks
      SET status = 'Done'
      WHERE id = NEW.task_id;
    ELSIF NEW.final_status = 'REJECTED' THEN
      UPDATE tasks
      SET status = 'In Progress'
      WHERE id = NEW.task_id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_approval_completed
  AFTER UPDATE ON task_approvals
  FOR EACH ROW
  WHEN (NEW.is_complete = true AND OLD.is_complete = false)
  EXECUTE FUNCTION handle_approval_completion();