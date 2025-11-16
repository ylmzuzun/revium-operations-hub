import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useForm } from "react-hook-form";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { Loader2, X } from "lucide-react";
import { Database } from "@/integrations/supabase/types";

type DepartmentType = Database["public"]["Enums"]["department_type"];
type GlobalRole = Database["public"]["Enums"]["global_role"];

const Profile = () => {
  const { t } = useTranslation();
  const { profile } = useAuth();
  const { register, handleSubmit, setValue } = useForm();
  const [loading, setLoading] = useState(false);
  const [skillInput, setSkillInput] = useState("");
  const [skills, setSkills] = useState<string[]>([]);

  useEffect(() => {
    if (profile) {
      setValue("name", profile.name);
      setValue("surname", profile.surname);
      setValue("phone", profile.phone);
      setValue("title", profile.title);
      setValue("bio", profile.bio);
      setValue("department", profile.department);
      setValue("global_role", profile.global_role);
      setSkills(profile.skills || []);
    }
  }, [profile, setValue]);

  const addSkill = () => {
    if (skillInput.trim() && !skills.includes(skillInput.trim())) {
      setSkills([...skills, skillInput.trim()]);
      setSkillInput("");
    }
  };

  const removeSkill = (skill: string) => {
    setSkills(skills.filter((s) => s !== skill));
  };

  const onSubmit = async (data: any) => {
    if (!profile) return;

    setLoading(true);
    try {
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
        .eq("id", profile.id);

      if (error) throw error;

      toast({ title: t("common.success"), description: "Profile updated successfully" });
    } catch (error: any) {
      toast({ title: t("common.error"), description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  if (!profile) return null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{t("profile.title")}</h1>
        <p className="text-muted-foreground mt-1">{t("profile.editProfile")}</p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>{t("profile.personalInfo")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="name">{t("auth.name")}</Label>
                <Input id="name" {...register("name", { required: true })} />
              </div>
              <div>
                <Label htmlFor="surname">{t("auth.surname")}</Label>
                <Input id="surname" {...register("surname", { required: true })} />
              </div>
            </div>

            <div>
              <Label htmlFor="phone">{t("profile.phone")}</Label>
              <Input id="phone" {...register("phone")} />
            </div>

            <div>
              <Label htmlFor="bio">{t("profile.bio")}</Label>
              <Textarea id="bio" {...register("bio")} rows={3} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("profile.workInfo")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="title">{t("profile.title")}</Label>
              <Input id="title" {...register("title")} />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="department">{t("admin.department")}</Label>
                <Select onValueChange={(v) => setValue("department", v)} defaultValue={profile.department}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {["Management", "Mechanical", "Electrical", "Software", "Sales", "Logistics", "Finance", "Other"].map((dept) => (
                      <SelectItem key={dept} value={dept}>
                        {t(`departments.${dept}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="global_role">{t("admin.role")}</Label>
                <Select onValueChange={(v) => setValue("global_role", v)} defaultValue={profile.global_role}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {["Admin", "Manager", "TeamLead", "Member", "Viewer"].map((role) => (
                      <SelectItem key={role} value={role}>
                        {t(`roles.${role}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label>{t("admin.skills")}</Label>
              <div className="flex gap-2 mb-2">
                <Input
                  value={skillInput}
                  onChange={(e) => setSkillInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addSkill())}
                  placeholder="Add skill..."
                />
                <Button type="button" onClick={addSkill}>
                  Add
                </Button>
              </div>
              <div className="flex flex-wrap gap-2">
                {skills.map((skill) => (
                  <Badge key={skill} variant="secondary">
                    {skill}
                    <X className="h-3 w-3 ml-1 cursor-pointer" onClick={() => removeSkill(skill)} />
                  </Badge>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end">
          <Button type="submit" disabled={loading}>
            {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            {t("profile.save")}
          </Button>
        </div>
      </form>
    </div>
  );
};

export default Profile;
