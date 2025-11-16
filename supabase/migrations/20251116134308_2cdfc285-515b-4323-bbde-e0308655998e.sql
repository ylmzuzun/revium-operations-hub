-- Add database-level constraint for comment message length
ALTER TABLE comments
ADD CONSTRAINT message_length_check 
CHECK (length(message) <= 5000 AND length(message) > 0);