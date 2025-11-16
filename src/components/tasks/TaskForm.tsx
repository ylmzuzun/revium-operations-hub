import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useForm } from "react-hook-form";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Sparkles, X } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { Database } from "@/integrations/supabase/types";

type TaskType = Database["public"]["Enums"]["task_type"];
type TaskStatus = Database["public"]["Enums"]["task_status"];
type TaskPriority = Database["public"]["Enums"]["task_priority"];
type DepartmentType = Database["public"]["Enums"]["department_type"];

interface TaskFormProps {
  onSuccess?: () => void;
  onCancel?: () => void;
}

interface Profile {
  id: string;
  name: string;
  surname: string;
  department: DepartmentType;
  skills: string[] | null;
}

export const TaskForm = ({ onSuccess, onCancel }: TaskFormProps) => {
  const { t } = useTranslation();
  const { register, handleSubmit, watch, setValue } = useForm();
  const [loading, setLoading] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [users, setUsers] = useState<Profile[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [suggestions, setSuggestions] = useState<Profile[]>([]);
  const [skillInput, setSkillInput] = useState("");
  const [skillTags, setSkillTags] = useState<string[]>([]);

  const title = watch("title");
  const description = watch("description");
  const type = watch("type");
  const status = watch("status", "To Do");
  const priority = watch("priority", "Medium");

  useEffect(() => {
    fetchUsers();
    fetchProjects();
  }, []);

  const fetchUsers = async () => {
    const { data } = await supabase
      .from("profiles")
      .select("id, name, surname, department, skills")
      .eq("is_active", true);
    if (data) setUsers(data);
  };

  const fetchProjects = async () => {
    const { data } = await supabase.from("projects").select("*");
    if (data) setProjects(data);
  };

  const getSuggestions = async () => {
    if (!title) {
      toast({ title: t("common.error"), description: "Please enter a task title first" });
      return;
    }

    setAiLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("suggest-assignee", {
        body: {
          taskTitle: title,
          taskDescription: description || "",
          skillTags,
          department: null,
        },
      });

      if (error) throw error;
      setSuggestions(data.suggestions || []);
    } catch (error: any) {
      toast({ title: t("common.error"), description: error.message });
    } finally {
      setAiLoading(false);
    }
  };

  const addSkillTag = () => {
    if (skillInput.trim() && !skillTags.includes(skillInput.trim())) {
      setSkillTags([...skillTags, skillInput.trim()]);
      setSkillInput("");
    }
  };

  const removeSkillTag = (tag: string) => {
    setSkillTags(skillTags.filter((t) => t !== tag));
  };

  const onSubmit = async (formData: any) => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { error } = await supabase.from("tasks").insert({
        title: formData.title,
        description: formData.description || null,
        type: formData.type || "Task",
        status: formData.status || "To Do",
        priority: formData.priority || "Medium",
        project_id: formData.project_id || null,
        assignee_id: formData.assignee_id || null,
        start_date: formData.start_date || null,
        due_date: formData.due_date || null,
        estimate_hours: formData.estimate_hours ? parseFloat(formData.estimate_hours) : null,
        skill_tags: skillTags.length > 0 ? skillTags : null,
        created_by: user.id,
      });

      if (error) throw error;

      toast({ title: t("common.success"), description: "Task created successfully" });
      onSuccess?.();
    } catch (error: any) {
      toast({ title: t("common.error"), description: error.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <div className="space-y-4">
        <div>
          <Label htmlFor="title">{t("tasks.title")} *</Label>
          <Input id="title" {...register("title", { required: true })} />
        </div>

        <div>
          <Label htmlFor="description">{t("tasks.description")}</Label>
          <Textarea id="description" {...register("description")} rows={4} />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="type">{t("tasks.type")}</Label>
            <Select onValueChange={(v) => setValue("type", v)} defaultValue="Task">
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Task">{t("taskType.Task")}</SelectItem>
                <SelectItem value="Request">{t("taskType.Request")}</SelectItem>
                <SelectItem value="Bug">{t("taskType.Bug")}</SelectItem>
                <SelectItem value="Idea">{t("taskType.Idea")}</SelectItem>
                <SelectItem value="Improvement">{t("taskType.Improvement")}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="priority">{t("tasks.priority")}</Label>
            <Select onValueChange={(v) => setValue("priority", v)} defaultValue="Medium">
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Low">{t("taskPriority.Low")}</SelectItem>
                <SelectItem value="Medium">{t("taskPriority.Medium")}</SelectItem>
                <SelectItem value="High">{t("taskPriority.High")}</SelectItem>
                <SelectItem value="Critical">{t("taskPriority.Critical")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="status">{t("tasks.status")}</Label>
            <Select onValueChange={(v) => setValue("status", v)} defaultValue="To Do">
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Backlog">{t("taskStatus.Backlog")}</SelectItem>
                <SelectItem value="To Do">{t("taskStatus.To Do")}</SelectItem>
                <SelectItem value="In Progress">{t("taskStatus.In Progress")}</SelectItem>
                <SelectItem value="Blocked">{t("taskStatus.Blocked")}</SelectItem>
                <SelectItem value="Done">{t("taskStatus.Done")}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="project_id">{t("tasks.project")}</Label>
            <Select onValueChange={(v) => setValue("project_id", v)}>
              <SelectTrigger>
                <SelectValue placeholder="Select project" />
              </SelectTrigger>
              <SelectContent>
                {projects.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="start_date">{t("tasks.startDate")}</Label>
            <Input id="start_date" type="date" {...register("start_date")} />
          </div>

          <div>
            <Label htmlFor="due_date">{t("tasks.dueDate")}</Label>
            <Input id="due_date" type="date" {...register("due_date")} />
          </div>
        </div>

        <div>
          <Label htmlFor="estimate_hours">{t("tasks.estimateHours")}</Label>
          <Input id="estimate_hours" type="number" step="0.5" {...register("estimate_hours")} />
        </div>

        <div>
          <Label>{t("tasks.skillTags")}</Label>
          <div className="flex gap-2 mb-2">
            <Input
              value={skillInput}
              onChange={(e) => setSkillInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addSkillTag())}
              placeholder="Add skill tag..."
            />
            <Button type="button" onClick={addSkillTag}>
              Add
            </Button>
          </div>
          <div className="flex flex-wrap gap-2">
            {skillTags.map((tag) => (
              <Badge key={tag} variant="secondary">
                {tag}
                <X className="h-3 w-3 ml-1 cursor-pointer" onClick={() => removeSkillTag(tag)} />
              </Badge>
            ))}
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <Label htmlFor="assignee_id">{t("tasks.assignee")}</Label>
            <Button type="button" variant="outline" size="sm" onClick={getSuggestions} disabled={aiLoading}>
              {aiLoading ? (
                <Loader2 className="h-4 w-4 animate-spin mr-1" />
              ) : (
                <Sparkles className="h-4 w-4 mr-1" />
              )}
              {t("tasks.aiSuggestions")}
            </Button>
          </div>
          <Select onValueChange={(v) => setValue("assignee_id", v)}>
            <SelectTrigger>
              <SelectValue placeholder={t("tasks.unassigned")} />
            </SelectTrigger>
            <SelectContent>
              {users.map((u) => (
                <SelectItem key={u.id} value={u.id}>
                  {u.name} {u.surname} - {u.department}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {suggestions.length > 0 && (
            <Card className="mt-3">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">{t("tasks.suggestedAssignees")}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {suggestions.map((user) => (
                  <div
                    key={user.id}
                    className="flex items-center justify-between p-2 rounded-md border cursor-pointer hover:bg-accent"
                    onClick={() => setValue("assignee_id", user.id)}
                  >
                    <div className="flex items-center gap-2">
                      <Avatar className="h-8 w-8">
                        <AvatarFallback>
                          {user.name[0]}
                          {user.surname[0]}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="text-sm font-medium">
                          {user.name} {user.surname}
                        </p>
                        <p className="text-xs text-muted-foreground">{user.department}</p>
                      </div>
                    </div>
                    {user.skills && user.skills.length > 0 && (
                      <div className="flex gap-1">
                        {user.skills.slice(0, 2).map((skill) => (
                          <Badge key={skill} variant="outline" className="text-xs">
                            {skill}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      <div className="flex gap-2 justify-end">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel}>
            {t("tasks.cancel")}
          </Button>
        )}
        <Button type="submit" disabled={loading}>
          {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
          {t("tasks.createTask")}
        </Button>
      </div>
    </form>
  );
};
