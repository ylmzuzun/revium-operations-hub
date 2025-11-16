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

interface MentionEmailRequest {
  comment_id: string;
  task_id: string;
  mentioned_user_id: string;
  author_id: string;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { comment_id, task_id, mentioned_user_id, author_id }: MentionEmailRequest = await req.json();
    
    console.log("Processing mention email:", { comment_id, task_id, mentioned_user_id, author_id });

    // Initialize Supabase client with service role key
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get mentioned user email and profile
    const { data: mentionedUserAuth } = await supabase.auth.admin.getUserById(mentioned_user_id);
    const { data: mentionedUserProfile } = await supabase
      .from("profiles")
      .select("name, surname")
      .eq("id", mentioned_user_id)
      .single();

    if (!mentionedUserAuth?.user?.email) {
      console.error("Mentioned user email not found");
      return new Response(JSON.stringify({ error: "Mentioned user email not found" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get author profile
    const { data: authorProfile } = await supabase
      .from("profiles")
      .select("name, surname")
      .eq("id", author_id)
      .single();

    // Get comment and task details
    const { data: comment } = await supabase
      .from("comments")
      .select("message")
      .eq("id", comment_id)
      .single();

    const { data: task } = await supabase
      .from("tasks")
      .select("title, description")
      .eq("id", task_id)
      .single();

    if (!comment || !task) {
      console.error("Comment or task not found");
      return new Response(JSON.stringify({ error: "Comment or task not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const authorName = authorProfile ? `${authorProfile.name} ${authorProfile.surname}` : "Team Member";
    const mentionedUserName = mentionedUserProfile ? `${mentionedUserProfile.name} ${mentionedUserProfile.surname}` : "User";
    
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
    .header { background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); color: white; padding: 30px 20px; text-align: center; }
    .header h1 { margin: 0; font-size: 24px; }
    .content { padding: 30px 20px; }
    .mention-box { background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0; border-radius: 4px; }
    .mention-box p { margin: 8px 0; }
    .comment-box { background: #f8f9fa; padding: 15px; margin: 20px 0; border-radius: 4px; font-style: italic; }
    .cta-button { display: inline-block; background: #f5576c; color: white !important; text-decoration: none; padding: 12px 30px; border-radius: 6px; margin: 20px 0; font-weight: 600; }
    .cta-button:hover { background: #e04556; }
    .footer { background: #f8f9fa; padding: 20px; text-align: center; font-size: 12px; color: #666; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>💬 Bir Yorumda Bahsedildiniz</h1>
    </div>
    <div class="content">
      <p>Merhaba ${mentionedUserName},</p>
      
      <div class="mention-box">
        <p><strong>${authorName}</strong> sizi bir yorumda bahsetti:</p>
        <p><strong>Görev:</strong> ${task.title}</p>
      </div>

      <div class="comment-box">
        "${comment.message}"
      </div>

      <center>
        <a href="${taskLink}" class="cta-button">Görevi Görüntüle ve Yanıtla →</a>
      </center>

      <p style="margin-top: 30px; color: #666; font-size: 14px;">
        Bu email otomatik olarak gönderilmiştir. Bir görev yorumunda bahsedildiğiniz için size bildirim gönderilmiştir.
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
      to: [mentionedUserAuth.user.email],
      subject: `${authorName} sizi bir yorumda bahsetti: ${task.title}`,
      html: emailHtml,
    });

    console.log("Mention email sent successfully:", emailResponse);

    return new Response(JSON.stringify({ success: true, emailResponse }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });
  } catch (error: any) {
    console.error("Error in send-mention-email function:", error);
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
