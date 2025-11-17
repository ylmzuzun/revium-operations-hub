import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useForm, Controller } from "react-hook-form";
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
import { Loader2, Sparkles, X, Check } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { Database } from "@/integrations/supabase/types";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

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
  const { register, handleSubmit, watch, setValue, control } = useForm();
  const [loading, setLoading] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [users, setUsers] = useState<Profile[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [suggestions, setSuggestions] = useState<Profile[]>([]);
  const [skillInput, setSkillInput] = useState("");
  const [skillTags, setSkillTags] = useState<string[]>([]);
  const [sendEmail, setSendEmail] = useState(true);
  const [selectedAssignees, setSelectedAssignees] = useState<string[]>([]);
  const [assigneeOpen, setAssigneeOpen] = useState(false);

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
      toast({ title: t("common.error"), description: t("common.pleaseEnterTaskTitle") });
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

      // Create the task
      const { data: taskData, error: taskError } = await supabase
        .from("tasks")
        .insert({
          title: formData.title,
          description: formData.description || null,
          type: formData.type || "Task",
          status: formData.status || "To Do",
          priority: formData.priority || "Medium",
          project_id: formData.project_id || null,
          assignee_id: selectedAssignees.length > 0 ? selectedAssignees[0] : null,
          start_date: formData.start_date || null,
          due_date: formData.due_date || null,
          end_time: formData.end_time || null,
          skill_tags: skillTags.length > 0 ? skillTags : null,
          created_by: user.id,
        })
        .select()
        .single();

      if (taskError) throw taskError;

      // Add all assignees to task_assignees table
      if (selectedAssignees.length > 0 && taskData) {
        const assigneeInserts = selectedAssignees.map(assigneeId => ({
          task_id: taskData.id,
          assignee_id: assigneeId,
          assigned_by: user.id,
        }));

        const { error: assigneeError } = await supabase
          .from("task_assignees")
          .insert(assigneeInserts);

        if (assigneeError) throw assigneeError;
      }

      toast({ title: t("common.success"), description: t("common.taskCreatedSuccessfully") });
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
              <SelectValue placeholder={t("common.selectProject")} />
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
          <Label htmlFor="end_time">{t("tasks.endTime")}</Label>
          <Input id="end_time" type="time" {...register("end_time")} />
        </div>

        <div>
          <Label>{t("tasks.skillTags")}</Label>
          <div className="flex gap-2 mb-2">
            <Input
              value={skillInput}
              onChange={(e) => setSkillInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addSkillTag())}
              placeholder={t("common.addSkillPlaceholder")}
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
            <Label>{t("tasks.assignee")} <span className="text-muted-foreground text-xs">({t("common.optional")})</span></Label>
            <Button type="button" variant="outline" size="sm" onClick={getSuggestions} disabled={aiLoading}>
              {aiLoading ? (
                <Loader2 className="h-4 w-4 animate-spin mr-1" />
              ) : (
                <Sparkles className="h-4 w-4 mr-1" />
              )}
              {t("tasks.aiSuggestions")}
            </Button>
          </div>
          <Popover open={assigneeOpen} onOpenChange={setAssigneeOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                role="combobox"
                type="button"
                className="w-full justify-between"
              >
                {selectedAssignees.length === 0
                  ? t("tasks.unassigned")
                  : `${selectedAssignees.length} ${t("common.selected")}`}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-full p-0 z-50 bg-popover" align="start">
              <Command>
                <CommandInput placeholder={t("common.search")} />
                <CommandEmpty>{t("common.noResults")}</CommandEmpty>
                <CommandGroup className="max-h-64 overflow-auto">
                  {users.map((user) => (
                    <CommandItem
                      key={user.id}
                      onSelect={() => {
                        setSelectedAssignees((prev) =>
                          prev.includes(user.id)
                            ? prev.filter((id) => id !== user.id)
                            : [...prev, user.id]
                        );
                      }}
                    >
                      <div className="flex items-center gap-2 flex-1">
                        <Check
                          className={cn(
                            "h-4 w-4",
                            selectedAssignees.includes(user.id)
                              ? "opacity-100"
                              : "opacity-0"
                          )}
                        />
                        <Avatar className="h-6 w-6">
                          <AvatarFallback className="text-xs">
                            {user.name[0]}{user.surname[0]}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1">
                          <span className="text-sm">
                            {user.name} {user.surname}
                          </span>
                          {user.skills && user.skills.length > 0 && (
                            <p className="text-xs text-muted-foreground">
                              {user.skills.slice(0, 2).join(", ")}
                            </p>
                          )}
                        </div>
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </Command>
            </PopoverContent>
          </Popover>
          
          {selectedAssignees.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-2">
              {selectedAssignees.map((id) => {
                const user = users.find((u) => u.id === id);
                return user ? (
                  <Badge key={id} variant="secondary" className="gap-1">
                    {user.name} {user.surname}
                    <X
                      className="h-3 w-3 cursor-pointer"
                      onClick={() =>
                        setSelectedAssignees((prev) =>
                          prev.filter((uid) => uid !== id)
                        )
                      }
                    />
                  </Badge>
                ) : null;
              })}
            </div>
          )}

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
                    onClick={() => {
                      if (!selectedAssignees.includes(user.id)) {
                        setSelectedAssignees([...selectedAssignees, user.id]);
                      }
                    }}
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

        <div className="flex items-center space-x-2">
          <Checkbox 
            id="sendEmail" 
            checked={sendEmail}
            onCheckedChange={(checked) => setSendEmail(checked as boolean)}
          />
          <Label htmlFor="sendEmail" className="text-sm font-normal cursor-pointer">
            {t("tasks.sendEmailNotification")}
          </Label>
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
