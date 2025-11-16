-- Add start_date field to tasks table for Gantt chart timeline
ALTER TABLE public.tasks
ADD COLUMN start_date TIMESTAMP WITH TIME ZONE;

-- Create index for better performance on date queries
CREATE INDEX idx_tasks_start_date ON public.tasks(start_date);

-- Update existing tasks to have a start_date (set to 7 days before due_date or created_at)
UPDATE public.tasks
SET start_date = CASE
  WHEN due_date IS NOT NULL THEN due_date - INTERVAL '7 days'
  ELSE created_at
END
WHERE start_date IS NULL;