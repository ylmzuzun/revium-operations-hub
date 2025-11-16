-- Drop the security definer view and recreate without it
DROP VIEW IF EXISTS public.task_pool;

-- Create regular view without security definer (RLS policies will handle security)
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

-- Grant select on view
GRANT SELECT ON public.task_pool TO authenticated;