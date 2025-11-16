import { useState, useEffect } from "react";
import { Upload, Download, Trash2, FileIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import { useTranslation } from "react-i18next";
import { Tables } from "@/integrations/supabase/types";
import { formatDistanceToNow } from "@/lib/dateUtils";

type Attachment = Tables<"attachments"> & {
  uploader: Tables<"profiles">;
};

interface AttachmentSectionProps {
  taskId: string;
}

export const AttachmentSection = ({ taskId }: AttachmentSectionProps) => {
  const { user, profile } = useAuth();
  const { t } = useTranslation();
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  useEffect(() => {
    fetchAttachments();
  }, [taskId]);

  const fetchAttachments = async () => {
    const { data, error } = await supabase
      .from("attachments")
      .select("*, uploader:profiles!attachments_uploaded_by_fkey(*)")
      .eq("task_id", taskId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching attachments:", error);
      return;
    }

    setAttachments(data as Attachment[]);
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !user) return;

    setUploading(true);
    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `${user.id}/${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("task-attachments")
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      // Store the private file path, not a public URL
      const { error: dbError } = await supabase.from("attachments").insert({
        task_id: taskId,
        file_name: file.name,
        file_url: fileName, // Store private path
        file_type: file.type,
        file_size: file.size,
        uploaded_by: user.id,
      });

      if (dbError) throw dbError;

      toast({
        title: t("common.success"),
        description: t("tasks.fileUploaded"),
      });

      fetchAttachments();
    } catch (error: any) {
      toast({
        title: t("common.error"),
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setUploading(false);
      event.target.value = "";
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;

    const attachment = attachments.find((a) => a.id === deleteId);
    if (!attachment) return;

    try {
      // Delete from storage using the stored file path
      const { error: storageError } = await supabase.storage
        .from("task-attachments")
        .remove([attachment.file_url]);

      if (storageError) throw storageError;

      const { error: dbError } = await supabase
        .from("attachments")
        .delete()
        .eq("id", deleteId);

      if (dbError) throw dbError;

      toast({
        title: t("common.success"),
        description: t("tasks.fileDeleted"),
      });

      fetchAttachments();
    } catch (error: any) {
      toast({
        title: t("common.error"),
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setDeleteId(null);
    }
  };

  const handleDownload = async (attachment: Attachment) => {
    try {
      // Generate a signed URL valid for 60 seconds
      const { data, error } = await supabase.storage
        .from("task-attachments")
        .createSignedUrl(attachment.file_url, 60);
      
      if (error) throw error;
      if (!data?.signedUrl) throw new Error("Failed to generate download URL");
      
      // Download using the signed URL
      const response = await fetch(data.signedUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = attachment.file_name;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error: any) {
      toast({
        title: t("common.error"),
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return "Unknown";
    const sizes = ["Bytes", "KB", "MB", "GB"];
    if (bytes === 0) return "0 Bytes";
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round((bytes / Math.pow(1024, i)) * 100) / 100 + " " + sizes[i];
  };

  const canDelete = (attachment: Attachment) => {
    return (
      attachment.uploaded_by === user?.id ||
      profile?.global_role === "Admin" ||
      profile?.global_role === "Manager"
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          {t("tasks.attachments")}
          <label htmlFor="file-upload">
            <Button variant="outline" size="sm" disabled={uploading} asChild>
              <span className="cursor-pointer">
                <Upload className="h-4 w-4 mr-2" />
                {uploading ? t("common.uploading") : t("tasks.uploadFile")}
              </span>
            </Button>
          </label>
          <input
            id="file-upload"
            type="file"
            className="hidden"
            onChange={handleFileUpload}
            disabled={uploading}
          />
        </CardTitle>
      </CardHeader>
      <CardContent>
        {attachments.length === 0 ? (
          <p className="text-center text-muted-foreground py-4">
            {t("tasks.noAttachments")}
          </p>
        ) : (
          <div className="space-y-2">
            {attachments.map((attachment) => (
              <div
                key={attachment.id}
                className="flex items-center justify-between p-3 rounded-lg border"
              >
                <div className="flex items-center gap-3 flex-1">
                  <FileIcon className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="font-medium">{attachment.file_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatFileSize(attachment.file_size)} •{" "}
                      {attachment.uploader.name} {attachment.uploader.surname} •{" "}
                      {formatDistanceToNow(new Date(attachment.created_at), {
                        addSuffix: true,
                      })}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDownload(attachment)}
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                  {canDelete(attachment) && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setDeleteId(attachment.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("tasks.deleteAttachment")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("tasks.deleteAttachmentConfirm")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>
              {t("common.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
};
