import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { siteId, siteName, siteNiche, siteCity, siteDescription, siteUrl } = await req.json();
    if (!siteId) throw new Error("siteId is required");

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) throw new Error("Supabase env not configured");

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Fetch all scheduled articles for this site
    const { data: articles, error } = await supabase
      .from("articles")
      .select("id, title, excerpt, content, category, keywords, status")
      .eq("site_id", siteId)
      .eq("status", "scheduled")
      .order("scheduled_at", { ascending: true });

    if (error) throw new Error(`DB error: ${error.message}`);
    if (!articles || articles.length === 0) {
      return new Response(JSON.stringify({ message: "Aucun article planifié à vérifier.", fixes: [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Build a summary of all articles for the AI to analyze
    const articlesSummary = articles.map((a, i) => {
      // Extract first ~500 chars of content for analysis without sending entire HTML
      const contentPreview = (a.content || "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim().slice(0, 600);
      return `[ARTICLE ${i + 1}] ID: ${a.id}
Titre: ${a.title}
Extrait: ${a.excerpt || "N/A"}
Catégorie: ${a.category || "N/A"}
Aperçu contenu: ${contentPreview}...`;
    }).join("\n\n---\n\n");

    const systemPrompt = `Tu es un expert en stratégie de contenu et SEO. On te donne une liste d'articles de blog planifiés pour le site "${siteName}"${siteCity ? ` à ${siteCity}` : ""} (${siteNiche || "activité locale"}).

Ton rôle est d'analyser l'ENSEMBLE des articles et d'identifier :
1. Les articles qui se répètent trop (même sujet, même angle, mêmes arguments)
2. Les problèmes de structure SEO (H1/H2/H3 manquants ou mal utilisés)
3. Les meta descriptions trop courtes/longues ou non optimisées
4. Les titres trop similaires ou non accrocheurs
5. Le manque de diversité dans les angles et formats

Pour chaque problème trouvé, tu dois proposer une correction concrète.

IMPORTANT: Si un article est trop similaire à un autre, tu dois proposer un NOUVEAU sujet et rédiger un NOUVEL article complet (en HTML avec h2, h3, p, ul, etc.) qui le remplace.

Tu dois aussi vérifier que chaque article a :
- Un contenu qui commence par un angle humain/local (pas une liste)
- Des balises H2 et H3 bien structurées
- Un contenu entre 800 et 1200 mots
- Pas de contenu générique ou bateau

Format de sortie STRICT en JSON :
{
  "summary": "Résumé global de l'analyse (2-3 phrases)",
  "issues_count": number,
  "fixes": [
    {
      "article_id": "uuid",
      "article_title": "titre actuel",
      "issue": "description du problème",
      "action": "replace_content" | "replace_title" | "replace_excerpt" | "regenerate",
      "new_title": "nouveau titre si action = replace_title ou regenerate",
      "new_excerpt": "nouvel extrait si action = replace_excerpt ou regenerate",
      "new_content": "nouveau contenu HTML complet si action = replace_content ou regenerate"
    }
  ]
}

Si tout est correct, retourne fixes = [] avec un summary positif.`;

    const userPrompt = `Voici les ${articles.length} articles planifiés à vérifier :

${articlesSummary}

Informations sur l'entreprise :
Nom : "${siteName}"
${siteCity ? `Ville : "${siteCity}"` : ""}
${siteNiche ? `Niche : "${siteNiche}"` : ""}
${siteDescription ? `Description : "${siteDescription}"` : ""}
${siteUrl ? `Site : "${siteUrl}"` : ""}

Analyse l'ensemble, identifie les problèmes et propose les corrections nécessaires. Retourne UNIQUEMENT du JSON valide.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Limite de requêtes atteinte. Réessayez dans quelques instants." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Crédits IA épuisés." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI error:", response.status, t);
      throw new Error("Erreur du service IA");
    }

    const aiData = await response.json();
    const rawContent = aiData.choices?.[0]?.message?.content || "";

    // Parse JSON from AI response (handle markdown code blocks)
    let analysisResult;
    try {
      const jsonMatch = rawContent.match(/```(?:json)?\s*([\s\S]*?)```/) || [null, rawContent];
      analysisResult = JSON.parse(jsonMatch[1]!.trim());
    } catch {
      console.error("Failed to parse AI response:", rawContent);
      return new Response(JSON.stringify({
        summary: "L'analyse a été effectuée mais le format de réponse est incorrect. Réessayez.",
        issues_count: 0,
        fixes: [],
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Apply fixes directly to the database
    const appliedFixes: string[] = [];
    const fixes = analysisResult.fixes || [];

    for (const fix of fixes) {
      if (!fix.article_id) continue;

      const updateData: Record<string, string> = {};
      if (fix.action === "regenerate" || fix.action === "replace_content") {
        if (fix.new_content) updateData.content = fix.new_content;
        if (fix.new_title) updateData.title = fix.new_title;
        if (fix.new_excerpt) updateData.excerpt = fix.new_excerpt;
      } else if (fix.action === "replace_title" && fix.new_title) {
        updateData.title = fix.new_title;
      } else if (fix.action === "replace_excerpt" && fix.new_excerpt) {
        updateData.excerpt = fix.new_excerpt;
      }

      if (Object.keys(updateData).length > 0) {
        const { error: updateError } = await supabase
          .from("articles")
          .update(updateData)
          .eq("id", fix.article_id);

        if (updateError) {
          console.error(`Failed to update article ${fix.article_id}:`, updateError);
        } else {
          appliedFixes.push(fix.article_title || fix.article_id);
        }
      }
    }

    // For articles that need full regeneration, call generate-article
    for (const fix of fixes) {
      if (fix.action !== "regenerate" || fix.new_content) continue;
      // If regenerate but no new_content provided, trigger article generation
      const newTopic = fix.new_title || "un nouveau sujet pertinent";

      try {
        const genResp = await fetch(`${SUPABASE_URL}/functions/v1/generate-article`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            mode: "auto",
            siteName,
            siteNiche: siteNiche || "",
            siteCity: siteCity || "",
            siteDescription: siteDescription || "",
            siteUrl: siteUrl || "",
            topic: newTopic,
          }),
        });

        if (genResp.ok && genResp.body) {
          // Read full streamed response
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

          // Parse generated content
          const titleMatch = fullText.match(/TITRE:\s*(.+)/);
          const excerptMatch = fullText.match(/EXTRAIT:\s*(.+)/);
          const contentMatch = fullText.match(/CONTENU:\s*([\s\S]*)/);

          const genUpdate: Record<string, string> = {};
          if (titleMatch?.[1]) genUpdate.title = titleMatch[1].trim();
          if (excerptMatch?.[1]) genUpdate.excerpt = excerptMatch[1].trim();
          if (contentMatch?.[1]) genUpdate.content = contentMatch[1].trim();

          if (Object.keys(genUpdate).length > 0) {
            await supabase.from("articles").update(genUpdate).eq("id", fix.article_id);
            appliedFixes.push(`${fix.article_title} (régénéré)`);
          }
        }
      } catch (e) {
        console.error(`Regeneration failed for ${fix.article_id}:`, e);
      }
    }

    return new Response(JSON.stringify({
      summary: analysisResult.summary || "Analyse terminée",
      issues_count: analysisResult.issues_count || fixes.length,
      total_articles: articles.length,
      fixes_applied: appliedFixes.length,
      fixes_details: fixes.map((f: any) => ({
        article_title: f.article_title,
        issue: f.issue,
        action: f.action,
        applied: appliedFixes.includes(f.article_title) || appliedFixes.includes(`${f.article_title} (régénéré)`),
      })),
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("verify-articles error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erreur inconnue" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
