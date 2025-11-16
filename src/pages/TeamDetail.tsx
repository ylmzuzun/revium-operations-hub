import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, UserPlus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useTranslation } from "react-i18next";
import { Tables } from "@/integrations/supabase/types";
import { Skeleton } from "@/components/ui/skeleton";

type Team = Tables<"teams">;
type Profile = Tables<"profiles">;
type TeamMember = Tables<"team_members"> & {
  profiles: Profile;
};
type Task = Tables<"tasks"> & {
  assignee: Profile | null;
};

const TeamDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [team, setTeam] = useState<Team | null>(null);
  const [teamLead, setTeamLead] = useState<Profile | null>(null);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [availableUsers, setAvailableUsers] = useState<Profile[]>([]);
  const [selectedUser, setSelectedUser] = useState("");
  const [memberToRemove, setMemberToRemove] = useState<string | null>(null);

  useEffect(() => {
    if (id) {
      fetchTeamData();
    }
  }, [id]);

  const fetchTeamData = async () => {
    if (!id) return;
    setLoading(true);

    try {
      // Fetch team
      const { data: teamData, error: teamError } = await supabase
        .from("teams")
        .select("*")
        .eq("id", id)
        .single();

      if (teamError) throw teamError;
      setTeam(teamData);

      // Fetch team lead
      if (teamData.team_lead_id) {
        const { data: leadData } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", teamData.team_lead_id)
          .single();
        setTeamLead(leadData);
      }

      // Fetch members
      const { data: membersData, error: membersError } = await supabase
        .from("team_members")
        .select("*, profiles(*)")
        .eq("team_id", id);

      if (membersError) throw membersError;
      setMembers(membersData as TeamMember[]);

      // Fetch available users (not in team)
      const memberIds = membersData.map((m) => m.user_id);
      const { data: usersData } = await supabase
        .from("profiles")
        .select("*")
        .eq("is_active", true)
        .not("id", "in", `(${memberIds.join(",")})`)
        .order("name");
      setAvailableUsers(usersData || []);

      // Fetch team tasks
      const { data: teamTasksData } = await supabase
        .from("task_teams")
        .select("task_id")
        .eq("team_id", id);

      if (teamTasksData && teamTasksData.length > 0) {
        const taskIds = teamTasksData.map((tt) => tt.task_id);
        const { data: tasksData } = await supabase
          .from("tasks")
          .select("*, assignee:profiles!tasks_assignee_id_fkey(*)")
          .in("id", taskIds)
          .order("created_at", { ascending: false });
        setTasks((tasksData as Task[]) || []);
      }
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

  const addMember = async () => {
    if (!selectedUser || !id) return;

    const { error } = await supabase
      .from("team_members")
      .insert({ team_id: id, user_id: selectedUser });

    if (error) {
      toast({
        title: t("common.error"),
        description: error.message,
        variant: "destructive",
      });
      return;
    }

    toast({
      title: t("common.success"),
      description: t("teams.memberAdded"),
    });
    setSelectedUser("");
    fetchTeamData();
  };

  const removeMember = async () => {
    if (!memberToRemove) return;

    const { error } = await supabase
      .from("team_members")
      .delete()
      .eq("id", memberToRemove);

    if (error) {
      toast({
        title: t("common.error"),
        description: error.message,
        variant: "destructive",
      });
      return;
    }

    toast({
      title: t("common.success"),
      description: t("teams.memberRemoved"),
    });
    setMemberToRemove(null);
    fetchTeamData();
  };

  const getPriorityColor = (priority: string) => {
    const colors = {
      Low: "bg-blue-500/10 text-blue-500 border-blue-500/20",
      Medium: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20",
      High: "bg-orange-500/10 text-orange-500 border-orange-500/20",
      Critical: "bg-red-500/10 text-red-500 border-red-500/20",
    };
    return colors[priority as keyof typeof colors] || colors.Medium;
  };

  const getStatusColor = (status: string) => {
    const colors = {
      Backlog: "bg-gray-500/10 text-gray-500 border-gray-500/20",
      "To Do": "bg-blue-500/10 text-blue-500 border-blue-500/20",
      "In Progress": "bg-purple-500/10 text-purple-500 border-purple-500/20",
      Blocked: "bg-red-500/10 text-red-500 border-red-500/20",
      "Waiting Approval": "bg-yellow-500/10 text-yellow-500 border-yellow-500/20",
      Done: "bg-green-500/10 text-green-500 border-green-500/20",
      Canceled: "bg-gray-500/10 text-gray-500 border-gray-500/20",
    };
    return colors[status as keyof typeof colors] || colors.Backlog;
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!team) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">{t("teams.teamNotFound")}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate("/teams")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{team.name}</h1>
          {team.description && (
            <p className="text-muted-foreground mt-1">{team.description}</p>
          )}
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{t("teams.teamInfo")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div>
              <p className="text-sm text-muted-foreground">{t("teams.teamLead")}</p>
              <p className="font-medium">
                {teamLead ? `${teamLead.name} ${teamLead.surname}` : t("teams.noTeamLead")}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">{t("teams.membersCount")}</p>
              <p className="font-medium">{members.length}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              {t("teams.addMember")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2">
              <Select value={selectedUser} onValueChange={setSelectedUser}>
                <SelectTrigger>
                  <SelectValue placeholder={t("teams.selectMember")} />
                </SelectTrigger>
                <SelectContent>
                  {availableUsers.map((user) => (
                    <SelectItem key={user.id} value={user.id}>
                      {user.name} {user.surname}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button onClick={addMember} disabled={!selectedUser}>
                <UserPlus className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("teams.members")}</CardTitle>
        </CardHeader>
        <CardContent>
          {members.length === 0 ? (
            <p className="text-center text-muted-foreground py-4">
              {t("teams.noMembers")}
            </p>
          ) : (
            <div className="space-y-2">
              {members.map((member) => (
                <div
                  key={member.id}
                  className="flex items-center justify-between p-3 rounded-lg border"
                >
                  <div>
                    <p className="font-medium">
                      {member.profiles.name} {member.profiles.surname}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {member.profiles.title || member.profiles.department}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setMemberToRemove(member.id)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("teams.teamTasks")}</CardTitle>
        </CardHeader>
        <CardContent>
          {tasks.length === 0 ? (
            <p className="text-center text-muted-foreground py-4">
              {t("teams.noTasks")}
            </p>
          ) : (
            <div className="space-y-2">
              {tasks.map((task) => (
                <div
                  key={task.id}
                  className="flex items-center justify-between p-3 rounded-lg border cursor-pointer hover:bg-accent"
                  onClick={() => navigate(`/tasks/${task.id}`)}
                >
                  <div className="flex-1">
                    <p className="font-medium">{task.title}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge className={getStatusColor(task.status)} variant="outline">
                        {t(`tasks.status.${task.status}`)}
                      </Badge>
                      <Badge className={getPriorityColor(task.priority)} variant="outline">
                        {t(`tasks.priority.${task.priority}`)}
                      </Badge>
                      {task.assignee && (
                        <span className="text-sm text-muted-foreground">
                          {task.assignee.name} {task.assignee.surname}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={!!memberToRemove} onOpenChange={() => setMemberToRemove(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("teams.removeMember")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("teams.removeMemberConfirm")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={removeMember}>
              {t("common.remove")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default TeamDetail;
