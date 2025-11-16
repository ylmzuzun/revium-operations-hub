import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/hooks/use-toast";
import { Database } from "@/integrations/supabase/types";

type TaskStatus = Database["public"]["Enums"]["task_status"];

const STATUSES: TaskStatus[] = ["Backlog", "To Do", "In Progress", "Blocked", "Done"];

export const TaskBoard = () => {
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
        assignee:profiles!tasks_assignee_id_fkey(id, name, surname)
      `)
      .order("created_at", { ascending: false });

    if (data) setTasks(data);
    setLoading(false);
  };

  const onDragEnd = async (result: any) => {
    if (!result.destination) return;

    const taskId = result.draggableId;
    const newStatus = result.destination.droppableId as TaskStatus;

    setTasks((prev) =>
      prev.map((task) => (task.id === taskId ? { ...task, status: newStatus } : task))
    );

    const { error } = await supabase.from("tasks").update({ status: newStatus }).eq("id", taskId);

    if (error) {
      toast({ title: t("common.error"), description: error.message, variant: "destructive" });
      fetchTasks();
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "Critical":
        return "border-l-destructive";
      case "High":
        return "border-l-orange-500";
      case "Medium":
        return "border-l-yellow-500";
      case "Low":
        return "border-l-green-500";
      default:
        return "border-l-muted";
    }
  };

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {STATUSES.map((status) => (
          <div key={status} className="space-y-3">
            <Skeleton className="h-6 w-full" />
            <Skeleton className="h-32 w-full" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <DragDropContext onDragEnd={onDragEnd}>
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {STATUSES.map((status) => {
          const statusTasks = tasks.filter((task) => task.status === status);

          return (
            <div key={status} className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-sm">{t(`taskStatus.${status}`)}</h3>
                <span className="text-xs text-muted-foreground">{statusTasks.length}</span>
              </div>

              <Droppable droppableId={status}>
                {(provided, snapshot) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className={`space-y-2 min-h-[400px] rounded-lg border-2 border-dashed p-2 transition-colors ${
                      snapshot.isDraggingOver ? "border-primary bg-accent/50" : "border-border"
                    }`}
                  >
                    {statusTasks.length === 0 ? (
                      <p className="text-xs text-muted-foreground text-center py-4">
                        {t("tasks.noTasks")}
                      </p>
                    ) : (
                      statusTasks.map((task, index) => (
                        <Draggable key={task.id} draggableId={task.id} index={index}>
                          {(provided, snapshot) => (
                            <Card
                              ref={provided.innerRef}
                              {...provided.draggableProps}
                              {...provided.dragHandleProps}
                              className={`cursor-pointer border-l-4 ${getPriorityColor(
                                task.priority
                              )} ${snapshot.isDragging ? "shadow-lg" : ""}`}
                              onClick={() => navigate(`/tasks/${task.id}`)}
                            >
                              <CardContent className="p-3 space-y-2">
                                <p className="text-sm font-medium line-clamp-2">{task.title}</p>

                                <div className="flex items-center justify-between">
                                  <Badge variant="outline" className="text-xs">
                                    {t(`taskType.${task.type}`)}
                                  </Badge>

                                  {task.assignee && (
                                    <Avatar className="h-6 w-6">
                                      <AvatarFallback className="text-xs">
                                        {task.assignee.name[0]}
                                        {task.assignee.surname[0]}
                                      </AvatarFallback>
                                    </Avatar>
                                  )}
                                </div>

                                {task.due_date && (
                                  <p className="text-xs text-muted-foreground">
                                    {new Date(task.due_date).toLocaleDateString()}
                                  </p>
                                )}
                              </CardContent>
                            </Card>
                          )}
                        </Draggable>
                      ))
                    )}
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
            </div>
          );
        })}
      </div>
    </DragDropContext>
  );
};
