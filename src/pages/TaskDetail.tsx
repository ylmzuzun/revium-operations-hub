import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, User } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import ReactMarkdown from "react-markdown";
import { format } from "date-fns";
import { AttachmentSection } from "@/components/tasks/AttachmentSection";
import { DependenciesSection } from "@/components/tasks/DependenciesSection";
import { ApprovalSection } from "@/components/tasks/ApprovalSection";
import { useAuth } from "@/contexts/AuthContext";

const TaskDetail = () => {
  const { t } = useTranslation();
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [task, setTask] = useState<any>(null);
  const [comments, setComments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [commentText, setCommentText] = useState("");
  const [currentUser, setCurrentUser] = useState<any>(null);

  useEffect(() => {
    fetchTask();
    fetchComments();
    getCurrentUser();
  }, [id]);

  const getCurrentUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();
      setCurrentUser(data);
    }
  };

  const fetchTask = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("tasks")
      .select(`
        *,
        assignee:profiles!tasks_assignee_id_fkey(id, name, surname),
        creator:profiles!tasks_created_by_fkey(id, name, surname),
        project:projects(id, name)
      `)
      .eq("id", id)
      .single();

    if (data) setTask(data);
    setLoading(false);
  };

  const fetchComments = async () => {
    const { data } = await supabase
      .from("comments")
      .select(`
        *,
        author:profiles!comments_author_id_fkey(id, name, surname)
      `)
      .eq("task_id", id)
      .order("created_at", { ascending: true });

    if (data) setComments(data);
  };

  const handleTakeTask = async () => {
    if (!currentUser) return;

    const { error } = await supabase
      .from("tasks")
      .update({ assignee_id: currentUser.id })
      .eq("id", id);

    if (error) {
      toast({ title: t("common.error"), description: error.message, variant: "destructive" });
    } else {
      toast({ title: t("common.success"), description: "Task assigned to you" });
      fetchTask();
    }
  };

  const handlePostComment = async () => {
    if (!commentText.trim() || !currentUser) return;

    const { error } = await supabase.from("comments").insert({
      task_id: id!,
      author_id: currentUser.id,
      message: commentText,
    });

    if (error) {
      toast({ title: t("common.error"), description: error.message, variant: "destructive" });
    } else {
      setCommentText("");
      fetchComments();
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

  if (!task) {
    return <div>Task not found</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate("/tasks")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-3xl font-bold tracking-tight">{task.title}</h1>
          <p className="text-muted-foreground mt-1">
            {t("tasks.taskDetails")} #{task.id.slice(0, 8)}
          </p>
        </div>
        {!task.assignee && (
          <Button onClick={handleTakeTask}>
            <User className="h-4 w-4 mr-2" />
            {t("tasks.takeTask")}
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>{t("tasks.description")}</CardTitle>
            </CardHeader>
            <CardContent>
              {task.description ? (
                <div className="prose prose-sm max-w-none">
                  <ReactMarkdown>{task.description}</ReactMarkdown>
                </div>
              ) : (
                <p className="text-muted-foreground">{t("tasks.noTasks")}</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <Tabs defaultValue="comments">
              <CardHeader>
                <TabsList>
                  <TabsTrigger value="comments">{t("tasks.comments")}</TabsTrigger>
                  <TabsTrigger value="activity">{t("tasks.activity")}</TabsTrigger>
                </TabsList>
              </CardHeader>
              <CardContent>
                <TabsContent value="comments" className="space-y-4">
                  <div className="space-y-4">
                    {comments.map((comment) => (
                      <div key={comment.id} className="flex gap-3">
                        <Avatar className="h-8 w-8">
                          <AvatarFallback>
                            {comment.author.name[0]}
                            {comment.author.surname[0]}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium">
                              {comment.author.name} {comment.author.surname}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {format(new Date(comment.created_at), "MMM dd, yyyy HH:mm")}
                            </span>
                          </div>
                          <p className="text-sm">{comment.message}</p>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="space-y-2">
                    <Textarea
                      value={commentText}
                      onChange={(e) => setCommentText(e.target.value)}
                      placeholder={t("tasks.addComment")}
                      rows={3}
                    />
                    <Button onClick={handlePostComment} size="sm">
                      {t("tasks.postComment")}
                    </Button>
                  </div>
                </TabsContent>

                <TabsContent value="activity">
                  <p className="text-sm text-muted-foreground">
                    Activity history coming soon
                  </p>
                </TabsContent>
              </CardContent>
            </Tabs>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground">{t("tasks.status")}</p>
                <Badge className="mt-1">{t(`taskStatus.${task.status}`)}</Badge>
              </div>

              <div>
                <p className="text-sm text-muted-foreground">{t("tasks.priority")}</p>
                <Badge className="mt-1" variant="default">
                  {t(`taskPriority.${task.priority}`)}
                </Badge>
              </div>

              <div>
                <p className="text-sm text-muted-foreground">{t("tasks.type")}</p>
                <Badge className="mt-1" variant="outline">
                  {t(`taskType.${task.type}`)}
                </Badge>
              </div>

              <div>
                <p className="text-sm text-muted-foreground">{t("tasks.assignee")}</p>
                {task.assignee ? (
                  <div className="flex items-center gap-2 mt-1">
                    <Avatar className="h-6 w-6">
                      <AvatarFallback className="text-xs">
                        {task.assignee.name[0]}
                        {task.assignee.surname[0]}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-sm">
                      {task.assignee.name} {task.assignee.surname}
                    </span>
                  </div>
                ) : (
                  <p className="text-sm mt-1">{t("tasks.unassigned")}</p>
                )}
              </div>

              {task.project && (
                <div>
                  <p className="text-sm text-muted-foreground">{t("tasks.project")}</p>
                  <p className="text-sm mt-1">{task.project.name}</p>
                </div>
              )}

              {task.due_date && (
                <div>
                  <p className="text-sm text-muted-foreground">{t("tasks.dueDate")}</p>
                  <p className="text-sm mt-1">
                    {format(new Date(task.due_date), "MMM dd, yyyy")}
                  </p>
                </div>
              )}

              {task.skill_tags && task.skill_tags.length > 0 && (
                <div>
                  <p className="text-sm text-muted-foreground mb-2">{t("tasks.skillTags")}</p>
                  <div className="flex flex-wrap gap-1">
                    {task.skill_tags.map((tag: string) => (
                      <Badge key={tag} variant="secondary" className="text-xs">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <AttachmentSection taskId={id!} />

          <ApprovalSection
            taskId={id!}
            taskStatus={task.status}
            canRequestApproval={
              user?.id === task?.created_by ||
              user?.id === task?.assignee_id
            }
          />

          <DependenciesSection
            taskId={id!}
            canEdit={
              user?.id === task?.created_by ||
              user?.id === task?.assignee_id ||
              currentUser?.global_role === "Admin" ||
              currentUser?.global_role === "Manager"
            }
          />
        </div>
      </div>
    </div>
  );
};

export default TaskDetail;
