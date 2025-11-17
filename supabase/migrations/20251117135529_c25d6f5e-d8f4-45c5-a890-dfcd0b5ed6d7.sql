-- Simplify tasks SELECT policies to eliminate recursion
DROP POLICY IF EXISTS "Tasks are viewable by relevant users" ON public.tasks;

-- Admins and Managers can view all tasks
CREATE POLICY "Admins and managers can view all tasks"
ON public.tasks
FOR SELECT
USING (
  has_role(auth.uid(), 'Admin') OR has_role(auth.uid(), 'Manager')
);

-- Creators and Assignees can view their tasks
CREATE POLICY "Creators and assignees can view tasks"
ON public.tasks
FOR SELECT
USING (
  (created_by = auth.uid()) OR (assignee_id = auth.uid())
);

-- Watchers can view tasks (safe, references task_watchers with SELECT true)
CREATE POLICY "Watchers can view tasks"
ON public.tasks
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM task_watchers tw
    WHERE tw.task_id = tasks.id AND tw.user_id = auth.uid()
  )
);
