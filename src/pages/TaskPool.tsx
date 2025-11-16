import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Search, User } from "lucide-react";
import { format } from "@/lib/dateUtils";

interface Task {
  id: string;
  title: string;
  description: string | null;
  priority: string;
  status: string;
  type: string;
  due_date: string | null;
  skill_tags: string[] | null;
  created_at: string;
  project: { name: string } | null;
}

const TaskPool = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetchTaskPool();
    
    // Subscribe to changes
    const channel = supabase
      .channel('task-pool-changes')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'tasks' },
        () => fetchTaskPool()
      )
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'task_assignees' },
        () => fetchTaskPool()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchTaskPool = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("tasks")
        .select(`
          id,
          title,
          description,
          priority,
          status,
          type,
          due_date,
          skill_tags,
          created_at,
          project:projects(name)
        `)
        .is("assignee_id", null)
        .not("status", "in", '("Done","Canceled")')
        .order("priority", { ascending: false })
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Filter out tasks that have assignees in task_assignees table
      const tasksWithAssignees = await Promise.all(
        (data || []).map(async (task) => {
          const { count } = await supabase
            .from("task_assignees")
            .select("*", { count: "exact", head: true })
            .eq("task_id", task.id);
          
          return { task, hasAssignees: (count || 0) > 0 };
        })
      );

      setTasks(
        tasksWithAssignees
          .filter(({ hasAssignees }) => !hasAssignees)
          .map(({ task }) => task as Task)
      );
    } catch (error: any) {
      console.error("Error fetching task pool:", error);
      toast.error(t("common.error"));
    } finally {
      setLoading(false);
    }
  };

  const claimTask = async (taskId: string) => {
    if (!user) return;

    try {
      // Add user as assignee
      const { error: assignError } = await supabase
        .from("task_assignees")
        .insert({
          task_id: taskId,
          assignee_id: user.id,
          assigned_by: user.id,
        });

      if (assignError) throw assignError;

      // Update task assignee_id for backward compatibility
      const { error: updateError } = await supabase
        .from("tasks")
        .update({ 
          assignee_id: user.id,
          claimed_by: user.id,
        })
        .eq("id", taskId);

      if (updateError) throw updateError;

      toast.success(t("common.taskClaimed"));
      fetchTaskPool();
    } catch (error: any) {
      console.error("Error claiming task:", error);
      toast.error(t("common.error"));
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

  const getTypeColor = (type: string) => {
    const colors = {
      Task: "bg-blue-500/10 text-blue-500 border-blue-500/20",
      Bug: "bg-red-500/10 text-red-500 border-red-500/20",
      Request: "bg-purple-500/10 text-purple-500 border-purple-500/20",
      Idea: "bg-green-500/10 text-green-500 border-green-500/20",
      Improvement: "bg-orange-500/10 text-orange-500 border-orange-500/20",
    };
    return colors[type as keyof typeof colors] || colors.Task;
  };

  const filteredTasks = tasks.filter((task) =>
    task.title.toLowerCase().includes(search.toLowerCase()) ||
    task.description?.toLowerCase().includes(search.toLowerCase()) ||
    task.skill_tags?.some((tag) => tag.toLowerCase().includes(search.toLowerCase()))
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{t("common.taskPool")}</h1>
        <p className="text-muted-foreground mt-1">
          {t("taskPool.subtitle")}
        </p>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder={t("tasks.search")}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-8"
        />
      </div>

      {filteredTasks.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            <p>{search ? t("tasks.noTasks") : t("taskPool.noAvailableTasks")}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredTasks.map((task) => (
            <Card
              key={task.id}
              className="cursor-pointer hover:bg-accent transition-colors"
            >
              <CardHeader>
                <CardTitle className="text-base line-clamp-2">
                  {task.title}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {task.description && (
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {task.description}
                  </p>
                )}
                
                <div className="flex flex-wrap gap-2">
                  <Badge className={getPriorityColor(task.priority)} variant="outline">
                    {t(`tasks.priority.${task.priority}`)}
                  </Badge>
                  <Badge className={getTypeColor(task.type)} variant="outline">
                    {t(`tasks.type.${task.type}`)}
                  </Badge>
                </div>

                {task.skill_tags && task.skill_tags.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {task.skill_tags.slice(0, 3).map((tag) => (
                      <Badge key={tag} variant="secondary" className="text-xs">
                        {tag}
                      </Badge>
                    ))}
                    {task.skill_tags.length > 3 && (
                      <Badge variant="secondary" className="text-xs">
                        +{task.skill_tags.length - 3}
                      </Badge>
                    )}
                  </div>
                )}

                {task.due_date && (
                  <p className="text-xs text-muted-foreground">
                    {t("tasks.dueDate")}: {format(new Date(task.due_date), "PPP")}
                  </p>
                )}

                {task.project && (
                  <p className="text-xs text-muted-foreground">
                    {t("tasks.project")}: {task.project.name}
                  </p>
                )}

                <div className="flex gap-2 pt-2">
                  <Button
                    onClick={() => claimTask(task.id)}
                    className="flex-1"
                    size="sm"
                  >
                    <User className="h-4 w-4 mr-2" />
                    {t("common.claimTask")}
                  </Button>
                  <Button
                    onClick={() => navigate(`/tasks/${task.id}`)}
                    variant="outline"
                    size="sm"
                  >
                    {t("common.view")}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default TaskPool;
