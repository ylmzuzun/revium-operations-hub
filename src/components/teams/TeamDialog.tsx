import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useTranslation } from "react-i18next";
import { Tables } from "@/integrations/supabase/types";

const teamSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  team_lead_id: z.string().optional(),
});

type TeamFormData = z.infer<typeof teamSchema>;

interface TeamDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  team?: Tables<"teams"> | null;
  onSuccess: () => void;
}

export const TeamDialog = ({ open, onOpenChange, team, onSuccess }: TeamDialogProps) => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState<Tables<"profiles">[]>([]);

  const form = useForm<TeamFormData>({
    resolver: zodResolver(teamSchema),
    defaultValues: {
      name: "",
      description: "",
      team_lead_id: "",
    },
  });

  useEffect(() => {
    fetchUsers();
  }, []);

  useEffect(() => {
    if (team) {
      form.reset({
        name: team.name,
        description: team.description || "",
        team_lead_id: team.team_lead_id || "",
      });
    } else {
      form.reset({
        name: "",
        description: "",
        team_lead_id: "",
      });
    }
  }, [team, form]);

  const fetchUsers = async () => {
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("is_active", true)
      .order("name");
    if (data) setUsers(data);
  };

  const onSubmit = async (data: TeamFormData) => {
    setLoading(true);
    try {
      const teamData = {
        name: data.name,
        description: data.description || null,
        team_lead_id: data.team_lead_id || null,
      };

      if (team) {
        const { error } = await supabase
          .from("teams")
          .update(teamData)
          .eq("id", team.id);

        if (error) throw error;

        toast({
          title: t("common.success"),
          description: t("teams.teamUpdated"),
        });
      } else {
        const { error } = await supabase.from("teams").insert(teamData);

        if (error) throw error;

        toast({
          title: t("common.success"),
          description: t("teams.teamCreated"),
        });
      }

      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      toast({
        title: t("common.error"),
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>
            {team ? t("teams.editTeam") : t("teams.createTeam")}
          </DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("teams.name")}</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("teams.description")}</FormLabel>
                  <FormControl>
                    <Textarea {...field} rows={3} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="team_lead_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("teams.teamLead")}</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder={t("teams.selectTeamLead")} />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="">
                        {t("teams.noTeamLead")}
                      </SelectItem>
                      {users.map((user) => (
                        <SelectItem key={user.id} value={user.id}>
                          {user.name} {user.surname}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                {t("common.cancel")}
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? t("common.saving") : t("common.save")}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};
