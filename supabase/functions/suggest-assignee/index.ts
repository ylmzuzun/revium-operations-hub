import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Input validation schema
const requestSchema = z.object({
  taskTitle: z.string().min(1, "Task title is required").max(200, "Task title too long"),
  taskDescription: z.string().max(2000, "Description too long").optional(),
  skillTags: z.array(z.string().max(50)).max(10, "Too many skill tags").optional(),
  department: z.string().max(50, "Department name too long").optional(),
});

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    
    // Validate input
    const validation = requestSchema.safeParse(body);
    if (!validation.success) {
      return new Response(
        JSON.stringify({ 
          error: "Invalid request parameters", 
          details: validation.error.errors 
        }), 
        { 
          status: 400, 
          headers: { ...corsHeaders, "Content-Type": "application/json" } 
        }
      );
    }
    
    const { taskTitle, taskDescription, skillTags, department } = validation.data;

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY")!;

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch all active users with their profiles
    const { data: users, error: usersError } = await supabase
      .from("profiles")
      .select("id, name, surname, department, skills, global_role")
      .eq("is_active", true);

    if (usersError) throw usersError;

    // Build a prompt for AI to suggest assignees
    const prompt = `You are an AI assistant for a task management system. Your job is to suggest the 3 most suitable users to assign a task to.

Task Details:
- Title: ${taskTitle}
- Description: ${taskDescription || "No description"}
- Required Skills: ${skillTags?.join(", ") || "None specified"}
- Department: ${department || "Not specified"}

Available Users:
${users.map((u, i) => `${i + 1}. ${u.name} ${u.surname}
   - Department: ${u.department}
   - Skills: ${u.skills?.join(", ") || "No skills listed"}
   - Role: ${u.global_role}`).join("\n\n")}

Based on the task requirements and user profiles, suggest the top 3 users who would be best suited for this task. Consider:
1. Skills matching the task requirements
2. Department relevance
3. Role and expertise level

Respond with ONLY a JSON array of user IDs in order of best match, like: ["uuid1", "uuid2", "uuid3"]`;

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${lovableApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: "You are a helpful task assignment assistant. Always respond with valid JSON arrays of user IDs." },
          { role: "user", content: prompt }
        ],
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error("AI API error:", aiResponse.status, errorText);
      
      // Return first 3 users as fallback
      const fallbackSuggestions = users.slice(0, 3).map(u => u.id);
      return new Response(
        JSON.stringify({ suggestions: fallbackSuggestions, usingFallback: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const aiData = await aiResponse.json();
    const aiSuggestion = aiData.choices[0]?.message?.content || "[]";
    
    // Parse the AI response
    let suggestedIds: string[] = [];
    try {
      // Try to extract JSON array from the response
      const jsonMatch = aiSuggestion.match(/\[.*?\]/);
      if (jsonMatch) {
        suggestedIds = JSON.parse(jsonMatch[0]);
      }
    } catch (e) {
      console.error("Failed to parse AI response:", e);
    }

    // Validate and filter to only valid user IDs
    const validIds = suggestedIds.filter(id => users.some(u => u.id === id));
    
    // If we don't have 3 valid suggestions, fill with remaining users
    if (validIds.length < 3) {
      const remainingUsers = users
        .filter(u => !validIds.includes(u.id))
        .slice(0, 3 - validIds.length);
      validIds.push(...remainingUsers.map(u => u.id));
    }

    // Get full user details for the suggestions
    const suggestions = validIds.slice(0, 3).map(id => {
      const user = users.find(u => u.id === id);
      return {
        id: user!.id,
        name: user!.name,
        surname: user!.surname,
        department: user!.department,
        skills: user!.skills,
      };
    });

    return new Response(
      JSON.stringify({ suggestions }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in suggest-assignee function:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
