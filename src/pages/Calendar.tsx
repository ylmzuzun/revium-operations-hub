import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { supabase } from "@/lib/supabase";
import { isSameDay, startOfMonth, endOfMonth } from "date-fns";
import { format } from "@/lib/dateUtils";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";

interface Task {
  id: string;
  title: string;
  due_date: string;
  priority: string;
  status: string;
  assignee: {
    name: string;
    surname: string;
  } | null;
}

const Calendar = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentMonth, setCurrentMonth] = useState<Date>(new Date());

  useEffect(() => {
    fetchTasks();
  }, [currentMonth]);

  const fetchTasks = async () => {
    setLoading(true);
    try {
      const monthStart = startOfMonth(currentMonth);
      const monthEnd = endOfMonth(currentMonth);

      const { data, error } = await supabase
        .from("tasks")
        .select(`
          id,
          title,
          due_date,
          priority,
          status,
          assignee:profiles!tasks_assignee_id_fkey(name, surname)
        `)
        .not("due_date", "is", null)
        .gte("due_date", monthStart.toISOString())
        .lte("due_date", monthEnd.toISOString())
        .order("due_date", { ascending: true });

      if (error) throw error;
      setTasks((data as any) || []);
    } catch (error) {
      console.error("Error fetching tasks:", error);
    } finally {
      setLoading(false);
    }
  };

  const getTasksForDate = (date: Date) => {
    return tasks.filter((task) => isSameDay(new Date(task.due_date), date));
  };

  const selectedDateTasks = getTasksForDate(selectedDate);

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

  const modifiers = {
    hasTasks: (date: Date) => getTasksForDate(date).length > 0,
  };

  const modifiersClassNames = {
    hasTasks: "font-bold relative after:content-[''] after:absolute after:bottom-1 after:left-1/2 after:-translate-x-1/2 after:w-1 after:h-1 after:rounded-full after:bg-primary",
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
        <h1 className="text-3xl font-bold tracking-tight">{t("calendar.title")}</h1>
        <p className="text-muted-foreground mt-1">{t("calendar.subtitle")}</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>{t("calendar.monthView")}</CardTitle>
          </CardHeader>
          <CardContent className="flex justify-center">
            <CalendarComponent
              mode="single"
              selected={selectedDate}
              onSelect={(date) => date && setSelectedDate(date)}
              onMonthChange={setCurrentMonth}
              modifiers={modifiers}
              modifiersClassNames={modifiersClassNames}
              className={cn("rounded-md border pointer-events-auto")}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>
              {format(selectedDate, "MMMM d, yyyy")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {selectedDateTasks.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                {t("calendar.noTasksOnDate")}
              </p>
            ) : (
              <div className="space-y-3">
                {selectedDateTasks.map((task) => (
                  <div
                    key={task.id}
                    onClick={() => navigate(`/tasks/${task.id}`)}
                    className="p-3 rounded-lg border bg-card hover:bg-accent cursor-pointer transition-colors"
                  >
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <h4 className="font-medium text-sm line-clamp-2">{task.title}</h4>
                      <Badge variant={getPriorityColor(task.priority)} className="shrink-0">
                        {t(`taskPriority.${task.priority}`)}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <Badge variant="outline" className={getStatusColor(task.status)}>
                        {t(`taskStatus.${task.status}`)}
                      </Badge>
                      {task.assignee && (
                        <span className="text-muted-foreground">
                          {task.assignee.name} {task.assignee.surname}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("calendar.upcomingTasks")}</CardTitle>
        </CardHeader>
        <CardContent>
          {tasks.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              {t("calendar.noUpcomingTasks")}
            </p>
          ) : (
            <div className="space-y-2">
              {tasks.slice(0, 10).map((task) => (
                <div
                  key={task.id}
                  onClick={() => navigate(`/tasks/${task.id}`)}
                  className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-accent cursor-pointer transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium text-sm truncate">{task.title}</h4>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(task.due_date), "MMM d, yyyy")}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge variant="outline" className={getStatusColor(task.status)}>
                      {t(`taskStatus.${task.status}`)}
                    </Badge>
                    <Badge variant={getPriorityColor(task.priority)}>
                      {t(`taskPriority.${task.priority}`)}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Calendar;
