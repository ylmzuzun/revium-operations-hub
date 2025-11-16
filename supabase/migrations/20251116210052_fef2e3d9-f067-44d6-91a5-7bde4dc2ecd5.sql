-- Create task_assignees junction table for multi-assignment
CREATE TABLE IF NOT EXISTS public.task_assignees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  assignee_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  assigned_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  assigned_by UUID REFERENCES public.profiles(id),
  UNIQUE(task_id, assignee_id)
);

-- Enable RLS
ALTER TABLE public.task_assignees ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Task assignees are viewable by authenticated users"
ON public.task_assignees
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Task creators and admins can manage assignees"
ON public.task_assignees
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.tasks
    WHERE id = task_assignees.task_id
    AND (created_by = auth.uid() OR assignee_id = auth.uid())
  )
  OR EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND global_role IN ('Admin', 'Manager')
  )
);

-- Create indexes
CREATE INDEX idx_task_assignees_task ON public.task_assignees(task_id);
CREATE INDEX idx_task_assignees_assignee ON public.task_assignees(assignee_id);

-- Migrate existing single assignees to the new table
INSERT INTO public.task_assignees (task_id, assignee_id, assigned_by)
SELECT id, assignee_id, created_by
FROM public.tasks
WHERE assignee_id IS NOT NULL
ON CONFLICT (task_id, assignee_id) DO NOTHING;

-- Function to sync assignee_id with task_assignees for backward compatibility
CREATE OR REPLACE FUNCTION public.sync_task_assignee()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- Update the task's primary assignee_id to the first assignee
    UPDATE tasks
    SET assignee_id = NEW.assignee_id
    WHERE id = NEW.task_id
    AND assignee_id IS NULL;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER sync_task_assignee_trigger
AFTER INSERT ON public.task_assignees
FOR EACH ROW
EXECUTE FUNCTION public.sync_task_assignee();

-- Add claimed_by field to track who claimed unassigned tasks
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS claimed_by UUID REFERENCES public.profiles(id);

-- Create view for task pool (unassigned tasks)
CREATE OR REPLACE VIEW public.task_pool AS
SELECT t.*
FROM public.tasks t
WHERE t.assignee_id IS NULL
AND NOT EXISTS (
  SELECT 1 FROM public.task_assignees ta
  WHERE ta.task_id = t.id
)
AND t.status NOT IN ('Done', 'Canceled')
ORDER BY t.priority DESC, t.created_at DESC;