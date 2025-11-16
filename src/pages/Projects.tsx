import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

const Projects = () => {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Projects</h1>
          <p className="text-muted-foreground mt-1">
            Organize your work into projects
          </p>
        </div>
        <Button className="gap-2">
          <Plus className="h-4 w-4" />
          New Project
        </Button>
      </div>

      <div className="rounded-lg border bg-card">
        <div className="p-8 text-center text-muted-foreground">
          <p>No projects yet. Create your first project to get started.</p>
        </div>
      </div>
    </div>
  );
};

export default Projects;
