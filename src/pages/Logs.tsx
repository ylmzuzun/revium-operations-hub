import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { format } from "@/lib/dateUtils";
import { Search, FileText } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";

interface SystemLog {
  id: string;
  created_at: string;
  changed_by: string;
  entity_type: string;
  entity_id: string;
  action: string;
  before_data: any;
  after_data: any;
  metadata: any;
  profiles: {
    name: string;
    surname: string;
  };
}

const Logs = () => {
  const { t } = useTranslation();
  const [logs, setLogs] = useState<SystemLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [entityFilter, setEntityFilter] = useState<string>("all");
  const [actionFilter, setActionFilter] = useState<string>("all");
  const [selectedLog, setSelectedLog] = useState<SystemLog | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  useEffect(() => {
    fetchLogs();
  }, [entityFilter, actionFilter]);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from("system_logs")
        .select("*, profiles!system_logs_changed_by_fkey(name, surname)")
        .order("created_at", { ascending: false })
        .limit(100);

      if (entityFilter !== "all") {
        query = query.eq("entity_type", entityFilter);
      }

      if (actionFilter !== "all") {
        query = query.eq("action", actionFilter);
      }

      const { data, error } = await query;

      if (error) throw error;
      setLogs((data as any) || []);
    } catch (error: any) {
      console.error("Error fetching logs:", error);
      toast.error(t("common.error"));
    } finally {
      setLoading(false);
    }
  };

  const filteredLogs = logs.filter((log) => {
    const searchLower = search.toLowerCase();
    return (
      log.entity_id.toLowerCase().includes(searchLower) ||
      log.action.toLowerCase().includes(searchLower) ||
      `${log.profiles.name} ${log.profiles.surname}`.toLowerCase().includes(searchLower)
    );
  });

  const getActionBadge = (action: string) => {
    const variants: Record<string, "default" | "destructive" | "secondary"> = {
      create: "default",
      update: "secondary",
      delete: "destructive",
    };
    return variants[action] || "secondary";
  };

  const viewLogDetails = (log: SystemLog) => {
    setSelectedLog(log);
    setDialogOpen(true);
  };

  const renderJsonDiff = () => {
    if (!selectedLog) return null;

    return (
      <div className="space-y-4">
        {selectedLog.before_data && (
          <div>
            <h4 className="font-semibold mb-2 text-sm">{t("logs.before")}</h4>
            <ScrollArea className="h-64 w-full rounded-md border p-4">
              <pre className="text-xs">
                {JSON.stringify(selectedLog.before_data, null, 2)}
              </pre>
            </ScrollArea>
          </div>
        )}
        {selectedLog.after_data && (
          <div>
            <h4 className="font-semibold mb-2 text-sm">{t("logs.after")}</h4>
            <ScrollArea className="h-64 w-full rounded-md border p-4">
              <pre className="text-xs">
                {JSON.stringify(selectedLog.after_data, null, 2)}
              </pre>
            </ScrollArea>
          </div>
        )}
        {selectedLog.metadata && (
          <div>
            <h4 className="font-semibold mb-2 text-sm">{t("logs.metadata")}</h4>
            <ScrollArea className="h-32 w-full rounded-md border p-4">
              <pre className="text-xs">
                {JSON.stringify(selectedLog.metadata, null, 2)}
              </pre>
            </ScrollArea>
          </div>
        )}
      </div>
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
        <h1 className="text-3xl font-bold tracking-tight">{t("logs.title")}</h1>
        <p className="text-muted-foreground mt-1">{t("logs.subtitle")}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("logs.filters")}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={t("logs.searchPlaceholder")}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8"
              />
            </div>
            <Select value={entityFilter} onValueChange={setEntityFilter}>
              <SelectTrigger>
                <SelectValue placeholder={t("logs.entityType")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("logs.allEntities")}</SelectItem>
                <SelectItem value="task">{t("logs.tasks")}</SelectItem>
                <SelectItem value="project">{t("logs.projects")}</SelectItem>
                <SelectItem value="user">{t("logs.users")}</SelectItem>
                <SelectItem value="team">{t("logs.teams")}</SelectItem>
              </SelectContent>
            </Select>
            <Select value={actionFilter} onValueChange={setActionFilter}>
              <SelectTrigger>
                <SelectValue placeholder={t("logs.action")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("logs.allActions")}</SelectItem>
                <SelectItem value="create">{t("logs.create")}</SelectItem>
                <SelectItem value="update">{t("logs.update")}</SelectItem>
                <SelectItem value="delete">{t("logs.delete")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("logs.recentActivity")}</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("logs.timestamp")}</TableHead>
                <TableHead>{t("logs.user")}</TableHead>
                <TableHead>{t("logs.entityType")}</TableHead>
                <TableHead>{t("logs.action")}</TableHead>
                <TableHead>{t("logs.details")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredLogs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                    {t("logs.noLogs")}
                  </TableCell>
                </TableRow>
              ) : (
                filteredLogs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="text-sm">
                      {format(new Date(log.created_at), "PPpp")}
                    </TableCell>
                    <TableCell>
                      {log.profiles.name} {log.profiles.surname}
                    </TableCell>
                    <TableCell className="capitalize">{log.entity_type}</TableCell>
                    <TableCell>
                      <Badge variant={getActionBadge(log.action)}>
                        {log.action}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => viewLogDetails(log)}
                      >
                        <FileText className="h-4 w-4 mr-2" />
                        {t("logs.view")}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>{t("logs.logDetails")}</DialogTitle>
          </DialogHeader>
          {selectedLog && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="font-semibold">{t("logs.timestamp")}:</span>{" "}
                  {format(new Date(selectedLog.created_at), "PPpp")}
                </div>
                <div>
                  <span className="font-semibold">{t("logs.user")}:</span>{" "}
                  {selectedLog.profiles.name} {selectedLog.profiles.surname}
                </div>
                <div>
                  <span className="font-semibold">{t("logs.entityType")}:</span>{" "}
                  {selectedLog.entity_type}
                </div>
                <div>
                  <span className="font-semibold">{t("logs.action")}:</span>{" "}
                  <Badge variant={getActionBadge(selectedLog.action)}>
                    {selectedLog.action}
                  </Badge>
                </div>
              </div>
              {renderJsonDiff()}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Logs;
