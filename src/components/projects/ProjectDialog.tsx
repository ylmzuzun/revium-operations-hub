import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "@/hooks/use-toast";
import { Loader2, X } from "lucide-react";
import { Database } from "@/integrations/supabase/types";

type ProjectStatus = Database["public"]["Enums"]["project_status"];
type TaskPriority = Database["public"]["Enums"]["task_priority"];

const projectSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(200, "Name too long"),
  description: z.string().trim().max(2000, "Description too long").optional(),
  status: z.enum(["Planned", "In Progress", "On Hold", "Completed"]),
  priority: z.enum(["Low", "Medium", "High", "Critical"]),
  start_date: z.string().optional(),
  end_date: z.string().optional(),
});

type ProjectFormData = z.infer<typeof projectSchema>;

interface ProjectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  project?: any;
  onSuccess: () => void;
  initialDate?: Date;
}

export const ProjectDialog = ({ open, onOpenChange, project, onSuccess, initialDate }: ProjectDialogProps) => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState<any[]>([]);
  const [selectedOwners, setSelectedOwners] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [tags, setTags] = useState<string[]>([]);

  const {
    register,
    handleSubmit,
    setValue,
    reset,
    formState: { errors },
  } = useForm<ProjectFormData>({
    resolver: zodResolver(projectSchema),
  });

  useEffect(() => {
    fetchUsers();
  }, []);

  useEffect(() => {
    if (initialDate && !project) {
      const dateStr = initialDate.toISOString().split('T')[0];
      setValue("start_date", dateStr);
      setValue("end_date", dateStr);
    }
  }, [initialDate, project, setValue]);

  useEffect(() => {
    if (project) {
      setValue("name", project.name);
      setValue("description", project.description || "");
      setValue("status", project.status);
      setValue("priority", project.priority);
      setValue("start_date", project.start_date || "");
      setValue("end_date", project.end_date || "");
      setTags(project.tags || []);
      fetchProjectOwners(project.id);
    } else {
      reset();
      setTags([]);
      setSelectedOwners([]);
      setValue("status", "Planned");
      setValue("priority", "Medium");
    }
  }, [project, setValue, reset]);

  const fetchUsers = async () => {
    const { data } = await supabase
      .from("profiles")
      .select("id, name, surname")
      .eq("is_active", true);
    if (data) setUsers(data);
  };

  const fetchProjectOwners = async (projectId: string) => {
    const { data } = await supabase
      .from("project_owners")
      .select("owner_id")
      .eq("project_id", projectId);
    if (data) {
      setSelectedOwners(data.map((po) => po.owner_id));
    }
  };

  const toggleOwner = (ownerId: string) => {
    setSelectedOwners((prev) =>
      prev.includes(ownerId)
        ? prev.filter((id) => id !== ownerId)
        : [...prev, ownerId]
    );
  };

  const addTag = () => {
    const trimmed = tagInput.trim();
    if (trimmed && !tags.includes(trimmed) && trimmed.length <= 50) {
      setTags([...tags, trimmed]);
      setTagInput("");
    }
  };

  const removeTag = (tag: string) => {
    setTags(tags.filter((t) => t !== tag));
  };

  const onSubmit = async (data: ProjectFormData) => {
    setLoading(true);
    try {
      if (project) {
        // Update existing project
        const { error: updateError } = await supabase
          .from("projects")
          .update({
            name: data.name,
            description: data.description || null,
            status: data.status,
            priority: data.priority,
            start_date: data.start_date || null,
            end_date: data.end_date || null,
            tags: tags.length > 0 ? tags : null,
          })
          .eq("id", project.id);

        if (updateError) throw updateError;

        // Update project owners
        await supabase.from("project_owners").delete().eq("project_id", project.id);
        if (selectedOwners.length > 0) {
          const { error: ownersError } = await supabase.from("project_owners").insert(
            selectedOwners.map((ownerId) => ({
              project_id: project.id,
              owner_id: ownerId,
            }))
          );
          if (ownersError) throw ownersError;
        }

        toast({ title: t("common.success"), description: t("common.projectUpdatedSuccessfully") });
      } else {
        // Create new project
        const { data: newProject, error: insertError } = await supabase
          .from("projects")
          .insert({
            name: data.name,
            description: data.description || null,
            status: data.status,
            priority: data.priority,
            start_date: data.start_date || null,
            end_date: data.end_date || null,
            tags: tags.length > 0 ? tags : null,
          })
          .select()
          .single();

        if (insertError) throw insertError;

        // Add project owners
        if (selectedOwners.length > 0 && newProject) {
          const { error: ownersError } = await supabase.from("project_owners").insert(
            selectedOwners.map((ownerId) => ({
              project_id: newProject.id,
              owner_id: ownerId,
            }))
          );
          if (ownersError) throw ownersError;
        }

        toast({ title: t("common.success"), description: t("common.projectCreatedSuccessfully") });
      }

      onSuccess();
      onOpenChange(false);
      reset();
      setTags([]);
      setSelectedOwners([]);
    } catch (error: any) {
      console.error("Project operation error:", error);
      toast({
        title: t("common.error"),
        description: error.message || "Failed to save project",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {project ? t("projects.editProject") : t("projects.newProject")}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <Label htmlFor="name">{t("projects.name")} *</Label>
            <Input id="name" {...register("name")} />
            {errors.name && (
              <p className="text-xs text-destructive mt-1">{errors.name.message}</p>
            )}
          </div>

          <div>
            <Label htmlFor="description">{t("tasks.description")}</Label>
            <Textarea id="description" {...register("description")} rows={3} />
            {errors.description && (
              <p className="text-xs text-destructive mt-1">{errors.description.message}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="status">{t("tasks.status")} *</Label>
              <Select
                onValueChange={(v) => setValue("status", v as ProjectStatus)}
                defaultValue={project?.status || "Planned"}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Planned">{t("projectStatus.Planned")}</SelectItem>
                  <SelectItem value="In Progress">{t("projectStatus.In Progress")}</SelectItem>
                  <SelectItem value="On Hold">{t("projectStatus.On Hold")}</SelectItem>
                  <SelectItem value="Completed">{t("projectStatus.Completed")}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="priority">{t("tasks.priority")} *</Label>
              <Select
                onValueChange={(v) => setValue("priority", v as TaskPriority)}
                defaultValue={project?.priority || "Medium"}
              >
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

          <div>
            <Label>{t("projects.owners")}</Label>
            <div className="border rounded-md p-3 max-h-48 overflow-y-auto space-y-2">
              {users.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
              ) : (
                users.map((user) => (
                  <div key={user.id} className="flex items-center space-x-2">
                    <Checkbox
                      id={`owner-${user.id}`}
                      checked={selectedOwners.includes(user.id)}
                      onCheckedChange={() => toggleOwner(user.id)}
                    />
                    <Label
                      htmlFor={`owner-${user.id}`}
                      className="text-sm font-normal cursor-pointer"
                    >
                      {user.name} {user.surname}
                    </Label>
                  </div>
                ))
              )}
            </div>
            {selectedOwners.length > 0 && (
              <p className="text-xs text-muted-foreground mt-1">
                {selectedOwners.length} {selectedOwners.length === 1 ? t("projects.owner").toLowerCase() : t("projects.owners").toLowerCase()} {t("common.selected")}
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="start_date">{t("projects.startDate")}</Label>
              <Input id="start_date" type="date" {...register("start_date")} />
            </div>

            <div>
              <Label htmlFor="end_date">{t("projects.endDate")}</Label>
              <Input id="end_date" type="date" {...register("end_date")} />
            </div>
          </div>

          <div>
            <Label>{t("projects.tags")}</Label>
            <div className="flex gap-2 mb-2">
              <Input
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addTag())}
                placeholder={t("projects.addTagPlaceholder")}
                maxLength={50}
              />
              <Button type="button" onClick={addTag} variant="outline">
                {t("common.add")}
              </Button>
            </div>
            <div className="flex flex-wrap gap-2">
              {tags.map((tag) => (
                <Badge key={tag} variant="secondary">
                  {tag}
                  <X className="h-3 w-3 ml-1 cursor-pointer" onClick={() => removeTag(tag)} />
                </Badge>
              ))}
            </div>
          </div>

          <div className="flex gap-2 justify-end pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              {t("tasks.cancel")}
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              {t("tasks.save")}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
