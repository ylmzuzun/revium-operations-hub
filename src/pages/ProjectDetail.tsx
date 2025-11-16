import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Edit, Calendar, User } from "lucide-react";
import { ProjectDialog } from "@/components/projects/ProjectDialog";
import { TaskList } from "@/components/tasks/TaskList";
import { format } from "@/lib/dateUtils";

const ProjectDetail = () => {
  const { t } = useTranslation();
  const { id } = useParams();
  const navigate = useNavigate();
  const [project, setProject] = useState<any>(null);
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);

  useEffect(() => {
    if (id) {
      fetchProject();
      fetchTasks();
    }
  }, [id]);

  const fetchProject = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("projects")
      .select(`
        *,
        owner:profiles!projects_owner_id_fkey(id, name, surname)
      `)
      .eq("id", id)
      .maybeSingle();

    if (error) {
      console.error("Error fetching project:", error);
    } else if (data) {
      setProject(data);
    }
    setLoading(false);
  };

  const fetchTasks = async () => {
    const { data } = await supabase
      .from("tasks")
      .select(`
        *,
        assignee:profiles!tasks_assignee_id_fkey(id, name, surname)
      `)
      .eq("project_id", id)
      .order("created_at", { ascending: false });

    if (data) setTasks(data);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "Completed":
        return "bg-success text-success-foreground";
      case "In Progress":
        return "bg-primary text-primary-foreground";
      case "On Hold":
        return "bg-warning text-warning-foreground";
      case "Planned":
        return "bg-muted text-muted-foreground";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="flex items-center justify-center h-full">
        <Card>
          <CardContent className="p-8">
            <p className="text-muted-foreground">{t("common.projectNotFound")}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const totalTasks = tasks.length;
  const completedTasks = tasks.filter((t) => t.status === "Done").length;
  const progress = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate("/projects")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-3xl font-bold tracking-tight">{project.name}</h1>
          <p className="text-muted-foreground mt-1">{t("projects.projectDetails")}</p>
        </div>
        <Button onClick={() => setDialogOpen(true)}>
          <Edit className="h-4 w-4 mr-2" />
          {t("common.edit")}
        </Button>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>{t("tasks.description")}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground whitespace-pre-wrap">
              {project.description || "No description provided"}
            </p>

            {project.tags && project.tags.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-4">
                {project.tags.map((tag: string) => (
                  <Badge key={tag} variant="secondary">
                    {tag}
                  </Badge>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground">{t("tasks.status")}</p>
              <Badge className={`${getStatusColor(project.status)} mt-1`}>
                {t(`projectStatus.${project.status}`)}
              </Badge>
            </div>

            <div>
              <p className="text-sm text-muted-foreground">{t("tasks.priority")}</p>
              <Badge className="mt-1">{t(`taskPriority.${project.priority}`)}</Badge>
            </div>

            {project.owner && (
              <div>
                <p className="text-sm text-muted-foreground mb-1">
                  <User className="h-3 w-3 inline mr-1" />
                  {t("projects.owner")}
                </p>
                <p className="text-sm">
                  {project.owner.name} {project.owner.surname}
                </p>
              </div>
            )}

            {project.start_date && (
              <div>
                <p className="text-sm text-muted-foreground mb-1">
                  <Calendar className="h-3 w-3 inline mr-1" />
                  {t("projects.startDate")}
                </p>
                <p className="text-sm">{format(new Date(project.start_date), "MMM dd, yyyy")}</p>
              </div>
            )}

            {project.end_date && (
              <div>
                <p className="text-sm text-muted-foreground mb-1">
                  <Calendar className="h-3 w-3 inline mr-1" />
                  {t("projects.endDate")}
                </p>
                <p className="text-sm">{format(new Date(project.end_date), "MMM dd, yyyy")}</p>
              </div>
            )}

            <div>
              <div className="flex items-center justify-between text-sm mb-2">
                <span className="text-muted-foreground">{t("projects.progress")}</span>
                <span className="font-medium">{Math.round(progress)}%</span>
              </div>
              <Progress value={progress} className="h-2" />
              <p className="text-xs text-muted-foreground mt-1">
                {completedTasks} / {totalTasks} tasks completed
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <Tabs defaultValue="tasks">
          <CardHeader>
            <TabsList>
              <TabsTrigger value="tasks">{t("tasks.title")}</TabsTrigger>
              <TabsTrigger value="timeline">{t("projects.timeline")}</TabsTrigger>
            </TabsList>
          </CardHeader>
          <CardContent>
            <TabsContent value="tasks">
              {tasks.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  {t("tasks.noTasks")}
                </div>
              ) : (
                <div className="space-y-2">
                  {tasks.map((task) => (
                    <div
                      key={task.id}
                      className="flex items-center justify-between p-3 border rounded-lg cursor-pointer hover:bg-accent"
                      onClick={() => navigate(`/tasks/${task.id}`)}
                    >
                      <div className="flex-1">
                        <p className="font-medium">{task.title}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="outline" className="text-xs">
                            {t(`taskType.${task.type}`)}
                          </Badge>
                          <Badge
                            className={
                              task.status === "Done"
                                ? "bg-success/10 text-success"
                                : "bg-muted text-muted-foreground"
                            }
                          >
                            {t(`taskStatus.${task.status}`)}
                          </Badge>
                        </div>
                      </div>
                      {task.assignee && (
                        <p className="text-sm text-muted-foreground">
                          {task.assignee.name} {task.assignee.surname}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="timeline">
              <div className="text-center py-8 text-muted-foreground">
                {t("projects.timelineComingSoon")}
              </div>
            </TabsContent>
          </CardContent>
        </Tabs>
      </Card>

      <ProjectDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        project={project}
        onSuccess={() => {
          fetchProject();
          setDialogOpen(false);
        }}
      />
    </div>
  );
};

export default ProjectDetail;
