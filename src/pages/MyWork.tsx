import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Tables } from "@/integrations/supabase/types";
import { formatDistanceToNow } from "date-fns";

type Task = Tables<"tasks"> & {
  assignee: Tables<"profiles"> | null;
};

const MyWork = () => {
  const { user } = useAuth();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [assignedToMe, setAssignedToMe] = useState<Task[]>([]);
  const [createdByMe, setCreatedByMe] = useState<Task[]>([]);
  const [watching, setWatching] = useState<Task[]>([]);
  const [dueThisWeek, setDueThisWeek] = useState<Task[]>([]);

  useEffect(() => {
    if (user) {
      fetchMyWork();
    }
  }, [user]);

  const fetchMyWork = async () => {
    if (!user) return;
    setLoading(true);

    try {
      const now = new Date();
      const weekFromNow = new Date();
      weekFromNow.setDate(now.getDate() + 7);

      // Assigned to me
      const { data: assigned } = await supabase
        .from("tasks")
        .select("*, assignee:profiles!tasks_assignee_id_fkey(*)")
        .eq("assignee_id", user.id)
        .not("status", "in", '("Done","Canceled")')
        .order("created_at", { ascending: false })
        .limit(5);

      setAssignedToMe((assigned as Task[]) || []);

      // Created by me
      const { data: created } = await supabase
        .from("tasks")
        .select("*, assignee:profiles!tasks_assignee_id_fkey(*)")
        .eq("created_by", user.id)
        .order("created_at", { ascending: false })
        .limit(5);

      setCreatedByMe((created as Task[]) || []);

      // Watching
      const { data: watchedTasks } = await supabase
        .from("task_watchers")
        .select("task_id")
        .eq("user_id", user.id);

      if (watchedTasks && watchedTasks.length > 0) {
        const taskIds = watchedTasks.map((w) => w.task_id);
        const { data: watched } = await supabase
          .from("tasks")
          .select("*, assignee:profiles!tasks_assignee_id_fkey(*)")
          .in("id", taskIds)
          .order("created_at", { ascending: false })
          .limit(5);

        setWatching((watched as Task[]) || []);
      }

      // Due this week
      const { data: due } = await supabase
        .from("tasks")
        .select("*, assignee:profiles!tasks_assignee_id_fkey(*)")
        .eq("assignee_id", user.id)
        .gte("due_date", now.toISOString())
        .lte("due_date", weekFromNow.toISOString())
        .not("status", "in", '("Done","Canceled")')
        .order("due_date", { ascending: true })
        .limit(5);

      setDueThisWeek((due as Task[]) || []);
    } catch (error) {
      console.error("Error fetching my work:", error);
    } finally {
      setLoading(false);
    }
  };

  const getPriorityColor = (priority: string) => {
    const colors = {
      Low: "bg-blue-500/10 text-blue-500 border-blue-500/20",
      Medium: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20",
      High: "bg-orange-500/10 text-orange-500 border-orange-500/20",
      Critical: "bg-red-500/10 text-red-500 border-red-500/20",
    };
    return colors[priority as keyof typeof colors] || colors.Medium;
  };

  const getStatusColor = (status: string) => {
    const colors = {
      Backlog: "bg-gray-500/10 text-gray-500 border-gray-500/20",
      "To Do": "bg-blue-500/10 text-blue-500 border-blue-500/20",
      "In Progress": "bg-purple-500/10 text-purple-500 border-purple-500/20",
      Blocked: "bg-red-500/10 text-red-500 border-red-500/20",
      "Waiting Approval": "bg-yellow-500/10 text-yellow-500 border-yellow-500/20",
      Done: "bg-green-500/10 text-green-500 border-green-500/20",
      Canceled: "bg-gray-500/10 text-gray-500 border-gray-500/20",
    };
    return colors[status as keyof typeof colors] || colors.Backlog;
  };

  const renderTaskList = (tasks: Task[]) => {
    if (tasks.length === 0) {
      return (
        <p className="text-sm text-muted-foreground text-center py-8">
          {t("myWork.noTasks")}
        </p>
      );
    }

    return (
      <div className="space-y-2">
        {tasks.map((task) => (
          <div
            key={task.id}
            className="p-3 rounded-lg border cursor-pointer hover:bg-accent transition-colors"
            onClick={() => navigate(`/tasks/${task.id}`)}
          >
            <p className="font-medium mb-2">{task.title}</p>
            <div className="flex items-center gap-2 flex-wrap">
              <Badge className={getStatusColor(task.status)} variant="outline">
                {t(`tasks.status.${task.status}`)}
              </Badge>
              <Badge className={getPriorityColor(task.priority)} variant="outline">
                {t(`tasks.priority.${task.priority}`)}
              </Badge>
              {task.due_date && (
                <span className="text-xs text-muted-foreground">
                  {t("tasks.due")}:{" "}
                  {formatDistanceToNow(new Date(task.due_date), { addSuffix: true })}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid gap-6 md:grid-cols-2">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-64" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{t("myWork.title")}</h1>
        <p className="text-muted-foreground mt-1">{t("myWork.subtitle")}</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{t("myWork.assignedToMe")}</CardTitle>
          </CardHeader>
          <CardContent>{renderTaskList(assignedToMe)}</CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("myWork.createdByMe")}</CardTitle>
          </CardHeader>
          <CardContent>{renderTaskList(createdByMe)}</CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("myWork.watching")}</CardTitle>
          </CardHeader>
          <CardContent>{renderTaskList(watching)}</CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("myWork.dueThisWeek")}</CardTitle>
          </CardHeader>
          <CardContent>{renderTaskList(dueThisWeek)}</CardContent>
        </Card>
      </div>
    </div>
  );
};

export default MyWork;
