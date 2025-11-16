import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.81.1";
import { Resend } from "https://esm.sh/resend@4.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));
const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface TaskAssignedEmailRequest {
  task_id: string;
  assignee_id: string;
  created_by: string;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { task_id, assignee_id, created_by }: TaskAssignedEmailRequest = await req.json();
    
    console.log("Processing task assignment email:", { task_id, assignee_id, created_by });

    // Initialize Supabase client with service role key
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get assignee email and profile
    const { data: assigneeAuth } = await supabase.auth.admin.getUserById(assignee_id);
    const { data: assigneeProfile } = await supabase
      .from("profiles")
      .select("name, surname")
      .eq("id", assignee_id)
      .single();

    if (!assigneeAuth?.user?.email) {
      console.error("Assignee email not found");
      return new Response(JSON.stringify({ error: "Assignee email not found" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get creator profile
    const { data: creatorProfile } = await supabase
      .from("profiles")
      .select("name, surname")
      .eq("id", created_by)
      .single();

    // Get task details
    const { data: task } = await supabase
      .from("tasks")
      .select(`
        *,
        projects (name)
      `)
      .eq("id", task_id)
      .single();

    if (!task) {
      console.error("Task not found");
      return new Response(JSON.stringify({ error: "Task not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const creatorName = creatorProfile ? `${creatorProfile.name} ${creatorProfile.surname}` : "Team Member";
    const assigneeName = assigneeProfile ? `${assigneeProfile.name} ${assigneeProfile.surname}` : "User";
    const projectName = task.projects?.name || "No Project";
    const dueDate = task.due_date ? new Date(task.due_date).toLocaleDateString("tr-TR") : "Yok";
    
    // Task detail link
    const taskLink = `${Deno.env.get("SUPABASE_URL")?.replace(".supabase.co", ".lovable.app")}/tasks/${task_id}`;

    // Prepare email content
    const emailHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f4f4f4; }
    .container { max-width: 600px; margin: 20px auto; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px 20px; text-align: center; }
    .header h1 { margin: 0; font-size: 24px; }
    .content { padding: 30px 20px; }
    .task-info { background: #f8f9fa; border-left: 4px solid #667eea; padding: 15px; margin: 20px 0; border-radius: 4px; }
    .task-info h2 { margin: 0 0 10px 0; font-size: 18px; color: #667eea; }
    .task-info p { margin: 8px 0; color: #666; }
    .task-info strong { color: #333; }
    .cta-button { display: inline-block; background: #667eea; color: white !important; text-decoration: none; padding: 12px 30px; border-radius: 6px; margin: 20px 0; font-weight: 600; }
    .cta-button:hover { background: #5568d3; }
    .footer { background: #f8f9fa; padding: 20px; text-align: center; font-size: 12px; color: #666; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🎯 Yeni Görev Atandı</h1>
    </div>
    <div class="content">
      <p>Merhaba ${assigneeName},</p>
      <p><strong>${creatorName}</strong> size yeni bir görev atadı.</p>
      
      <div class="task-info">
        <h2>${task.title}</h2>
        ${task.description ? `<p>${task.description}</p>` : ''}
        <p><strong>Proje:</strong> ${projectName}</p>
        <p><strong>Öncelik:</strong> ${task.priority}</p>
        <p><strong>Durum:</strong> ${task.status}</p>
        <p><strong>Bitiş Tarihi:</strong> ${dueDate}</p>
      </div>

      <center>
        <a href="${taskLink}" class="cta-button">Görevi Görüntüle →</a>
      </center>

      <p style="margin-top: 30px; color: #666; font-size: 14px;">
        Bu email otomatik olarak gönderilmiştir. Görev yönetim sisteminiz üzerinden size atanan bir görev hakkında bilgilendirme amaçlıdır.
      </p>
    </div>
    <div class="footer">
      <p>© 2025 Task Management System</p>
      <p>Bu email'i almak istemiyorsanız, bildirim ayarlarınızı güncelleyebilirsiniz.</p>
    </div>
  </div>
</body>
</html>
    `;

    // Send email
    const emailResponse = await resend.emails.send({
      from: "Task Management <onboarding@resend.dev>",
      to: [assigneeAuth.user.email],
      subject: `Yeni Görev: ${task.title}`,
      html: emailHtml,
    });

    console.log("Email sent successfully:", emailResponse);

    return new Response(JSON.stringify({ success: true, emailResponse }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });
  } catch (error: any) {
    console.error("Error in send-task-assigned-email function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
