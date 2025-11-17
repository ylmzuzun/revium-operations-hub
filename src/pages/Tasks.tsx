import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Plus, List, LayoutGrid, Eye, EyeOff } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { TaskList } from "@/components/tasks/TaskList";
import { TaskBoard } from "@/components/tasks/TaskBoard";
import { useUserRole } from "@/hooks/useUserRole";
import { Badge } from "@/components/ui/badge";

const Tasks = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [view, setView] = useState<"list" | "kanban">("list");
  const { isAdminOrManager } = useUserRole();
  const [showAll, setShowAll] = useState(false);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{t("tasks.title")}</h1>
            <p className="text-muted-foreground mt-1">{t("tasks.subtitle")}</p>
          </div>
          {isAdminOrManager && (
            <Badge 
              variant={showAll ? "default" : "outline"} 
              className="cursor-pointer h-8 px-3"
              onClick={() => setShowAll(!showAll)}
            >
              {showAll ? <Eye className="h-3 w-3 mr-1" /> : <EyeOff className="h-3 w-3 mr-1" />}
              {showAll ? t("common.showingAll") : t("common.showingMine")}
            </Badge>
          )}
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
