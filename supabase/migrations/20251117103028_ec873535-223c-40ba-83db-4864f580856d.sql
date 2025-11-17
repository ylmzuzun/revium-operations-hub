-- Create project_owners junction table for multiple project owners
CREATE TABLE IF NOT EXISTS public.project_owners (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(project_id, owner_id)
);

-- Enable RLS
ALTER TABLE public.project_owners ENABLE ROW LEVEL SECURITY;

-- Create policies for project_owners
CREATE POLICY "Anyone can view project owners"
  ON public.project_owners FOR SELECT
  USING (true);

CREATE POLICY "Admins and managers can manage project owners"
  ON public.project_owners FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
      AND global_role IN ('Admin', 'Manager')
    )
  );

-- Create index for better performance
CREATE INDEX idx_project_owners_project_id ON public.project_owners(project_id);
CREATE INDEX idx_project_owners_owner_id ON public.project_owners(owner_id);