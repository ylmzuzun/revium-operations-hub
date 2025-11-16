import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Gantt as GanttChart, Task, ViewMode } from "gantt-task-react";
import "gantt-task-react/dist/index.css";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

interface Project {
  id: string;
  name: string;
}

interface TaskData {
  id: string;
  title: string;
  start_date: string | null;
  due_date: string | null;
  status: string;
  priority: string;
  project_id: string | null;
  project: { name: string } | null;
}

interface Dependency {
  task_id: string;
  depends_on_task_id: string;
}

const Gantt = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState<string>("all");
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>(ViewMode.Month);

  useEffect(() => {
    fetchProjects();
  }, []);

  useEffect(() => {
    fetchTasks();
  }, [selectedProject]);

  const fetchProjects = async () => {
    try {
      const { data, error } = await supabase
        .from("projects")
        .select("id, name")
        .order("name");

      if (error) throw error;
      setProjects(data || []);
    } catch (error) {
      console.error("Error fetching projects:", error);
      toast.error(t("common.error"));
    }
  };

  const fetchTasks = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from("tasks")
        .select(`
          id,
          title,
          start_date,
          due_date,
          status,
          priority,
          project_id,
          project:projects(name)
        `)
        .not("due_date", "is", null)
        .order("start_date", { ascending: true });

      if (selectedProject !== "all") {
        query = query.eq("project_id", selectedProject);
      }

      const { data: tasksData, error: tasksError } = await query;
      if (tasksError) throw tasksError;

      // Fetch dependencies
      const { data: dependencies, error: depsError } = await supabase
        .from("task_dependencies")
        .select("task_id, depends_on_task_id");

      if (depsError) throw depsError;

      // Transform tasks to Gantt format
      const ganttTasks: Task[] = (tasksData as TaskData[])
        .filter((task) => task.start_date && task.due_date)
        .map((task) => {
          const deps = (dependencies as Dependency[])
            .filter((dep) => dep.task_id === task.id)
            .map((dep) => dep.depends_on_task_id);

          const startDate = new Date(task.start_date!);
          const endDate = new Date(task.due_date!);

          // Ensure end date is after start date
          if (endDate <= startDate) {
            endDate.setDate(startDate.getDate() + 1);
          }

          return {
            id: task.id,
            name: task.title,
            start: startDate,
            end: endDate,
            progress: task.status === "Done" ? 100 : task.status === "In Progress" ? 50 : 0,
            type: "task" as const,
            dependencies: deps,
            styles: {
              backgroundColor: getTaskColor(task.priority, task.status),
              progressColor: getProgressColor(task.status),
              progressSelectedColor: getProgressColor(task.status),
            },
            project: task.project?.name || "No Project",
          };
        });

      // Group by project if showing all
      if (selectedProject === "all") {
        // Create project groups
        const projectGroups = new Map<string, Task[]>();
        ganttTasks.forEach((task) => {
          const projectName = task.project || "No Project";
          if (!projectGroups.has(projectName)) {
            projectGroups.set(projectName, []);
          }
          projectGroups.get(projectName)!.push(task);
        });

        // Create final task list with project headers
        const finalTasks: Task[] = [];
        projectGroups.forEach((projectTasks, projectName) => {
          if (projectTasks.length > 0) {
            const projectStart = new Date(
              Math.min(...projectTasks.map((t) => t.start.getTime()))
            );
            const projectEnd = new Date(
              Math.max(...projectTasks.map((t) => t.end.getTime()))
            );

            // Add project header
            finalTasks.push({
              id: `project-${projectName}`,
              name: projectName,
              start: projectStart,
              end: projectEnd,
              progress: 0,
              type: "project" as const,
              hideChildren: false,
            });

            // Add tasks under project
            projectTasks.forEach((task) => {
              finalTasks.push({
                ...task,
                project: `project-${projectName}`,
              });
            });
          }
        });

        setTasks(finalTasks);
      } else {
        setTasks(ganttTasks);
      }
    } catch (error) {
      console.error("Error fetching tasks:", error);
      toast.error(t("common.error"));
    } finally {
      setLoading(false);
    }
  };

  const getTaskColor = (priority: string, status: string) => {
    if (status === "Done") return "#10b981";
    if (status === "Blocked") return "#ef4444";

    switch (priority) {
      case "Critical":
        return "#dc2626";
      case "High":
        return "#f97316";
      case "Medium":
        return "#3b82f6";
      case "Low":
        return "#6b7280";
      default:
        return "#3b82f6";
    }
  };

  const getProgressColor = (status: string) => {
    switch (status) {
      case "Done":
        return "#059669";
      case "In Progress":
        return "#2563eb";
      default:
        return "#94a3b8";
    }
  };

  const handleTaskClick = (task: Task) => {
    if (!task.id.startsWith("project-")) {
      navigate(`/tasks/${task.id}`);
    }
  };

  const handleExpanderClick = (task: Task) => {
    setTasks(
      tasks.map((t) =>
        t.id === task.id ? { ...t, hideChildren: !t.hideChildren } : t
      )
    );
  };

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
        <h1 className="text-3xl font-bold tracking-tight">{t("gantt.title")}</h1>
        <p className="text-muted-foreground mt-1">{t("gantt.subtitle")}</p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>{t("gantt.timeline")}</CardTitle>
            <div className="flex items-center gap-4">
              <Select value={viewMode} onValueChange={(value) => setViewMode(value as ViewMode)}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ViewMode.Day}>{t("gantt.day")}</SelectItem>
                  <SelectItem value={ViewMode.Week}>{t("gantt.week")}</SelectItem>
                  <SelectItem value={ViewMode.Month}>{t("gantt.month")}</SelectItem>
                </SelectContent>
              </Select>

              <Select value={selectedProject} onValueChange={setSelectedProject}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("gantt.allProjects")}</SelectItem>
                  {projects.map((project) => (
                    <SelectItem key={project.id} value={project.id}>
                      {project.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {tasks.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground">{t("gantt.noTasks")}</p>
            </div>
          ) : (
            <div className="gantt-container">
              <GanttChart
                tasks={tasks}
                viewMode={viewMode}
                onDoubleClick={handleTaskClick}
                onExpanderClick={handleExpanderClick}
                listCellWidth="200px"
                columnWidth={viewMode === ViewMode.Month ? 60 : viewMode === ViewMode.Week ? 100 : 40}
                barBackgroundColor="#f3f4f6"
                barBackgroundSelectedColor="#e5e7eb"
                arrowColor="#6b7280"
                fontSize="14px"
                locale="en"
              />
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("gantt.legend")}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded" style={{ backgroundColor: "#dc2626" }} />
              <span className="text-sm">{t("taskPriority.Critical")}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded" style={{ backgroundColor: "#f97316" }} />
              <span className="text-sm">{t("taskPriority.High")}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded" style={{ backgroundColor: "#3b82f6" }} />
              <span className="text-sm">{t("taskPriority.Medium")}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded" style={{ backgroundColor: "#6b7280" }} />
              <span className="text-sm">{t("taskPriority.Low")}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded" style={{ backgroundColor: "#10b981" }} />
              <span className="text-sm">{t("taskStatus.Done")}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded" style={{ backgroundColor: "#ef4444" }} />
              <span className="text-sm">{t("taskStatus.Blocked")}</span>
            </div>
          </div>
          <p className="text-sm text-muted-foreground mt-4">
            {t("gantt.legendDescription")}
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default Gantt;
