import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { TaskForm } from "@/components/tasks/TaskForm";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

const TaskNew = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate("/tasks")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t("tasks.createTask")}</h1>
          <p className="text-muted-foreground mt-1">{t("tasks.subtitle")}</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("tasks.taskDetails")}</CardTitle>
        </CardHeader>
        <CardContent>
          <TaskForm
            onSuccess={() => navigate("/tasks")}
            onCancel={() => navigate("/tasks")}
          />
        </CardContent>
      </Card>
    </div>
  );
};

export default TaskNew;
