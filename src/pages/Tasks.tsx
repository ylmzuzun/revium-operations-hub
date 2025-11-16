import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Plus, List, LayoutGrid } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { TaskList } from "@/components/tasks/TaskList";
import { TaskBoard } from "@/components/tasks/TaskBoard";

const Tasks = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [view, setView] = useState<"list" | "kanban">("list");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t("tasks.title")}</h1>
          <p className="text-muted-foreground mt-1">{t("tasks.subtitle")}</p>
        </div>
        <div className="flex items-center gap-2">
          <Tabs value={view} onValueChange={(v) => setView(v as "list" | "kanban")}>
            <TabsList>
              <TabsTrigger value="list" className="gap-2">
                <List className="h-4 w-4" />
                {t("tasks.list")}
              </TabsTrigger>
              <TabsTrigger value="kanban" className="gap-2">
                <LayoutGrid className="h-4 w-4" />
                {t("tasks.board")}
              </TabsTrigger>
            </TabsList>
          </Tabs>
          <Button onClick={() => navigate("/tasks/new")} className="gap-2">
            <Plus className="h-4 w-4" />
            {t("tasks.newTask")}
          </Button>
        </div>
      </div>

      {view === "list" ? <TaskList /> : <TaskBoard />}
    </div>
  );
};

export default Tasks;
