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
          // Generate a placeholder title indicating this needs AI regeneration
          const placeholderTitle = `[À générer] ${article.category || article.title}`;
          const nextSlug = `${(article.category || "article").toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${nextDate.getTime()}`;

          const { data: newArticle, error: insertError } = await supabase.from("articles").insert({
            site_id: article.site_id,
            title: placeholderTitle,
            slug: nextSlug,
            content: null,
            excerpt: null,
            image_url: null,
            mode: article.mode,
            status: "scheduled",
            scheduled_at: nextDate.toISOString(),
            frequency: article.frequency,
            category: article.category,
            instructions: article.instructions,
            tone: article.tone,
            keywords: article.keywords,
          }).select().single();

          if (insertError) {
            console.error(`Error creating next occurrence for ${article.id}:`, insertError);
          } else if (newArticle) {
            console.log(`Next occurrence scheduled for ${nextDate.toISOString()}, triggering AI generation...`);

            // Get site info for AI generation
            const { data: siteInfo } = await supabase
              .from("sites")
              .select("name, niche, description, url")
              .eq("id", article.site_id)
              .single();

            if (siteInfo) {
              // Trigger AI article generation for the new occurrence
              try {
                const genResp = await fetch(`${supabaseUrl}/functions/v1/generate-article`, {
                  method: "POST",
                  headers: {
                    Authorization: `Bearer ${serviceRoleKey}`,
                    "Content-Type": "application/json",
                  },
                  body: JSON.stringify({
                    mode: "auto",
                    siteName: siteInfo.name,
                    siteNiche: siteInfo.niche || "",
                    siteDescription: siteInfo.description || "",
                    siteUrl: siteInfo.url || "",
                    category: article.category || "",
                    topic: `Un nouveau sujet pertinent dans la catégorie "${article.category || siteInfo.niche || "blog"}" — différent de "${article.title}"`,
                  }),
                });

                if (genResp.ok && genResp.body) {
                  const reader = genResp.body.getReader();
                  const decoder = new TextDecoder();
                  let fullText = "";
                  while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;
                    const chunk = decoder.decode(value, { stream: true });
                    for (const line of chunk.split("\n")) {
                      if (!line.startsWith("data: ")) continue;
                      const jsonStr = line.slice(6).trim();
                      if (jsonStr === "[DONE]") continue;
                      try {
                        const p = JSON.parse(jsonStr);
                        const c = p.choices?.[0]?.delta?.content;
                        if (c) fullText += c;
                      } catch {}
                    }
                  }

                  const titleMatch = fullText.match(/TITRE:\s*(.+)/);
                  const excerptMatch = fullText.match(/EXTRAIT:\s*(.+)/);
                  const contentMatch = fullText.match(/CONTENU:\s*([\s\S]*)/);

                  const genUpdate: Record<string, string> = {};
                  if (titleMatch?.[1]) genUpdate.title = titleMatch[1].trim();
                  if (excerptMatch?.[1]) genUpdate.excerpt = excerptMatch[1].trim();
                  if (contentMatch?.[1]) genUpdate.content = contentMatch[1].trim();

                  // Update slug based on new title
                  if (genUpdate.title) {
                    genUpdate.slug = genUpdate.title
                      .toLowerCase()
                      .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
                      .replace(/[^a-z0-9]+/g, "-")
                      .replace(/(^-|-$)/g, "") + `-${nextDate.getTime()}`;
                  }

                  if (Object.keys(genUpdate).length > 0) {
                    await supabase.from("articles").update(genUpdate).eq("id", newArticle.id);
                    console.log(`AI generated new article: "${genUpdate.title || placeholderTitle}"`);
                  }

                  // Trigger image generation
                  try {
                    await fetch(`${supabaseUrl}/functions/v1/generate-article-image`, {
                      method: "POST",
                      headers: {
                        Authorization: `Bearer ${serviceRoleKey}`,
                        "Content-Type": "application/json",
                      },
                      body: JSON.stringify({
                        articleId: newArticle.id,
                        title: genUpdate.title || placeholderTitle,
                        category: article.category || "",
                        siteName: siteInfo.name,
                      }),
                    });
                    console.log(`Image generation triggered for ${newArticle.id}`);
                  } catch (imgErr) {
                    console.error(`Image generation failed for ${newArticle.id}:`, imgErr);
                  }
                }
              } catch (genErr) {
                console.error(`AI generation failed for next occurrence:`, genErr);
              }
            }
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
