import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Plus, List, LayoutGrid } from "lucide-react";
import { useNavigate } from "react-router-dom";

const Tasks = () => {
  const navigate = useNavigate();
  const [view, setView] = useState<"list" | "kanban">("list");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Tasks</h1>
          <p className="text-muted-foreground mt-1">
            Manage and track all your tasks
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Tabs value={view} onValueChange={(v) => setView(v as "list" | "kanban")}>
            <TabsList>
              <TabsTrigger value="list" className="gap-2">
                <List className="h-4 w-4" />
                List
              </TabsTrigger>
              <TabsTrigger value="kanban" className="gap-2">
                <LayoutGrid className="h-4 w-4" />
                Board
              </TabsTrigger>
            </TabsList>
          </Tabs>
          <Button onClick={() => navigate("/tasks/new")} className="gap-2">
            <Plus className="h-4 w-4" />
            New Task
          </Button>
        </div>
      </div>

      {view === "list" ? (
        <div className="rounded-lg border bg-card">
          <div className="p-8 text-center text-muted-foreground">
            <p>No tasks yet. Create your first task to get started.</p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
          {["Backlog", "To Do", "In Progress", "Blocked", "Done"].map((status) => (
            <div key={status} className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-sm">{status}</h3>
                <span className="text-xs text-muted-foreground">0</span>
              </div>
              <div className="space-y-2 min-h-[400px] rounded-lg border-2 border-dashed p-2">
                <p className="text-xs text-muted-foreground text-center py-4">
                  No tasks
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Tasks;
