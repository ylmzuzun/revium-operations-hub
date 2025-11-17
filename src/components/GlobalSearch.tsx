import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { Search, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface TaskResult {
  id: string;
  title: string;
  status: string;
  priority: string;
  project?: { name: string | null } | null;
}

interface ProjectResult {
  id: string;
  name: string;
  status: string;
}

interface UserResult {
  id: string;
  name: string;
  surname: string;
  global_role: string | null;
  department: string | null;
}

interface TeamResult {
  id: string;
  name: string;
  description: string | null;
}

interface SearchResults {
  tasks: TaskResult[];
  projects: ProjectResult[];
  users: UserResult[];
  teams: TeamResult[];
}

const createEmptyResults = (): SearchResults => ({
  tasks: [],
  projects: [],
  users: [],
  teams: [],
});

export function GlobalSearch() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const containerRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<SearchResults>(createEmptyResults());

  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  useEffect(() => {
    if (!query.trim()) {
      setResults(createEmptyResults());
      setLoading(false);
      return;
    }

    setLoading(true);
    const timeout = setTimeout(() => {
      void performSearch(query.trim());
    }, 400);

    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  const performSearch = async (term: string) => {
    const sanitized = term.replace(/[%,]/g, "").trim();
    if (!sanitized) {
      setResults(createEmptyResults());
      setLoading(false);
      return;
    }

    const filter = `%${sanitized}%`;

    try {
      const [tasksRes, projectsRes, usersRes, teamsRes] = await Promise.all([
        supabase
          .from("tasks")
          .select("id,title,status,priority,project:projects(name)")
          .or(`title.ilike.${filter},description.ilike.${filter}`)
          .limit(5),
        supabase
          .from("projects")
          .select("id,name,status")
          .or(`name.ilike.${filter},description.ilike.${filter}`)
          .limit(5),
        supabase
          .from("profiles")
          .select("id,name,surname,global_role,department")
          .or(`name.ilike.${filter},surname.ilike.${filter},email.ilike.${filter}`)
          .limit(5),
        supabase
          .from("teams")
          .select("id,name,description")
          .or(`name.ilike.${filter},description.ilike.${filter}`)
          .limit(5),
      ]);

      if (tasksRes.error || projectsRes.error || usersRes.error || teamsRes.error) {
        throw tasksRes.error || projectsRes.error || usersRes.error || teamsRes.error;
      }

      setResults({
        tasks: tasksRes.data || [],
        projects: projectsRes.data || [],
        users: usersRes.data || [],
        teams: teamsRes.data || [],
      });
    } catch (error) {
      console.error("Global search failed", error);
      toast.error(t("common.error"));
    } finally {
      setLoading(false);
    }
  };

  const handleNavigate = (path: string) => {
    navigate(path);
    setOpen(false);
  };

  const hasResults =
    results.tasks.length > 0 ||
    results.projects.length > 0 ||
    results.users.length > 0 ||
    results.teams.length > 0;

  const renderSectionTitle = (label: string) => (
    <p className="px-3 pb-1 text-xs font-medium uppercase text-muted-foreground">{label}</p>
  );

  return (
    <div className="relative" ref={containerRef}>
      <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
      <Input
        type="search"
        placeholder={t("common.searchPlaceholder")}
        value={query}
        onFocus={() => setOpen(true)}
        onChange={(event) => setQuery(event.target.value)}
        className="pl-8"
      />

      {open && (
        <div className="absolute left-0 right-0 top-12 z-50 rounded-md border bg-popover shadow-lg">
          {loading ? (
            <div className="flex items-center gap-2 px-4 py-6 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              {t("common.loading")}
            </div>
          ) : query.trim().length === 0 ? (
            <div className="px-4 py-6 text-sm text-muted-foreground">
              {t("common.searchPlaceholder")}
            </div>
          ) : !hasResults ? (
            <div className="px-4 py-6 text-sm text-muted-foreground">{t("common.noResults")}</div>
          ) : (
            <div className="max-h-96 overflow-y-auto py-2">
              {results.tasks.length > 0 && (
                <div>
                  {renderSectionTitle(t("nav.tasks"))}
                  <div className="space-y-1">
                    {results.tasks.map((task) => (
                      <button
                        key={task.id}
                        className="flex w-full flex-col gap-1 px-3 py-2 text-left hover:bg-muted"
                        onClick={() => handleNavigate(`/tasks/${task.id}`)}
                      >
                        <span className="text-sm font-medium">{task.title}</span>
                        <span className="text-xs text-muted-foreground">
                          {task.project?.name ? `${task.project.name} · ` : ""}
                          {t(`taskStatus.${task.status}`, { defaultValue: task.status })}
                        </span>
                        <Badge variant="outline" className="w-fit text-xs">
                          {t(`taskPriority.${task.priority}`, { defaultValue: task.priority })}
                        </Badge>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {results.projects.length > 0 && (
                <div>
                  {renderSectionTitle(t("nav.projects"))}
                  <div className="space-y-1">
                    {results.projects.map((project) => (
                      <button
                        key={project.id}
                        className="flex w-full flex-col gap-1 px-3 py-2 text-left hover:bg-muted"
                        onClick={() => handleNavigate(`/projects/${project.id}`)}
                      >
                        <span className="text-sm font-medium">{project.name}</span>
                        <span className="text-xs text-muted-foreground">
                          {t(`projectStatus.${project.status}`, { defaultValue: project.status })}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {results.users.length > 0 && (
                <div>
                  {renderSectionTitle(t("logs.users"))}
                  <div className="space-y-1">
                    {results.users.map((user) => (
                      <button
                        key={user.id}
                        className="flex w-full flex-col gap-1 px-3 py-2 text-left hover:bg-muted"
                        onClick={() => handleNavigate(`/admin?user=${user.id}`)}
                      >
                        <span className="text-sm font-medium">
                          {user.name} {user.surname}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {[user.global_role, user.department].filter(Boolean).join(" · ") || t("common.noData")}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {results.teams.length > 0 && (
                <div>
                  {renderSectionTitle(t("nav.teams"))}
                  <div className="space-y-1">
                    {results.teams.map((team) => (
                      <button
                        key={team.id}
                        className="flex w-full flex-col gap-1 px-3 py-2 text-left hover:bg-muted"
                        onClick={() => handleNavigate(`/teams/${team.id}`)}
                      >
                        <span className="text-sm font-medium">{team.name}</span>
                        {team.description && (
                          <span className="text-xs text-muted-foreground line-clamp-2">
                            {team.description}
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
