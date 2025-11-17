import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export const useUserRole = () => {
  const { user } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [isManager, setIsManager] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUserRole = async () => {
      if (!user) {
        setIsAdmin(false);
        setIsManager(false);
        setLoading(false);
        return;
      }

      const { data: roles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id);

      if (roles) {
        setIsAdmin(roles.some((r) => r.role === "Admin"));
        setIsManager(roles.some((r) => r.role === "Manager"));
      }
      
      setLoading(false);
    };

    fetchUserRole();
  }, [user]);

  return { isAdmin, isManager, isAdminOrManager: isAdmin || isManager, loading };
};
