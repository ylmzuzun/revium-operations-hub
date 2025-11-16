import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { CheckCircle2, XCircle, Clock, Send, AlertCircle } from "lucide-react";
import { format } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface ApprovalData {
  id: string;
  task_id: string;
  requested_by: string;
  requested_at: string;
  current_level: string;
  is_complete: boolean;
  final_status: string | null;
  completed_at: string | null;
  notes: string | null;
  requester: {
    name: string;
    surname: string;
  };
}

interface ApprovalAction {
  id: string;
  level: string;
  status: string;
  comments: string | null;
  actioned_at: string;
  approver: {
    name: string;
    surname: string;
  };
}

interface ApprovalSectionProps {
  taskId: string;
  taskStatus: string;
  canRequestApproval: boolean;
}

export const ApprovalSection = ({ taskId, taskStatus, canRequestApproval }: ApprovalSectionProps) => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [approval, setApproval] = useState<ApprovalData | null>(null);
  const [actions, setActions] = useState<ApprovalAction[]>([]);
  const [loading, setLoading] = useState(true);
  const [requestDialogOpen, setRequestDialogOpen] = useState(false);
  const [actionDialogOpen, setActionDialogOpen] = useState(false);
  const [actionType, setActionType] = useState<"approve" | "reject">("approve");
  const [requestNotes, setRequestNotes] = useState("");
  const [actionComments, setActionComments] = useState("");
  const [numLevels, setNumLevels] = useState("1");
  const [canApprove, setCanApprove] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchApprovalData();
    setupRealtimeSubscription();
  }, [taskId]);

  useEffect(() => {
    if (approval && user) {
      checkCanApprove();
    }
  }, [approval, user]);

  const setupRealtimeSubscription = () => {
    const channel = supabase
      .channel('approval-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'task_approvals',
          filter: `task_id=eq.${taskId}`
        },
        () => {
          fetchApprovalData();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'task_approval_actions'
        },
        () => {
          fetchApprovalData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  const fetchApprovalData = async () => {
    try {
      const { data: approvalData, error: approvalError } = await supabase
        .from("task_approvals")
        .select(`
          *,
          requester:profiles!task_approvals_requested_by_fkey(name, surname)
        `)
        .eq("task_id", taskId)
        .maybeSingle();

      if (approvalError) throw approvalError;

      setApproval(approvalData as any);

      if (approvalData) {
        const { data: actionsData, error: actionsError } = await supabase
          .from("task_approval_actions")
          .select(`
            *,
            approver:profiles!task_approval_actions_approver_id_fkey(name, surname)
          `)
          .eq("approval_id", approvalData.id)
          .order("actioned_at", { ascending: true });

        if (actionsError) throw actionsError;
        setActions((actionsData as any) || []);
      }
    } catch (error) {
      console.error("Error fetching approval data:", error);
    } finally {
      setLoading(false);
    }
  };

  const checkCanApprove = async () => {
    if (!approval || !user || approval.is_complete) {
      setCanApprove(false);
      return;
    }

    try {
      const { data, error } = await supabase.rpc("can_user_approve_task", {
        p_approval_id: approval.id,
        p_user_id: user.id,
      });

      if (error) throw error;
      setCanApprove(data === true);
    } catch (error) {
      console.error("Error checking approval permission:", error);
      setCanApprove(false);
    }
  };

  const handleRequestApproval = async () => {
    if (!user) return;

    setSubmitting(true);
    try {
      // First update task status to Waiting Approval
      const { error: taskError } = await supabase
        .from("tasks")
        .update({ status: "Waiting Approval" })
        .eq("id", taskId);

      if (taskError) throw taskError;

      // Create approval request
      const { error: approvalError } = await supabase
        .from("task_approvals")
        .insert({
          task_id: taskId,
          requested_by: user.id,
          notes: requestNotes || null,
          current_level: "LEVEL_1" as any,
        });

      if (approvalError) throw approvalError;

      toast.success(t("tasks.approval.requestSubmitted"));
      setRequestDialogOpen(false);
      setRequestNotes("");
      fetchApprovalData();
    } catch (error: any) {
      console.error("Error requesting approval:", error);
      toast.error(error.message || t("common.error"));
    } finally {
      setSubmitting(false);
    }
  };

  const handleApprovalAction = async () => {
    if (!user || !approval) return;

    setSubmitting(true);
    try {
      const status = actionType === "approve" ? "APPROVED" : "REJECTED";

      // Create approval action
      const { error: actionError } = await supabase
        .from("task_approval_actions")
        .insert({
          approval_id: approval.id,
          level: approval.current_level as any,
          approver_id: user.id,
          status: status as any,
          comments: actionComments || null,
        });

      if (actionError) throw actionError;

      // Determine next steps
      let updateData: any = {};
      
      if (status === "REJECTED") {
        // If rejected, mark as complete with rejected status
        updateData = {
          is_complete: true,
          final_status: "REJECTED",
          completed_at: new Date().toISOString(),
        };
      } else {
        // If approved, check if we need to move to next level
        const targetLevels = parseInt(numLevels);
        const currentLevelNum = approval.current_level === "LEVEL_1" ? 1 : 
                               approval.current_level === "LEVEL_2" ? 2 : 3;

        if (currentLevelNum >= targetLevels) {
          // All required approvals complete
          updateData = {
            is_complete: true,
            final_status: "APPROVED",
            completed_at: new Date().toISOString(),
          };
        } else {
          // Move to next level
          const nextLevel = currentLevelNum === 1 ? "LEVEL_2" : "LEVEL_3";
          updateData = {
            current_level: nextLevel as any,
          };
        }
      }

      // Update approval
      const { error: updateError } = await supabase
        .from("task_approvals")
        .update(updateData)
        .eq("id", approval.id);

      if (updateError) throw updateError;

      toast.success(
        actionType === "approve" 
          ? t("tasks.approval.approved") 
          : t("tasks.approval.rejected")
      );
      
      setActionDialogOpen(false);
      setActionComments("");
      fetchApprovalData();
    } catch (error: any) {
      console.error("Error processing approval action:", error);
      toast.error(error.message || t("common.error"));
    } finally {
      setSubmitting(false);
    }
  };

  const getLevelLabel = (level: string) => {
    switch (level) {
      case "LEVEL_1":
        return t("tasks.approval.level1");
      case "LEVEL_2":
        return t("tasks.approval.level2");
      case "LEVEL_3":
        return t("tasks.approval.level3");
      default:
        return level;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "APPROVED":
        return <CheckCircle2 className="h-5 w-5 text-green-600" />;
      case "REJECTED":
        return <XCircle className="h-5 w-5 text-red-600" />;
      case "PENDING":
        return <Clock className="h-5 w-5 text-yellow-600" />;
      default:
        return <Clock className="h-5 w-5 text-gray-600" />;
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Send className="h-5 w-5" />
            {t("tasks.approval.title")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Send className="h-5 w-5" />
            {t("tasks.approval.title")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {!approval && taskStatus !== "Waiting Approval" && (
            <div>
              {canRequestApproval ? (
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground">
                    {t("tasks.approval.notRequested")}
                  </p>
                  <Button onClick={() => setRequestDialogOpen(true)} className="w-full">
                    <Send className="h-4 w-4 mr-2" />
                    {t("tasks.approval.requestApproval")}
                  </Button>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  {t("tasks.approval.cannotRequest")}
                </p>
              )}
            </div>
          )}

          {approval && (
            <div className="space-y-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-medium">
                    {t("tasks.approval.requestedBy")} {approval.requester.name} {approval.requester.surname}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {format(new Date(approval.requested_at), "MMM dd, yyyy HH:mm")}
                  </p>
                </div>
                {approval.is_complete ? (
                  <Badge variant={approval.final_status === "APPROVED" ? "default" : "destructive"}>
                    {approval.final_status === "APPROVED" 
                      ? t("tasks.approval.approved") 
                      : t("tasks.approval.rejected")}
                  </Badge>
                ) : (
                  <Badge variant="secondary">
                    <Clock className="h-3 w-3 mr-1" />
                    {getLevelLabel(approval.current_level)}
                  </Badge>
                )}
              </div>

              {approval.notes && (
                <div className="p-3 rounded-lg bg-muted">
                  <p className="text-sm font-medium mb-1">{t("tasks.approval.notes")}:</p>
                  <p className="text-sm text-muted-foreground">{approval.notes}</p>
                </div>
              )}

              {actions.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-medium">{t("tasks.approval.history")}:</p>
                  {actions.map((action) => (
                    <div
                      key={action.id}
                      className="flex items-start gap-3 p-3 rounded-lg border"
                    >
                      {getStatusIcon(action.status)}
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-1">
                          <p className="text-sm font-medium">
                            {action.approver.name} {action.approver.surname}
                          </p>
                          <Badge variant="outline">{getLevelLabel(action.level)}</Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(action.actioned_at), "MMM dd, yyyy HH:mm")}
                        </p>
                        {action.comments && (
                          <p className="text-sm mt-2">{action.comments}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {!approval.is_complete && canApprove && (
                <div className="flex items-center gap-2 pt-2">
                  <Button
                    onClick={() => {
                      setActionType("approve");
                      setActionDialogOpen(true);
                    }}
                    className="flex-1"
                  >
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                    {t("tasks.approval.approve")}
                  </Button>
                  <Button
                    onClick={() => {
                      setActionType("reject");
                      setActionDialogOpen(true);
                    }}
                    variant="destructive"
                    className="flex-1"
                  >
                    <XCircle className="h-4 w-4 mr-2" />
                    {t("tasks.approval.reject")}
                  </Button>
                </div>
              )}

              {!approval.is_complete && !canApprove && (
                <div className="flex items-start gap-2 p-3 rounded-lg bg-muted">
                  <AlertCircle className="h-4 w-4 text-muted-foreground mt-0.5" />
                  <p className="text-sm text-muted-foreground">
                    {t("tasks.approval.waitingForApproval")}
                  </p>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Request Approval Dialog */}
      <Dialog open={requestDialogOpen} onOpenChange={setRequestDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("tasks.approval.requestApproval")}</DialogTitle>
            <DialogDescription>
              {t("tasks.approval.requestDescription")}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="levels">{t("tasks.approval.approvalLevels")}</Label>
              <Select value={numLevels} onValueChange={setNumLevels}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1 {t("tasks.approval.level")}</SelectItem>
                  <SelectItem value="2">2 {t("tasks.approval.levels")}</SelectItem>
                  <SelectItem value="3">3 {t("tasks.approval.levels")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="notes">{t("tasks.approval.notes")} ({t("common.optional")})</Label>
              <Textarea
                id="notes"
                value={requestNotes}
                onChange={(e) => setRequestNotes(e.target.value)}
                rows={3}
                placeholder={t("tasks.approval.notesPlaceholder")}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRequestDialogOpen(false)}>
              {t("common.cancel")}
            </Button>
            <Button onClick={handleRequestApproval} disabled={submitting}>
              {submitting ? t("common.saving") : t("tasks.approval.submit")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Approval Action Dialog */}
      <Dialog open={actionDialogOpen} onOpenChange={setActionDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {actionType === "approve" 
                ? t("tasks.approval.approve") 
                : t("tasks.approval.reject")}
            </DialogTitle>
            <DialogDescription>
              {actionType === "approve"
                ? t("tasks.approval.approveDescription")
                : t("tasks.approval.rejectDescription")}
            </DialogDescription>
          </DialogHeader>
          <div>
            <Label htmlFor="comments">{t("tasks.approval.comments")} ({t("common.optional")})</Label>
            <Textarea
              id="comments"
              value={actionComments}
              onChange={(e) => setActionComments(e.target.value)}
              rows={3}
              placeholder={t("tasks.approval.commentsPlaceholder")}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setActionDialogOpen(false)}>
              {t("common.cancel")}
            </Button>
            <Button
              onClick={handleApprovalAction}
              disabled={submitting}
              variant={actionType === "reject" ? "destructive" : "default"}
            >
              {submitting 
                ? t("common.saving") 
                : actionType === "approve" 
                  ? t("tasks.approval.approve") 
                  : t("tasks.approval.reject")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
