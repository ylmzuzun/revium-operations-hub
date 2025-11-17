import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { supabase } from "@/lib/supabase";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { Download, CalendarIcon } from "lucide-react";
import { toast } from "sonner";
import { subDays, startOfWeek, differenceInDays } from "date-fns";
import { format } from "@/lib/dateUtils";
import { cn } from "@/lib/utils";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import * as XLSX from "xlsx";

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
  const [customStartDate, setCustomStartDate] = useState<Date | undefined>();
  const [customEndDate, setCustomEndDate] = useState<Date | undefined>();
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [taskTrends, setTaskTrends] = useState<TaskTrend[]>([]);
  const [workloadData, setWorkloadData] = useState<WorkloadData[]>([]);
  const [teamPerformance, setTeamPerformance] = useState<TeamPerformance[]>([]);

  useEffect(() => {
    fetchReportData();
  }, [dateRange, customStartDate, customEndDate]);

  const fetchReportData = async () => {
    setLoading(true);
    try {
      let startDate: Date;
      
      if (dateRange === "custom" && customStartDate && customEndDate) {
        startDate = customStartDate;
      } else {
        const days = parseInt(dateRange);
        startDate = subDays(new Date(), days);
      }
      
      const endDate = dateRange === "custom" && customEndDate ? customEndDate : new Date();

      // Fetch task completion trends (weekly)
      const { data: completedTasks } = await supabase
        .from("tasks")
        .select("created_at")
        .eq("status", "Done")
        .gte("created_at", startDate.toISOString())
        .lte("created_at", endDate.toISOString());

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

  const handleExportPDF = async () => {
    setExporting(true);
    try {
      const element = document.getElementById("reports-content");
      if (!element) return;

      const canvas = await html2canvas(element, { 
        scale: 2,
        logging: false,
        useCORS: true
      });
      
      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4"
      });
      
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const imgWidth = canvas.width;
      const imgHeight = canvas.height;
      const ratio = Math.min(pdfWidth / imgWidth, pdfHeight / imgHeight);
      const imgX = (pdfWidth - imgWidth * ratio) / 2;
      const imgY = 10;
      
      pdf.addImage(imgData, "PNG", imgX, imgY, imgWidth * ratio, imgHeight * ratio);
      pdf.save(`reports-${format(new Date(), "yyyy-MM-dd")}.pdf`);
      
      toast.success(t("reports.exportSuccess"));
    } catch (error) {
      console.error("Error exporting PDF:", error);
      toast.error(t("common.error"));
    } finally {
      setExporting(false);
    }
  };

  const handleExportExcel = () => {
    setExporting(true);
    try {
      const wb = XLSX.utils.book_new();

      // Task Trends Sheet
      const trendsWS = XLSX.utils.json_to_sheet(
        taskTrends.map(t => ({
          [t("reports.week")]: t.week,
          [t("reports.completedTasks")]: t.completed
        }))
      );
      XLSX.utils.book_append_sheet(wb, trendsWS, t("reports.taskCompletionTrends"));

      // Workload Distribution Sheet
      const workloadWS = XLSX.utils.json_to_sheet(
        workloadData.map(w => ({
          [t("reports.userName")]: w.userName,
          [t("reports.taskCount")]: w.taskCount
        }))
      );
      XLSX.utils.book_append_sheet(wb, workloadWS, t("reports.workloadDistribution"));

      // Team Performance Sheet
      const teamWS = XLSX.utils.json_to_sheet(
        teamPerformance.map(tp => ({
          [t("reports.teamName")]: tp.teamName,
          [t("reports.totalTasks")]: tp.totalTasks,
          [t("reports.completedTasks")]: tp.completedTasks,
          [t("reports.completionRate")]: `${tp.completionRate}%`
        }))
      );
      XLSX.utils.book_append_sheet(wb, teamWS, t("reports.teamPerformance"));

      XLSX.writeFile(wb, `reports-${format(new Date(), "yyyy-MM-dd")}.xlsx`);
      toast.success(t("reports.exportSuccess"));
    } catch (error) {
      console.error("Error exporting Excel:", error);
      toast.error(t("common.error"));
    } finally {
      setExporting(false);
    }
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t("reports.title")}</h1>
          <p className="text-muted-foreground mt-1">{t("reports.subtitle")}</p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={dateRange} onValueChange={(value) => {
            setDateRange(value);
            if (value !== "custom") {
              setCustomStartDate(undefined);
              setCustomEndDate(undefined);
            }
          }}>
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">{t("reports.last7Days")}</SelectItem>
              <SelectItem value="30">{t("reports.last30Days")}</SelectItem>
              <SelectItem value="90">{t("reports.last90Days")}</SelectItem>
              <SelectItem value="365">{t("reports.allTime")}</SelectItem>
              <SelectItem value="custom">{t("common.customDateRange")}</SelectItem>
            </SelectContent>
          </Select>

          {dateRange === "custom" && (
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn("w-[240px] justify-start text-left font-normal", !customStartDate && "text-muted-foreground")}>
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {customStartDate && customEndDate ? (
                    `${format(customStartDate, "MMM d")} - ${format(customEndDate, "MMM d, yyyy")}`
                  ) : (
                    t("common.selectDateRange")
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="end">
                <div className="flex gap-2 p-3">
                  <div>
                    <p className="text-sm font-medium mb-2">{t("common.startDate")}</p>
                    <Calendar
                      mode="single"
                      selected={customStartDate}
                      onSelect={setCustomStartDate}
                      disabled={(date) => date > new Date()}
                      className="pointer-events-auto"
                    />
                  </div>
                  <div>
                    <p className="text-sm font-medium mb-2">{t("common.endDate")}</p>
                    <Calendar
                      mode="single"
                      selected={customEndDate}
                      onSelect={setCustomEndDate}
                      disabled={(date) => date > new Date() || (customStartDate && date < customStartDate)}
                      className="pointer-events-auto"
                    />
                  </div>
                </div>
              </PopoverContent>
            </Popover>
          )}

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button disabled={exporting} className="gap-2">
                <Download className="h-4 w-4" />
                {exporting ? t("common.exporting") : t("common.export")}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={handleExportPDF}>
                {t("common.exportPDF")}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleExportExcel}>
                {t("common.exportExcel")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div id="reports-content" className="space-y-6">

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
    </div>
  );
};

export default Reports;
