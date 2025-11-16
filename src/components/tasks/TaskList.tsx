import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";

export const TaskList = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTasks();
  }, []);

  const fetchTasks = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("tasks")
      .select(`
        *,
        assignee:profiles!tasks_assignee_id_fkey(id, name, surname),
        project:projects(id, name)
      `)
      .order("created_at", { ascending: false });

    if (data) setTasks(data);
    setLoading(false);
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "Critical":
        return "destructive";
      case "High":
        return "default";
      case "Medium":
        return "secondary";
      case "Low":
        return "outline";
      default:
        return "secondary";
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "Done":
        return "bg-success/10 text-success";
      case "In Progress":
        return "bg-primary/10 text-primary";
      case "Blocked":
        return "bg-destructive/10 text-destructive";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  if (loading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3, 4, 5].map((i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    );
  }

  if (tasks.length === 0) {
    return (
      <div className="rounded-lg border bg-card p-8 text-center text-muted-foreground">
        <p>{t("tasks.noTasks")}</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t("tasks.title")}</TableHead>
            <TableHead>{t("tasks.type")}</TableHead>
            <TableHead>{t("tasks.status")}</TableHead>
            <TableHead>{t("tasks.priority")}</TableHead>
            <TableHead>{t("tasks.assignee")}</TableHead>
            <TableHead>{t("tasks.dueDate")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {tasks.map((task) => (
            <TableRow
              key={task.id}
              className="cursor-pointer"
              onClick={() => navigate(`/tasks/${task.id}`)}
            >
              <TableCell className="font-medium">{task.title}</TableCell>
              <TableCell>
                <Badge variant="outline">{t(`taskType.${task.type}`)}</Badge>
              </TableCell>
              <TableCell>
                <Badge className={getStatusColor(task.status)} variant="secondary">
                  {t(`taskStatus.${task.status}`)}
                </Badge>
              </TableCell>
              <TableCell>
                <Badge variant={getPriorityColor(task.priority)}>
                  {t(`taskPriority.${task.priority}`)}
                </Badge>
              </TableCell>
              <TableCell>
                {task.assignee ? (
                  <div className="flex items-center gap-2">
                    <Avatar className="h-6 w-6">
                      <AvatarFallback className="text-xs">
                        {task.assignee.name[0]}
                        {task.assignee.surname[0]}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-sm">
                      {task.assignee.name} {task.assignee.surname}
                    </span>
                  </div>
                ) : (
                  <span className="text-sm text-muted-foreground">{t("tasks.unassigned")}</span>
                )}
              </TableCell>
              <TableCell>
                {task.due_date ? format(new Date(task.due_date), "MMM dd, yyyy") : "-"}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
};
