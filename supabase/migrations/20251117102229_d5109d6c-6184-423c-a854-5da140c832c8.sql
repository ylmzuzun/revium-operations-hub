-- Add end_time column to tasks table
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS end_time time without time zone;

COMMENT ON COLUMN public.tasks.end_time IS 'End time for the selected day';