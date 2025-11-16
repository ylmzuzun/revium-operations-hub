import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Link, X, AlertCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface Task {
  id: string;
  title: string;
  status: string;
  priority: string;
}

interface Dependency {
  id: string;
  task_id: string;
  depends_on_task_id: string;
  depends_on_task: Task;
}

interface BlockedBy {
  id: string;
  task_id: string;
  depends_on_task_id: string;
  task: Task;
}

interface DependenciesSectionProps {
  taskId: string;
  canEdit: boolean;
}

export const DependenciesSection = ({ taskId, canEdit }: DependenciesSectionProps) => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [dependencies, setDependencies] = useState<Dependency[]>([]);
  const [blockedBy, setBlockedBy] = useState<BlockedBy[]>([]);
  const [availableTasks, setAvailableTasks] = useState<Task[]>([]);
  const [selectedTask, setSelectedTask] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [dependencyToDelete, setDependencyToDelete] = useState<string | null>(null);

  useEffect(() => {
    fetchDependencies();
    fetchAvailableTasks();
    setupRealtimeSubscription();
  }, [taskId]);

  const setupRealtimeSubscription = () => {
    const channel = supabase
      .channel('task-dependencies-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'task_dependencies',
          filter: `task_id=eq.${taskId}`
        },
        () => {
          fetchDependencies();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'task_dependencies',
          filter: `depends_on_task_id=eq.${taskId}`
        },
        () => {
          fetchDependencies();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  const fetchDependencies = async () => {
    try {
      // Fetch tasks that this task depends on (blocked by)
      const { data: deps, error: depsError } = await supabase
        .from("task_dependencies")
        .select(`
          id,
          task_id,
          depends_on_task_id,
          depends_on_task:tasks!task_dependencies_depends_on_task_id_fkey(id, title, status, priority)
        `)
        .eq("task_id", taskId);

      if (depsError) throw depsError;
      setDependencies((deps as any) || []);

      // Fetch tasks that depend on this task (blocking)
      const { data: blocked, error: blockedError } = await supabase
        .from("task_dependencies")
        .select(`
          id,
          task_id,
          depends_on_task_id,
          task:tasks!task_dependencies_task_id_fkey(id, title, status, priority)
        `)
        .eq("depends_on_task_id", taskId);

      if (blockedError) throw blockedError;
      setBlockedBy((blocked as any) || []);
    } catch (error) {
      console.error("Error fetching dependencies:", error);
      toast.error(t("common.error"));
    } finally {
      setLoading(false);
    }
  };

  const fetchAvailableTasks = async () => {
    try {
      const { data, error } = await supabase
        .from("tasks")
        .select("id, title, status, priority")
        .neq("id", taskId)
        .order("title");

      if (error) throw error;
      setAvailableTasks(data || []);
    } catch (error) {
      console.error("Error fetching available tasks:", error);
    }
  };

  const handleAddDependency = async () => {
    if (!selectedTask || !user) return;

    setAdding(true);
    try {
      const { error } = await supabase
        .from("task_dependencies")
        .insert({
          task_id: taskId,
          depends_on_task_id: selectedTask,
          created_by: user.id,
        });

      if (error) throw error;

      toast.success(t("tasks.dependencies.dependencyAdded"));
      setSelectedTask("");
      fetchDependencies();
    } catch (error: any) {
      console.error("Error adding dependency:", error);
      if (error.code === "23505") {
        toast.error(t("tasks.dependencies.alreadyExists"));
      } else {
        toast.error(t("common.error"));
      }
    } finally {
      setAdding(false);
    }
  };

  const confirmDeleteDependency = (dependencyId: string) => {
    setDependencyToDelete(dependencyId);
    setDeleteDialogOpen(true);
  };

  const handleDeleteDependency = async () => {
    if (!dependencyToDelete) return;

    try {
      const { error } = await supabase
        .from("task_dependencies")
        .delete()
        .eq("id", dependencyToDelete);

      if (error) throw error;

      toast.success(t("tasks.dependencies.dependencyRemoved"));
      fetchDependencies();
    } catch (error) {
      console.error("Error deleting dependency:", error);
      toast.error(t("common.error"));
    } finally {
      setDeleteDialogOpen(false);
      setDependencyToDelete(null);
    }
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
        return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300";
      case "In Progress":
        return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300";
      case "Blocked":
        return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300";
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300";
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Link className="h-5 w-5" />
            {t("tasks.dependencies.title")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
        </CardContent>
      </Card>
    );
  }

  const hasBlockingDependencies = dependencies.some(
    (dep) => dep.depends_on_task.status !== "Done" && dep.depends_on_task.status !== "Canceled"
  );

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Link className="h-5 w-5" />
            {t("tasks.dependencies.title")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {hasBlockingDependencies && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/20">
              <AlertCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-medium text-destructive">
                  {t("tasks.dependencies.blockedWarning")}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {t("tasks.dependencies.blockedWarningDescription")}
                </p>
              </div>
            </div>
          )}

          {canEdit && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium">{t("tasks.dependencies.addDependency")}</h4>
              <div className="flex gap-2">
                <Select value={selectedTask} onValueChange={setSelectedTask}>
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder={t("tasks.dependencies.selectTask")} />
                  </SelectTrigger>
                  <SelectContent>
                    {availableTasks
                      .filter(
                        (task) =>
                          !dependencies.some((dep) => dep.depends_on_task_id === task.id)
                      )
                      .map((task) => (
                        <SelectItem key={task.id} value={task.id}>
                          {task.title}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
                <Button
                  onClick={handleAddDependency}
                  disabled={!selectedTask || adding}
                  size="sm"
                >
                  {adding ? t("common.saving") : t("common.add")}
                </Button>
              </div>
            </div>
          )}

          <div className="space-y-4">
            <div>
              <h4 className="text-sm font-medium mb-3">
                {t("tasks.dependencies.blockedBy")} ({dependencies.length})
              </h4>
              {dependencies.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  {t("tasks.dependencies.noDependencies")}
                </p>
              ) : (
                <div className="space-y-2">
                  {dependencies.map((dep) => (
                    <div
                      key={dep.id}
                      className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-accent transition-colors group"
                    >
                      <div
                        className="flex-1 cursor-pointer"
                        onClick={() => navigate(`/tasks/${dep.depends_on_task_id}`)}
                      >
                        <p className="text-sm font-medium">{dep.depends_on_task.title}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge
                            variant="outline"
                            className={getStatusColor(dep.depends_on_task.status)}
                          >
                            {t(`taskStatus.${dep.depends_on_task.status}`)}
                          </Badge>
                          <Badge variant={getPriorityColor(dep.depends_on_task.priority)}>
                            {t(`taskPriority.${dep.depends_on_task.priority}`)}
                          </Badge>
                        </div>
                      </div>
                      {canEdit && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={() => confirmDeleteDependency(dep.id)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div>
              <h4 className="text-sm font-medium mb-3">
                {t("tasks.dependencies.blocking")} ({blockedBy.length})
              </h4>
              {blockedBy.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  {t("tasks.dependencies.notBlocking")}
                </p>
              ) : (
                <div className="space-y-2">
                  {blockedBy.map((blocked) => (
                    <div
                      key={blocked.id}
                      className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-accent cursor-pointer transition-colors"
                      onClick={() => navigate(`/tasks/${blocked.task_id}`)}
                    >
                      <div className="flex-1">
                        <p className="text-sm font-medium">{blocked.task.title}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge
                            variant="outline"
                            className={getStatusColor(blocked.task.status)}
                          >
                            {t(`taskStatus.${blocked.task.status}`)}
                          </Badge>
                          <Badge variant={getPriorityColor(blocked.task.priority)}>
                            {t(`taskPriority.${blocked.task.priority}`)}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("tasks.dependencies.removeDependency")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("tasks.dependencies.removeDependencyConfirm")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteDependency}>
              {t("common.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
