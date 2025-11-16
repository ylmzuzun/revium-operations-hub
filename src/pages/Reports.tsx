import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/lib/supabase";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { Download } from "lucide-react";
import { toast } from "sonner";
import { format, subDays, startOfWeek, endOfWeek } from "date-fns";

interface TaskTrend {
  week: string;
  completed: number;
}

interface WorkloadData {
  userName: string;
  taskCount: number;
}

interface TeamPerformance {
  teamName: string;
  totalTasks: number;
  completedTasks: number;
  completionRate: number;
}

const Reports = () => {
  const { t } = useTranslation();
  const [dateRange, setDateRange] = useState("30");
  const [loading, setLoading] = useState(true);
  const [taskTrends, setTaskTrends] = useState<TaskTrend[]>([]);
  const [workloadData, setWorkloadData] = useState<WorkloadData[]>([]);
  const [teamPerformance, setTeamPerformance] = useState<TeamPerformance[]>([]);

  useEffect(() => {
    fetchReportData();
  }, [dateRange]);

  const fetchReportData = async () => {
    setLoading(true);
    try {
      const days = parseInt(dateRange);
      const startDate = subDays(new Date(), days);

      // Fetch task completion trends (weekly)
      const { data: completedTasks } = await supabase
        .from("tasks")
        .select("created_at")
        .eq("status", "Done")
        .gte("created_at", startDate.toISOString());

      // Group by week
      const trendsMap = new Map<string, number>();
      completedTasks?.forEach((task) => {
        const weekStart = startOfWeek(new Date(task.created_at));
        const weekLabel = format(weekStart, "MMM dd");
        trendsMap.set(weekLabel, (trendsMap.get(weekLabel) || 0) + 1);
      });

      const trends = Array.from(trendsMap.entries())
        .map(([week, completed]) => ({ week, completed }))
        .sort((a, b) => a.week.localeCompare(b.week));

      setTaskTrends(trends);

      // Fetch workload distribution (top 10 users)
      const { data: tasks } = await supabase
        .from("tasks")
        .select("assignee_id, profiles!tasks_assignee_id_fkey(name, surname)")
        .not("assignee_id", "is", null);

      const workloadMap = new Map<string, number>();
      tasks?.forEach((task: any) => {
        if (task.profiles) {
          const userName = `${task.profiles.name} ${task.profiles.surname}`;
          workloadMap.set(userName, (workloadMap.get(userName) || 0) + 1);
        }
      });

      const workload = Array.from(workloadMap.entries())
        .map(([userName, taskCount]) => ({ userName, taskCount }))
        .sort((a, b) => b.taskCount - a.taskCount)
        .slice(0, 10);

      setWorkloadData(workload);

      // Fetch team performance
      const { data: teams } = await supabase
        .from("teams")
        .select(`
          id,
          name,
          task_teams(task_id, tasks(id, status))
        `);

      const performance = teams?.map((team: any) => {
        const totalTasks = team.task_teams?.length || 0;
        const completedTasks = team.task_teams?.filter(
          (tt: any) => tt.tasks?.status === "Done"
        ).length || 0;
        const completionRate = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;

        return {
          teamName: team.name,
          totalTasks,
          completedTasks,
          completionRate: Math.round(completionRate),
        };
      }) || [];

      setTeamPerformance(performance);
    } catch (error) {
      console.error("Error fetching report data:", error);
      toast.error(t("common.error"));
    } finally {
      setLoading(false);
    }
  };

  const handleExport = () => {
    toast.info(t("reports.exportComingSoon"));
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t("reports.title")}</h1>
          <p className="text-muted-foreground mt-1">{t("reports.subtitle")}</p>
        </div>
        <div className="flex items-center gap-4">
          <Select value={dateRange} onValueChange={setDateRange}>
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">{t("reports.last7Days")}</SelectItem>
              <SelectItem value="30">{t("reports.last30Days")}</SelectItem>
              <SelectItem value="90">{t("reports.last90Days")}</SelectItem>
              <SelectItem value="365">{t("reports.allTime")}</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={handleExport} className="gap-2">
            <Download className="h-4 w-4" />
            {t("reports.exportPDF")}
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("reports.taskCompletionTrends")}</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={taskTrends}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="week" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line 
                type="monotone" 
                dataKey="completed" 
                stroke="hsl(var(--primary))" 
                strokeWidth={2}
                name={t("reports.completedTasks")}
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("reports.workloadDistribution")}</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={workloadData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="userName" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar 
                dataKey="taskCount" 
                fill="hsl(var(--primary))" 
                name={t("reports.taskCount")}
              />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("reports.teamPerformance")}</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("reports.teamName")}</TableHead>
                <TableHead>{t("reports.totalTasks")}</TableHead>
                <TableHead>{t("reports.completedTasks")}</TableHead>
                <TableHead>{t("reports.completionRate")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {teamPerformance.map((team) => (
                <TableRow key={team.teamName}>
                  <TableCell className="font-medium">{team.teamName}</TableCell>
                  <TableCell>{team.totalTasks}</TableCell>
                  <TableCell>{team.completedTasks}</TableCell>
                  <TableCell>{team.completionRate}%</TableCell>
                </TableRow>
              ))}
              {teamPerformance.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground">
                    {t("reports.noData")}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default Reports;
