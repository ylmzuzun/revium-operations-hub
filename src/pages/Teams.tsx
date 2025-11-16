import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

const Teams = () => {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Teams</h1>
          <p className="text-muted-foreground mt-1">
            Manage your organization's teams
          </p>
        </div>
        <Button className="gap-2">
          <Plus className="h-4 w-4" />
          New Team
        </Button>
      </div>

      <div className="rounded-lg border bg-card">
        <div className="p-8 text-center text-muted-foreground">
          <p>No teams yet. Create your first team to get started.</p>
        </div>
      </div>
    </div>
  );
};

export default Teams;
