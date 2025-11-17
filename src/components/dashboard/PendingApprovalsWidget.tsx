import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { CheckCircle2, XCircle, Clock, FileText } from "lucide-react";
import { formatDistanceToNow } from "@/lib/dateUtils";
import { useNavigate } from "react-router-dom";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface PendingApproval {
  id: string;
  task_id: string;
  current_level: string;
  requested_at: string;
  notes: string | null;
  task: {
    title: string;
    priority: string;
  };
  requester: {
    name: string;
    surname: string;
  };
}

export const PendingApprovalsWidget = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [approvals, setApprovals] = useState<PendingApproval[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionDialogOpen, setActionDialogOpen] = useState(false);
  const [selectedApproval, setSelectedApproval] = useState<PendingApproval | null>(null);
  const [actionType, setActionType] = useState<"APPROVED" | "REJECTED">("APPROVED");
  const [comments, setComments] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchPendingApprovals();
    setupRealtimeSubscription();
  }, [user]);

  const setupRealtimeSubscription = () => {
    const channel = supabase
      .channel('pending-approvals-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'task_approvals'
        },
        () => {
          fetchPendingApprovals();
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
          fetchPendingApprovals();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  const fetchPendingApprovals = async () => {
    if (!user) return;

    try {
      setLoading(true);

      // Fetch all pending approvals
      const { data: pendingApprovals, error } = await supabase
        .from("task_approvals")
        .select(`
          id,
          task_id,
          current_level,
          requested_at,
          notes,
          task:tasks!task_approvals_task_id_fkey(title, priority),
          requester:profiles!task_approvals_requested_by_fkey(name, surname)
        `)
        .eq("is_complete", false)
        .order("requested_at", { ascending: false });

      if (error) throw error;

      // Filter approvals where user can approve
      const approvalsUserCanApprove = [];
      for (const approval of pendingApprovals || []) {
        const { data: canApprove } = await supabase.rpc("can_user_approve_task", {
          p_approval_id: approval.id,
          p_user_id: user.id,
        });

        if (canApprove) {
          approvalsUserCanApprove.push(approval);
        }
      }

      setApprovals(approvalsUserCanApprove as any);
    } catch (error: any) {
      console.error("Error fetching pending approvals:", error);
      toast.error(t("approval.error.fetchFailed"));
    } finally {
      setLoading(false);
    }
  };

  const handleActionClick = (approval: PendingApproval, type: "APPROVED" | "REJECTED") => {
    setSelectedApproval(approval);
    setActionType(type);
    setComments("");
    setActionDialogOpen(true);
  };

  const handleSubmitAction = async () => {
    if (!selectedApproval || !user) return;

    try {
      setSubmitting(true);

      // Insert approval action
      const { error: actionError } = await supabase.from("task_approval_actions").insert({
        approval_id: selectedApproval.id,
        approver_id: user.id,
        level: selectedApproval.current_level as any,
        status: actionType as any,
        comments: comments || null,
      });

      if (actionError) throw actionError;

      // Update the approval as complete
      const { error: approvalError } = await supabase
        .from("task_approvals")
        .update({
          is_complete: true,
          final_status: actionType as any,
          completed_at: new Date().toISOString(),
        })
        .eq("id", selectedApproval.id);

      if (approvalError) throw approvalError;

      // Update task status based on action
      const newTaskStatus = actionType === "APPROVED" ? "Done" : "In Progress";
      const { error: taskError } = await supabase
        .from("tasks")
        .update({ status: newTaskStatus as any })
        .eq("id", selectedApproval.task_id);

      if (taskError) throw taskError;

      toast.success(
        actionType === "APPROVED"
          ? t("approval.success.approved")
          : t("approval.success.rejected")
      );

      setActionDialogOpen(false);
      setSelectedApproval(null);
      setComments("");
      fetchPendingApprovals();
    } catch (error: any) {
      console.error("Error submitting approval action:", error);
      toast.error(t("approval.error.actionFailed"));
    } finally {
      setSubmitting(false);
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "Critical":
        return "bg-destructive text-destructive-foreground";
      case "High":
        return "bg-orange-500 text-white";
      case "Medium":
        return "bg-primary text-primary-foreground";
      case "Low":
        return "bg-muted text-muted-foreground";
      default:
        return "bg-secondary text-secondary-foreground";
    }
  };

  const getLevelBadgeColor = (level: string) => {
    switch (level) {
      case "LEVEL_1":
        return "bg-blue-500 text-white";
      case "LEVEL_2":
        return "bg-purple-500 text-white";
      case "LEVEL_3":
        return "bg-indigo-500 text-white";
      default:
        return "bg-secondary text-secondary-foreground";
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            {t("approval.pendingApprovals")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-muted-foreground">{t("common.loading")}</div>
        </CardContent>
      </Card>
    );
  }

  if (approvals.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            {t("approval.pendingApprovals")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-muted-foreground">
            {t("approval.noPendingApprovals")}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            {t("approval.pendingApprovals")}
            <Badge variant="secondary">{approvals.length}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {approvals.map((approval) => (
              <div
                key={approval.id}
                className="flex items-start justify-between gap-3 p-3 border rounded-lg hover:bg-accent/50 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <button
                      onClick={() => navigate(`/tasks/${approval.task_id}`)}
                      className="font-medium text-sm hover:underline truncate"
                    >
                      {approval.task.title}
                    </button>
                    <Badge className={getPriorityColor(approval.task.priority)}>
                      {approval.task.priority}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>
                      {t("approval.requestedBy")} {approval.requester.name}{" "}
                      {approval.requester.surname}
                    </span>
                    <span>•</span>
                    <span>
                      {formatDistanceToNow(new Date(approval.requested_at), {
                        addSuffix: true,
                      })}
                    </span>
                    <Badge className={getLevelBadgeColor(approval.current_level)}>
                      {approval.current_level.replace("_", " ")}
                    </Badge>
                  </div>
                </div>
                <div className="flex gap-1">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 px-2 text-green-600 hover:text-green-700 hover:bg-green-50"
                    onClick={() => handleActionClick(approval, "APPROVED")}
                  >
                    <CheckCircle2 className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 px-2 text-red-600 hover:text-red-700 hover:bg-red-50"
                    onClick={() => handleActionClick(approval, "REJECTED")}
                  >
                    <XCircle className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Dialog open={actionDialogOpen} onOpenChange={setActionDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {actionType === "APPROVED"
                ? t("approval.confirmApprove")
                : t("approval.confirmReject")}
            </DialogTitle>
            <DialogDescription>
              {selectedApproval && (
                <>
                  <div className="font-medium text-foreground mt-2">
                    {selectedApproval.task.title}
                  </div>
                  <div className="text-sm mt-1">
                    {t("approval.currentLevel")}: {selectedApproval.current_level.replace("_", " ")}
                  </div>
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">
                {t("approval.comments")} ({t("common.optional")})
              </label>
              <Textarea
                value={comments}
                onChange={(e) => setComments(e.target.value)}
                placeholder={t("approval.commentsPlaceholder")}
                className="mt-1"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setActionDialogOpen(false)}
              disabled={submitting}
            >
              {t("common.cancel")}
            </Button>
            <Button
              onClick={handleSubmitAction}
              disabled={submitting}
              className={
                actionType === "APPROVED"
                  ? "bg-green-600 hover:bg-green-700"
                  : "bg-red-600 hover:bg-red-700"
              }
            >
              {submitting 
                ? t("common.submitting") 
                : actionType === "APPROVED" 
                  ? t("common.approve")
                  : t("common.reject")
              }
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
