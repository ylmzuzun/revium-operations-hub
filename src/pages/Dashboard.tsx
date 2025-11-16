import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { CheckSquare, Clock, AlertCircle, TrendingUp, Plus } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface DashboardStats {
  myOpenTasks: number;
  tasksCreated: number;
  openTasks: number;
  criticalTasks: number;
}

const Dashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState<DashboardStats>({
    myOpenTasks: 0,
    tasksCreated: 0,
    openTasks: 0,
    criticalTasks: 0,
  });
  const [loading, setLoading] = useState(true);

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

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground text-center py-8">
              No recent activity
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Task Status Overview</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm">Backlog</span>
                <Badge variant="secondary">0</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">In Progress</span>
                <Badge variant="secondary">0</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Done</span>
                <Badge variant="secondary">0</Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Dashboard;
