import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Search, Loader2, ListChecks, Folder, Users, UserCircle } from "lucide-react";
import { Input } from "@/components/ui/input";
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
  description: string | null;
}

interface UserResult {
  id: string;
  name: string;
  surname: string;
  department: string;
  global_role: string;
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

const initialResults: SearchResults = {
  tasks: [],
  projects: [],
  users: [],
  teams: [],
};

const MIN_QUERY_LENGTH = 2;

export const GlobalSearch = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const containerRef = useRef<HTMLDivElement>(null);

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResults>(initialResults);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEsc);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEsc);
    };
  }, []);

  useEffect(() => {
    if (query.trim().length < MIN_QUERY_LENGTH) {
      setResults(initialResults);
      return;
    }

    const handler = setTimeout(() => {
      void performSearch(query.trim());
    }, 350);

    return () => clearTimeout(handler);
  }, [query]);

  const performSearch = async (term: string) => {
    setLoading(true);
    const searchValue = `%${term}%`;

    try {
      const [tasksRes, projectsRes, usersRes, teamsRes] = await Promise.all([
        supabase
          .from("tasks")
          .select("id, title, status, priority, project:projects(name)")
          .or(`title.ilike.${searchValue},description.ilike.${searchValue}`)
          .limit(5),
        supabase
          .from("projects")
          .select("id, name, status, description")
          .or(`name.ilike.${searchValue},description.ilike.${searchValue}`)
          .limit(5),
        supabase
          .from("profiles")
          .select("id, name, surname, department, global_role")
          .or(`name.ilike.${searchValue},surname.ilike.${searchValue}`)
          .limit(5),
        supabase
          .from("teams")
          .select("id, name, description")
          .or(`name.ilike.${searchValue},description.ilike.${searchValue}`)
          .limit(5),
      ]);

      if (tasksRes.error || projectsRes.error || usersRes.error || teamsRes.error) {
        throw tasksRes.error || projectsRes.error || usersRes.error || teamsRes.error;
      }

      setResults({
        tasks: (tasksRes.data as TaskResult[]) || [],
        projects: (projectsRes.data as ProjectResult[]) || [],
        users: (usersRes.data as UserResult[]) || [],
        teams: (teamsRes.data as TeamResult[]) || [],
      });
    } catch (error: any) {
      console.error("Global search error", error);
      toast.error(error?.message || t("common.error"));
    } finally {
      setLoading(false);
    }
  };

  const hasResults = useMemo(
    () => Object.values(results).some((group) => group.length > 0),
    [results]
  );

  const shouldShowPanel = open && (loading || query.trim().length >= MIN_QUERY_LENGTH);

  const handleNavigate = (path: string) => {
    navigate(path);
    setOpen(false);
    setQuery("");
  };

  const renderSection = (
    title: string,
    icon: ReactNode,
    items: { id: string; content: ReactNode; href: string }[]
  ) => {
    if (items.length === 0) return null;

    return (
      <div>
        <div className="flex items-center gap-2 px-3 py-2 text-xs font-semibold uppercase text-muted-foreground">
          {icon}
          <span>{title}</span>
        </div>
        <div className="divide-y border-t">
          {items.map((item) => (
            <button
              key={item.id}
              type="button"
              className="w-full px-3 py-2 text-left text-sm hover:bg-accent"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => handleNavigate(item.href)}
            >
              {item.content}
            </button>
          ))}
        </div>
      </div>
    );
  };

  const taskItems = results.tasks.map((task) => ({
    id: task.id,
    href: `/tasks/${task.id}`,
    content: (
      <div className="space-y-1">
        <p className="font-medium text-foreground">{task.title}</p>
        <p className="text-xs text-muted-foreground">
          {t(`taskStatus.${task.status}`)} • {task.project?.name || t("tasks.project")}
        </p>
      </div>
    ),
  }));

  const projectItems = results.projects.map((project) => ({
    id: project.id,
    href: `/projects/${project.id}`,
    content: (
      <div className="space-y-1">
        <p className="font-medium text-foreground">{project.name}</p>
        <p className="text-xs text-muted-foreground">
          {t(`projectStatus.${project.status}`)}
          {project.description ? ` • ${project.description.slice(0, 50)}` : ""}
        </p>
      </div>
    ),
  }));

  const userItems = results.users.map((person) => ({
    id: person.id,
    href: `/admin?user=${person.id}`,
    content: (
      <div className="space-y-1">
        <p className="font-medium text-foreground">
          {person.name} {person.surname}
        </p>
        <p className="text-xs text-muted-foreground">
          {t(`departments.${person.department}`)} • {t(`roles.${person.global_role}`)}
        </p>
      </div>
    ),
  }));

  const teamItems = results.teams.map((team) => ({
    id: team.id,
    href: `/teams/${team.id}`,
    content: (
      <div className="space-y-1">
        <p className="font-medium text-foreground">{team.name}</p>
        {team.description && (
          <p className="text-xs text-muted-foreground">{team.description}</p>
        )}
      </div>
    ),
  }));

  return (
    <div className="relative w-full" ref={containerRef}>
      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          type="search"
          placeholder={t("common.searchPlaceholder")}
          value={query}
          onFocus={() => setOpen(true)}
          onChange={(event) => setQuery(event.target.value)}
          className="pl-8"
        />
      </div>

      {shouldShowPanel && (
        <div className="absolute z-50 mt-2 w-full rounded-lg border bg-popover text-popover-foreground shadow-xl">
          {loading && (
            <div className="flex items-center gap-2 px-3 py-4 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              {t("common.loading")}
            </div>
          )}

          {!loading && query.trim().length < MIN_QUERY_LENGTH && (
            <div className="px-3 py-4 text-sm text-muted-foreground">
              {t("common.searchHint")}
            </div>
          )}

          {!loading && query.trim().length >= MIN_QUERY_LENGTH && !hasResults && (
            <div className="px-3 py-4 text-sm text-muted-foreground">
              {t("common.noResults")}
            </div>
          )}

          {!loading && query.trim().length >= MIN_QUERY_LENGTH && hasResults && (
            <div className="max-h-96 overflow-auto">
              {renderSection(t("tasks.title"), <ListChecks className="h-4 w-4" />, taskItems)}
              {renderSection(t("projects.title"), <Folder className="h-4 w-4" />, projectItems)}
              {renderSection(t("admin.users"), <UserCircle className="h-4 w-4" />, userItems)}
              {renderSection(t("teams.title"), <Users className="h-4 w-4" />, teamItems)}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
