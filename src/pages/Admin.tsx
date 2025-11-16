import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
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
import { UserDialog } from "@/components/admin/UserDialog";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/hooks/use-toast";
import { Plus, Search, Edit, Ban, CheckCircle, Users } from "lucide-react";
import { format } from "@/lib/dateUtils";

const Admin = () => {
  const { t } = useTranslation();
  const { profile } = useAuth();
  const [users, setUsers] = useState<any[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [alertOpen, setAlertOpen] = useState(false);
  const [alertAction, setAlertAction] = useState<"activate" | "deactivate">("deactivate");

  useEffect(() => {
    fetchUsers();
  }, []);

  useEffect(() => {
    filterUsers();
  }, [searchQuery, users]);

  const fetchUsers = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      // Check if error is due to RLS policy (unauthorized access)
      if (error.code === 'PGRST301' || error.message?.includes('row-level security')) {
        toast({
          title: t("common.error"),
          description: t("common.noPermission"),
          variant: "destructive",
        });
        setUsers([]);
        setLoading(false);
        return;
      }
      
      toast({ title: t("common.error"), description: error.message, variant: "destructive" });
    } else {
      setUsers(data || []);
    }
    setLoading(false);
  };

  const filterUsers = () => {
    if (!searchQuery.trim()) {
      setFilteredUsers(users);
      return;
    }

    const query = searchQuery.toLowerCase();
    const filtered = users.filter(
      (user) =>
        user.name.toLowerCase().includes(query) ||
        user.surname.toLowerCase().includes(query) ||
        user.department.toLowerCase().includes(query) ||
        user.global_role.toLowerCase().includes(query)
    );
    setFilteredUsers(filtered);
  };

  const handleToggleStatus = async () => {
    if (!selectedUser) return;

    const newStatus = alertAction === "activate";
    const { error } = await supabase
      .from("profiles")
      .update({ is_active: newStatus })
      .eq("id", selectedUser.id);

    if (error) {
      toast({ title: t("common.error"), description: error.message, variant: "destructive" });
    } else {
      toast({
        title: t("common.success"),
        description: newStatus ? t("admin.userActivated") : t("admin.userDeactivated"),
      });
      fetchUsers();
    }

    setAlertOpen(false);
    setSelectedUser(null);
  };

  const handleEditClick = (user: any) => {
    setSelectedUser(user);
    setDialogOpen(true);
  };

  const handleAddClick = () => {
    setSelectedUser(null);
    setDialogOpen(true);
  };

  const handleStatusClick = (user: any, action: "activate" | "deactivate") => {
    setSelectedUser(user);
    setAlertAction(action);
    setAlertOpen(true);
  };

  const activeUsersCount = users.filter((u) => u.is_active).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t("admin.title")}</h1>
          <p className="text-muted-foreground mt-1">{t("admin.manageUsers")}</p>
        </div>
        <Button onClick={handleAddClick}>
          <Plus className="h-4 w-4 mr-2" />
          {t("admin.addUser")}
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">{t("admin.totalUsers")}</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{users.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">{t("admin.activeUsers")}</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeUsersCount}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">{t("admin.inactive")}</CardTitle>
            <Ban className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{users.length - activeUsersCount}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search users..."
                className="pl-8"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {searchQuery ? "No users found matching your search." : t("admin.users")}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("auth.name")}</TableHead>
                  <TableHead>{t("admin.department")}</TableHead>
                  <TableHead>{t("admin.role")}</TableHead>
                  <TableHead>{t("admin.status")}</TableHead>
                  <TableHead>{t("admin.lastUpdated")}</TableHead>
                  <TableHead className="text-right">{t("admin.actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium">
                      <div>
                        <p>
                          {user.name} {user.surname}
                        </p>
                        {user.title && (
                          <p className="text-xs text-muted-foreground">{user.title}</p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{t(`departments.${user.department}`)}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge>{t(`roles.${user.global_role}`)}</Badge>
                    </TableCell>
                    <TableCell>
                      {user.is_active ? (
                        <Badge variant="default" className="bg-success">
                          {t("admin.active")}
                        </Badge>
                      ) : (
                        <Badge variant="destructive">{t("admin.inactive")}</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {format(new Date(user.updated_at), "MMM dd, yyyy")}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEditClick(user)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        {user.is_active ? (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleStatusClick(user, "deactivate")}
                          >
                            <Ban className="h-4 w-4" />
                          </Button>
                        ) : (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleStatusClick(user, "activate")}
                          >
                            <CheckCircle className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <UserDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        user={selectedUser}
        onSuccess={fetchUsers}
      />

      <AlertDialog open={alertOpen} onOpenChange={setAlertOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {alertAction === "deactivate" ? t("admin.deactivate") : t("admin.activate")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {alertAction === "deactivate"
                ? t("admin.confirmDeactivate")
                : t("admin.confirmActivate")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("tasks.cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={handleToggleStatus}>
              {t("common.confirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Admin;
