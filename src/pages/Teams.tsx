import { useEffect, useState } from "react";
import { Plus, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Tables } from "@/integrations/supabase/types";
import { TeamDialog } from "@/components/teams/TeamDialog";
import { Skeleton } from "@/components/ui/skeleton";

type Team = Tables<"teams"> & {
  team_lead: Tables<"profiles"> | null;
  member_count?: number;
};

const Teams = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);

  useEffect(() => {
    fetchTeams();
  }, []);

  const fetchTeams = async () => {
    setLoading(true);
    try {
      const { data: teamsData, error } = await supabase
        .from("teams")
        .select("*, team_lead:profiles!teams_team_lead_id_fkey(*)")
        .order("name");

      if (error) throw error;

      // Fetch member counts
      const teamsWithCounts = await Promise.all(
        (teamsData || []).map(async (team) => {
          const { count } = await supabase
            .from("team_members")
            .select("*", { count: "exact", head: true })
            .eq("team_id", team.id);

          return { ...team, member_count: count || 0 };
        })
      );

      setTeams(teamsWithCounts as Team[]);
    } catch (error) {
      console.error("Error fetching teams:", error);
    } finally {
      setLoading(false);
    }
  };

  const filteredTeams = teams.filter((team) =>
    team.name.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-10 w-full max-w-sm" />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t("teams.title")}</h1>
          <p className="text-muted-foreground mt-1">{t("teams.description")}</p>
        </div>
        <Button className="gap-2" onClick={() => setDialogOpen(true)}>
          <Plus className="h-4 w-4" />
          {t("teams.newTeam")}
        </Button>
      </div>

      <Input
        placeholder={t("teams.searchTeams")}
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="max-w-sm"
      />

      {filteredTeams.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            <p>{search ? t("teams.noTeamsFound") : t("teams.noTeams")}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredTeams.map((team) => (
            <Card
              key={team.id}
              className="cursor-pointer hover:bg-accent transition-colors"
              onClick={() => navigate(`/teams/${team.id}`)}
            >
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h3 className="font-semibold text-lg mb-2">{team.name}</h3>
                    {team.description && (
                      <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
                        {team.description}
                      </p>
                    )}
                    <div className="space-y-1">
                      {team.team_lead && (
                        <p className="text-sm">
                          <span className="text-muted-foreground">
                            {t("teams.teamLead")}:{" "}
                          </span>
                          {team.team_lead.name} {team.team_lead.surname}
                        </p>
                      )}
                      <div className="flex items-center gap-1 text-sm text-muted-foreground">
                        <Users className="h-4 w-4" />
                        <span>
                          {team.member_count} {t("teams.members")}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <TeamDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        team={null}
        onSuccess={fetchTeams}
      />
    </div>
  );
};

export default Teams;
