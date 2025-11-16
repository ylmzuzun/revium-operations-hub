-- Enable pg_net extension for HTTP requests
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Function to send task assigned email via edge function
CREATE OR REPLACE FUNCTION notify_task_assigned_via_email()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only send email if assignee_id is set and changed
  IF NEW.assignee_id IS NOT NULL AND 
     (TG_OP = 'INSERT' OR OLD.assignee_id IS DISTINCT FROM NEW.assignee_id) THEN
    
    -- Call edge function asynchronously via pg_net
    PERFORM net.http_post(
      url := 'https://lqlwdcmkebpjfwhandgz.supabase.co/functions/v1/send-task-assigned-email',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxxbHdkY21rZWJwamZ3aGFuZGd6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMyODczMTIsImV4cCI6MjA3ODg2MzMxMn0.O1i0B9R10TAx8RCKT1srTL59mRiArx3HRDGs-gSJjrA'
      ),
      body := jsonb_build_object(
        'task_id', NEW.id,
        'assignee_id', NEW.assignee_id,
        'created_by', NEW.created_by
      )
    );
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger for task assignment emails
DROP TRIGGER IF EXISTS task_assigned_email_trigger ON tasks;
CREATE TRIGGER task_assigned_email_trigger
AFTER INSERT OR UPDATE OF assignee_id ON tasks
FOR EACH ROW
EXECUTE FUNCTION notify_task_assigned_via_email();

-- Function to send mention email via edge function
CREATE OR REPLACE FUNCTION notify_mention_via_email()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  mentioned_user uuid;
BEGIN
  -- Send email for each mentioned user
  IF NEW.mentioned_users IS NOT NULL AND array_length(NEW.mentioned_users, 1) > 0 THEN
    FOREACH mentioned_user IN ARRAY NEW.mentioned_users
    LOOP
      -- Skip sending email to the author
      IF mentioned_user != NEW.author_id THEN
        PERFORM net.http_post(
          url := 'https://lqlwdcmkebpjfwhandgz.supabase.co/functions/v1/send-mention-email',
          headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxxbHdkY21rZWJwamZ3aGFuZGd6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMyODczMTIsImV4cCI6MjA3ODg2MzMxMn0.O1i0B9R10TAx8RCKT1srTL59mRiArx3HRDGs-gSJjrA'
          ),
          body := jsonb_build_object(
            'comment_id', NEW.id,
            'task_id', NEW.task_id,
            'mentioned_user_id', mentioned_user,
            'author_id', NEW.author_id
          )
        );
      END IF;
    END LOOP;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger for mention emails
DROP TRIGGER IF EXISTS comment_mention_email_trigger ON comments;
CREATE TRIGGER comment_mention_email_trigger
AFTER INSERT ON comments
FOR EACH ROW
EXECUTE FUNCTION notify_mention_via_email();