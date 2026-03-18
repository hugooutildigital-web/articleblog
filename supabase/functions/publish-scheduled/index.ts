import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Find all articles that are scheduled and whose scheduled_at is in the past
    const now = new Date().toISOString();
    const { data: articles, error: fetchError } = await supabase
      .from("articles")
      .select("*")
      .eq("status", "scheduled")
      .lte("scheduled_at", now);

    if (fetchError) {
      console.error("Error fetching scheduled articles:", fetchError);
      throw fetchError;
    }

    if (!articles || articles.length === 0) {
      console.log("No articles to publish at", now);
      return new Response(JSON.stringify({ published: 0, message: "Aucun article à publier" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`Found ${articles.length} article(s) to publish`);

    let publishedCount = 0;

    for (const article of articles) {
      // Get the site info for building the page URL
      const { data: site } = await supabase
        .from("sites")
        .select("url, blog_path")
        .eq("id", article.site_id)
        .single();

      const pageUrl = site
        ? `${site.url.replace(/\/$/, "")}${site.blog_path}/${article.slug}`
        : null;

      // Update the article to published
      const { error: updateError } = await supabase
        .from("articles")
        .update({
          status: "published",
          published_at: now,
          page_url: pageUrl,
        })
        .eq("id", article.id);

      if (updateError) {
        console.error(`Error publishing article ${article.id}:`, updateError);
        continue;
      }

      console.log(`Published: "${article.title}" -> ${pageUrl}`);
      publishedCount++;

      // Handle recurring articles: create the next occurrence
      if (article.frequency && article.frequency !== "once" && article.scheduled_at) {
        const nextDate = computeNextDate(article.scheduled_at, article.frequency);
        if (nextDate) {
          const { error: insertError } = await supabase.from("articles").insert({
            site_id: article.site_id,
            title: article.title,
            slug: article.slug + "-" + nextDate.getTime(),
            content: null, // Will need AI regeneration
            excerpt: null,
            mode: article.mode,
            status: "scheduled",
            scheduled_at: nextDate.toISOString(),
            frequency: article.frequency,
            category: article.category,
            instructions: article.instructions,
            tone: article.tone,
            keywords: article.keywords,
          });

          if (insertError) {
            console.error(`Error creating next occurrence for ${article.id}:`, insertError);
          } else {
            console.log(`Next occurrence scheduled for ${nextDate.toISOString()}`);
          }
        }
      }
    }

    return new Response(
      JSON.stringify({ published: publishedCount, total: articles.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("publish-scheduled error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Erreur inconnue" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

function computeNextDate(currentDateStr: string, frequency: string): Date | null {
  const d = new Date(currentDateStr);
  switch (frequency) {
    case "daily":
      d.setDate(d.getDate() + 1);
      return d;
    case "weekly":
      d.setDate(d.getDate() + 7);
      return d;
    case "biweekly":
      d.setDate(d.getDate() + 14);
      return d;
    case "monthly":
      d.setMonth(d.getMonth() + 1);
      return d;
    default:
      return null;
  }
}
