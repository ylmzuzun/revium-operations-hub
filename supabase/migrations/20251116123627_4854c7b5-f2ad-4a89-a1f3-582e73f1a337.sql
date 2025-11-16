-- Create task_dependencies table for managing task relationships
CREATE TABLE public.task_dependencies (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  depends_on_task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID NOT NULL REFERENCES public.profiles(id),
  UNIQUE(task_id, depends_on_task_id),
  CHECK (task_id != depends_on_task_id)
);

-- Enable RLS
ALTER TABLE public.task_dependencies ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Task dependencies are viewable by authenticated users"
  ON public.task_dependencies
  FOR SELECT
  USING (true);

CREATE POLICY "Task creators and assignees can create dependencies"
  ON public.task_dependencies
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM tasks t
      WHERE t.id = task_id
      AND (
        t.created_by = auth.uid() 
        OR t.assignee_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM profiles
          WHERE id = auth.uid() 
          AND global_role IN ('Admin', 'Manager')
        )
      )
    )
  );

CREATE POLICY "Task creators and assignees can delete dependencies"
  ON public.task_dependencies
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM tasks t
      WHERE t.id = task_id
      AND (
        t.created_by = auth.uid() 
        OR t.assignee_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM profiles
          WHERE id = auth.uid() 
          AND global_role IN ('Admin', 'Manager')
        )
      )
    )
  );

-- Create indexes for better performance
CREATE INDEX idx_task_dependencies_task_id ON public.task_dependencies(task_id);
CREATE INDEX idx_task_dependencies_depends_on ON public.task_dependencies(depends_on_task_id);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.task_dependencies;