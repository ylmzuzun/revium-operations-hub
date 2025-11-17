import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { supabase } from "@/integrations/supabase/client";
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
import { toast } from "@/hooks/use-toast";
import { Loader2, X } from "lucide-react";
import { Database } from "@/integrations/supabase/types";

type DepartmentType = Database["public"]["Enums"]["department_type"];
type GlobalRole = Database["public"]["Enums"]["global_role"];

const userSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100, "Name too long"),
  surname: z.string().trim().min(1, "Surname is required").max(100, "Surname too long"),
  email: z.string().trim().email("Invalid email").max(255, "Email too long"),
  phone: z.string().trim().max(20, "Phone too long").optional(),
  title: z.string().trim().max(100, "Title too long").optional(),
  bio: z.string().trim().max(500, "Bio too long").optional(),
  department: z.enum(["Management", "Mechanical", "Electrical", "Software", "Sales", "Logistics", "Finance", "Other"]),
  global_role: z.enum(["Admin", "Manager", "TeamLead", "Member", "Viewer"]),
  password: z.string().optional(),
});

type UserFormData = z.infer<typeof userSchema>;

interface UserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user?: any;
  onSuccess: () => void;
}

export const UserDialog = ({ open, onOpenChange, user, onSuccess }: UserDialogProps) => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [skillInput, setSkillInput] = useState("");
  const [skills, setSkills] = useState<string[]>([]);
  const [generatedPassword, setGeneratedPassword] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    reset,
    formState: { errors },
  } = useForm<UserFormData>({
    resolver: zodResolver(userSchema),
  });

  useEffect(() => {
    if (user) {
      setValue("name", user.name);
      setValue("surname", user.surname);
      setValue("email", user.email || "");
      setValue("phone", user.phone || "");
      setValue("title", user.title || "");
      setValue("bio", user.bio || "");
      setValue("department", user.department);
      setValue("global_role", user.global_role);
      setSkills(user.skills || []);
      setGeneratedPassword(null);
    } else {
      reset();
      setSkills([]);
      setGeneratedPassword(null);
    }
  }, [user, setValue, reset]);

  const addSkill = () => {
    const trimmed = skillInput.trim();
    if (trimmed && !skills.includes(trimmed) && trimmed.length <= 50) {
      setSkills([...skills, trimmed]);
      setSkillInput("");
    }
  };

  const removeSkill = (skill: string) => {
    setSkills(skills.filter((s) => s !== skill));
  };

  const onSubmit = async (data: UserFormData) => {
    setLoading(true);
    try {
      if (user) {
        const { error } = await supabase
          .from("profiles")
          .update({
            name: data.name,
            surname: data.surname,
            phone: data.phone || null,
            title: data.title || null,
            bio: data.bio || null,
            department: data.department,
            global_role: data.global_role,
            skills: skills.length > 0 ? skills : null,
          })
          .eq("id", user.id);

        if (error) throw error;
        toast({ title: t("common.success"), description: t("admin.userUpdated") });
      } else {
        const generatedPassword = data.password || Array.from({ length: 10 }, () => 
          'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*'[
            Math.floor(Math.random() * 68)
          ]
        ).join('');

        const { data: authData, error: signUpError } = await supabase.auth.admin.createUser({
          email: data.email,
          password: generatedPassword,
          email_confirm: true,
          user_metadata: { name: data.name, surname: data.surname },
        });

        if (signUpError) throw signUpError;

        if (authData.user) {
          await supabase.from("profiles").update({
            phone: data.phone || null,
            title: data.title || null,
            bio: data.bio || null,
            department: data.department,
            global_role: data.global_role,
            skills: skills.length > 0 ? skills : null,
          }).eq("id", authData.user.id);
        }

        toast({ title: t("common.success"), description: t("admin.userCreated") });
      }

      onSuccess();
      onOpenChange(false);
      reset();
      setSkills([]);
    } catch (error: any) {
      toast({ title: t("common.error"), description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    onOpenChange(false);
    setGeneratedPassword(null);
    reset();
    setSkills([]);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{user ? t("admin.editUser") : t("admin.newUser")}</DialogTitle>
        </DialogHeader>
        
        {generatedPassword ? (
          <div className="space-y-4">
            <div className="bg-muted p-4 rounded-lg space-y-2">
              <p className="text-sm font-medium">{t("admin.userCreatedSuccess")}</p>
              <p className="text-xs text-muted-foreground">{t("admin.passwordInfo")}</p>
              <div className="flex items-center gap-2">
                <Input value={generatedPassword} readOnly className="font-mono" />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    navigator.clipboard.writeText(generatedPassword);
                    toast({ title: t("common.success"), description: t("admin.passwordCopied") });
                  }}
                >
                  {t("common.copy")}
                </Button>
              </div>
            </div>
            <Button type="button" onClick={handleClose} className="w-full">
              {t("common.close")}
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>{t("auth.name")} *</Label>
              <Input {...register("name")} />
              {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
            </div>
            <div>
              <Label>{t("auth.surname")} *</Label>
              <Input {...register("surname")} />
              {errors.surname && <p className="text-xs text-destructive">{errors.surname.message}</p>}
            </div>
          </div>
          <div>
            <Label>{t("auth.email")} *</Label>
            <Input {...register("email")} disabled={!!user} className={user ? "bg-muted" : ""} />
            {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
          </div>
          {!user && (
            <div>
              <Label>{t("auth.password")} (optional - auto-generated)</Label>
              <Input type="password" {...register("password")} />
            </div>
          )}
          <div>
            <Label>{t("profile.phone")}</Label>
            <Input {...register("phone")} />
          </div>
          <div>
            <Label>{t("profile.title")}</Label>
            <Input {...register("title")} />
          </div>
          <div>
            <Label>{t("profile.bio")}</Label>
            <Textarea {...register("bio")} rows={3} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>{t("admin.department")} *</Label>
              <Select onValueChange={(v) => setValue("department", v as DepartmentType)} defaultValue={user?.department}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["Management", "Mechanical", "Electrical", "Software", "Sales", "Logistics", "Finance", "Other"].map((d) => (
                    <SelectItem key={d} value={d}>{t(`departments.${d}`)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>{t("admin.role")} *</Label>
              <Select onValueChange={(v) => setValue("global_role", v as GlobalRole)} defaultValue={user?.global_role}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["Admin", "Manager", "TeamLead", "Member", "Viewer"].map((r) => (
                    <SelectItem key={r} value={r}>{t(`roles.${r}`)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label>{t("admin.skills")}</Label>
            <div className="flex gap-2 mb-2">
              <Input value={skillInput} onChange={(e) => setSkillInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addSkill())} />
              <Button type="button" onClick={addSkill} variant="secondary">{t("common.add")}</Button>
            </div>
            <div className="flex flex-wrap gap-2">
              {skills.map((s) => (
                <Badge key={s} variant="secondary">{s}<X className="h-3 w-3 ml-1 cursor-pointer" onClick={() => removeSkill(s)} /></Badge>
              ))}
            </div>
          </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={handleClose}>
                {t("common.cancel")}
              </Button>
              <Button type="submit" disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {t("common.save")}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
};
