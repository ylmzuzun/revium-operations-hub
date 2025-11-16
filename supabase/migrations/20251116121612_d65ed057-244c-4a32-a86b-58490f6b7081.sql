-- Create storage bucket for task attachments
INSERT INTO storage.buckets (id, name, public)
VALUES ('task-attachments', 'task-attachments', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for task attachments
CREATE POLICY "Authenticated users can view attachments"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'task-attachments');

CREATE POLICY "Authenticated users can upload attachments"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'task-attachments' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete their own attachments"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'task-attachments' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Enable realtime for notifications
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;

-- Enable realtime for activity_logs
ALTER PUBLICATION supabase_realtime ADD TABLE public.activity_logs;

-- Function to create notification
CREATE OR REPLACE FUNCTION public.create_notification(
  p_user_id uuid,
  p_title text,
  p_message text,
  p_type notification_type,
  p_task_id uuid DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.notifications (user_id, title, message, type, related_task_id)
  VALUES (p_user_id, p_title, p_message, p_type, p_task_id);
END;
$$;

-- Trigger function for task assignment notifications
CREATE OR REPLACE FUNCTION public.notify_task_assigned()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  task_title text;
BEGIN
  IF NEW.assignee_id IS NOT NULL AND (TG_OP = 'INSERT' OR OLD.assignee_id IS DISTINCT FROM NEW.assignee_id) THEN
    SELECT title INTO task_title FROM tasks WHERE id = NEW.id;
    
    PERFORM create_notification(
      NEW.assignee_id,
      'New Task Assignment',
      'You have been assigned to task: ' || task_title,
      'TASK_ASSIGNED',
      NEW.id
    );
  END IF;
  RETURN NEW;
END;
$$;

-- Trigger for task assignments
DROP TRIGGER IF EXISTS on_task_assigned ON public.tasks;
CREATE TRIGGER on_task_assigned
  AFTER INSERT OR UPDATE OF assignee_id ON public.tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_task_assigned();

-- Trigger function for task status change notifications
CREATE OR REPLACE FUNCTION public.notify_task_status_changed()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  task_title text;
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    SELECT title INTO task_title FROM tasks WHERE id = NEW.id;
    
    -- Notify creator if not the one who changed it
    IF NEW.created_by != auth.uid() THEN
      PERFORM create_notification(
        NEW.created_by,
        'Task Status Changed',
        'Status changed to ' || NEW.status || ' for task: ' || task_title,
        'TASK_STATUS_CHANGED',
        NEW.id
      );
    END IF;
    
    -- Notify assignee if exists and not the one who changed it
    IF NEW.assignee_id IS NOT NULL AND NEW.assignee_id != auth.uid() AND NEW.assignee_id != NEW.created_by THEN
      PERFORM create_notification(
        NEW.assignee_id,
        'Task Status Changed',
        'Status changed to ' || NEW.status || ' for task: ' || task_title,
        'TASK_STATUS_CHANGED',
        NEW.id
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- Trigger for status changes
DROP TRIGGER IF EXISTS on_task_status_changed ON public.tasks;
CREATE TRIGGER on_task_status_changed
  AFTER UPDATE OF status ON public.tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_task_status_changed();

-- Trigger function for comment mentions
CREATE OR REPLACE FUNCTION public.notify_comment_mentions()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  mentioned_user uuid;
  task_title text;
BEGIN
  IF NEW.mentioned_users IS NOT NULL THEN
    SELECT title INTO task_title FROM tasks WHERE id = NEW.task_id;
    
    FOREACH mentioned_user IN ARRAY NEW.mentioned_users
    LOOP
      IF mentioned_user != NEW.author_id THEN
        PERFORM create_notification(
          mentioned_user,
          'You were mentioned',
          'You were mentioned in a comment on task: ' || task_title,
          'MENTION',
          NEW.task_id
        );
      END IF;
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$;

-- Trigger for comment mentions
DROP TRIGGER IF EXISTS on_comment_mention ON public.comments;
CREATE TRIGGER on_comment_mention
  AFTER INSERT ON public.comments
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_comment_mentions();