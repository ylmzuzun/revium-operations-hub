import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { CheckSquare, Clock, AlertCircle, TrendingUp, Plus } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { formatDistanceToNow } from "@/lib/dateUtils";
import { PendingApprovalsWidget } from "@/components/dashboard/PendingApprovalsWidget";

interface DashboardStats {
  myOpenTasks: number;
  tasksCreated: number;
  openTasks: number;
  criticalTasks: number;
}

interface ActivityLog {
  id: string;
  change_type: string;
  field_name: string | null;
  old_value: string | null;
  new_value: string | null;
  created_at: string;
  changed_by_profile: {
    name: string;
    surname: string;
  };
  task: {
    title: string;
  };
}

interface StatusData {
  name: string;
  value: number;
  color: string;
}

interface PriorityData {
  name: string;
  value: number;
}

const Dashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [stats, setStats] = useState<DashboardStats>({
    myOpenTasks: 0,
    tasksCreated: 0,
    openTasks: 0,
    criticalTasks: 0,
  });
  const [loading, setLoading] = useState(true);
  const [recentActivity, setRecentActivity] = useState<ActivityLog[]>([]);
  const [statusData, setStatusData] = useState<StatusData[]>([]);
  const [priorityData, setPriorityData] = useState<PriorityData[]>([]);

  useEffect(() => {
    const fetchDashboardData = async () => {
      if (!user) return;

      try {
        // Fetch my open tasks
        const { count: myOpenCount } = await supabase
          .from("tasks")
          .select("*", { count: "exact", head: true })
          .eq("assignee_id", user.id)
          .not("status", "in", '("Done","Canceled")');

        // Fetch tasks I created
        const { count: createdCount } = await supabase
          .from("tasks")
          .select("*", { count: "exact", head: true })
          .eq("created_by", user.id);

        // Fetch open tasks without assignee
        const { count: openCount } = await supabase
          .from("tasks")
          .select("*", { count: "exact", head: true })
          .is("assignee_id", null)
          .not("status", "in", '("Done","Canceled")');

        // Fetch critical tasks
        const { count: criticalCount } = await supabase
          .from("tasks")
          .select("*", { count: "exact", head: true })
          .eq("priority", "Critical")
          .not("status", "in", '("Done","Canceled")');

        setStats({
          myOpenTasks: myOpenCount || 0,
          tasksCreated: createdCount || 0,
          openTasks: openCount || 0,
          criticalTasks: criticalCount || 0,
        });

        // Fetch recent activity
        const { data: activities } = await supabase
          .from("activity_logs")
          .select(`
            id,
            change_type,
            field_name,
            old_value,
            new_value,
            created_at,
            changed_by_profile:profiles!activity_logs_changed_by_fkey(name, surname),
            task:tasks!activity_logs_task_id_fkey(title)
          `)
          .order("created_at", { ascending: false })
          .limit(10);

        setRecentActivity((activities as any) || []);

        // Fetch status distribution
        const { data: statusCounts } = await supabase
          .from("tasks")
          .select("status");

        const statusMap = new Map<string, number>();
        statusCounts?.forEach((task) => {
          statusMap.set(task.status, (statusMap.get(task.status) || 0) + 1);
        });

        const COLORS = {
          Backlog: "hsl(var(--muted))",
          "To Do": "hsl(var(--chart-1))",
          "In Progress": "hsl(var(--chart-2))",
          Done: "hsl(var(--chart-3))",
          Canceled: "hsl(var(--chart-4))",
        };

        const statusChartData = Array.from(statusMap.entries()).map(([name, value]) => ({
          name,
          value,
          color: COLORS[name as keyof typeof COLORS] || "hsl(var(--primary))",
        }));

        setStatusData(statusChartData);

        // Fetch priority distribution
        const { data: priorityCounts } = await supabase
          .from("tasks")
          .select("priority");

        const priorityMap = new Map<string, number>();
        priorityCounts?.forEach((task) => {
          priorityMap.set(task.priority, (priorityMap.get(task.priority) || 0) + 1);
        });

        const priorityChartData = Array.from(priorityMap.entries()).map(([name, value]) => ({
          name,
          value,
        }));

        setPriorityData(priorityChartData);
      } catch (error) {
        console.error("Error fetching dashboard data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, [user]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  const statCards = [
    {
      title: "My Open Tasks",
      value: stats.myOpenTasks,
      icon: CheckSquare,
      color: "text-primary",
      bgColor: "bg-primary/10",
    },
    {
      title: "Tasks I Created",
      value: stats.tasksCreated,
      icon: TrendingUp,
      color: "text-blue-600",
      bgColor: "bg-blue-100",
    },
    {
      title: "Open Tasks",
      value: stats.openTasks,
      icon: Clock,
      color: "text-yellow-600",
      bgColor: "bg-yellow-100",
    },
    {
      title: "Critical Tasks",
      value: stats.criticalTasks,
      icon: AlertCircle,
      color: "text-red-600",
      bgColor: "bg-red-100",
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground mt-1">
            Welcome back! Here's an overview of your work.
          </p>
        </div>
        <Button onClick={() => navigate("/tasks/new")} className="gap-2">
          <Plus className="h-4 w-4" />
          New Task
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {statCards.map((card) => (
          <Card key={card.title}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{card.title}</CardTitle>
              <div className={`${card.bgColor} p-2 rounded-lg`}>
                <card.icon className={`h-4 w-4 ${card.color}`} />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{card.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <PendingApprovalsWidget />

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{t("dashboard.recentActivity")}</CardTitle>
          </CardHeader>
          <CardContent>
            {recentActivity.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                {t("dashboard.noRecentActivity")}
              </p>
            ) : (
              <div className="space-y-4">
                {recentActivity.map((activity) => (
                  <div key={activity.id} className="flex gap-3 text-sm">
                    <div className="flex-1">
                      <p className="font-medium">
                        {activity.changed_by_profile.name} {activity.changed_by_profile.surname}
                      </p>
                      <p className="text-muted-foreground">
                        {activity.change_type === "status_change" && activity.field_name
                          ? `${t("dashboard.changedStatus")} "${activity.task.title}"`
                          : activity.change_type === "assignment"
                          ? `${t("dashboard.assignedTask")} "${activity.task.title}"`
                          : `${t("dashboard.updated")} "${activity.task.title}"`}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {formatDistanceToNow(new Date(activity.created_at), { addSuffix: true })}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("dashboard.taskStatusOverview")}</CardTitle>
          </CardHeader>
          <CardContent>
            {statusData.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                {t("dashboard.noData")}
              </p>
            ) : (
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={statusData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                    outerRadius={80}
                    fill="hsl(var(--primary))"
                    dataKey="value"
                  >
                    {statusData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("dashboard.priorityDistribution")}</CardTitle>
        </CardHeader>
        <CardContent>
          {priorityData.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              {t("dashboard.noData")}
            </p>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={priorityData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="value" fill="hsl(var(--primary))" name={t("dashboard.tasks")} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Dashboard;
