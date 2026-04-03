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
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const supabase = createClient(supabaseUrl, serviceRoleKey);
    const { articleId } = await req.json();
    if (!articleId) throw new Error("articleId is required");

    // 1. Fetch the placeholder article
    const { data: article, error: artErr } = await supabase
      .from("articles")
      .select("*")
      .eq("id", articleId)
      .single();
    if (artErr || !article) throw new Error("Article not found");

    // 2. Fetch site info
    const { data: site } = await supabase
      .from("sites")
      .select("*")
      .eq("id", article.site_id)
      .single();
    if (!site) throw new Error("Site not found");

    // 3. PRE-VERIFICATION: Fetch all existing articles for this site to avoid repetition
    const { data: existingArticles } = await supabase
      .from("articles")
      .select("title, slug, category, excerpt, keywords")
      .eq("site_id", article.site_id)
      .neq("id", articleId)
      .order("created_at", { ascending: false })
      .limit(50);

    const existingTitles = (existingArticles || []).map(a => a.title).join("\n- ");
    const existingKeywords = (existingArticles || [])
      .flatMap(a => a.keywords || [])
      .filter(Boolean);
    const uniqueKeywords = [...new Set(existingKeywords)].join(", ");

    console.log(`[Autopilot] Site: ${site.name} | Existing articles: ${existingArticles?.length || 0}`);

    // ──────────────────────────────────────
    // PHASE 1: Generate a unique topic
    // ──────────────────────────────────────
    const topicPrompt = `Tu es un expert en stratégie de contenu SEO local. Tu dois proposer UN SEUL sujet d'article de blog pour l'entreprise "${site.name}"${site.city ? ` située à "${site.city}"` : ""}.

Informations sur l'entreprise :
- Nom : "${site.name}"
- Description : "${site.description || ""}"
- Niche : "${site.niche || ""}"
- URL : "${site.url || ""}"
${site.city ? `- Ville : "${site.city}"` : ""}
${article.category ? `- Catégorie cible : "${article.category}"` : ""}

ARTICLES DÉJÀ PUBLIÉS (à NE PAS répéter ni reformuler) :
${existingTitles ? `- ${existingTitles}` : "(aucun article existant)"}

Mots-clés déjà couverts : ${uniqueKeywords || "(aucun)"}

RÈGLES :
- Le sujet doit être RADICALEMENT différent de tous les articles existants
- Pas de reformulation d'un sujet existant
- Orienté SEO local, concret, engageant
- Entre 8 et 14 mots
- Formulation de titre d'article accrocheur
- Si une catégorie est spécifiée, rester dans cette thématique

Retourne UNIQUEMENT le sujet, sans guillemets, sans explication.`;

    const topicResp = await callAI(LOVABLE_API_KEY, topicPrompt, "Génère un sujet unique");
    const topic = topicResp.trim().replace(/^["']|["']$/g, "");
    console.log(`[Autopilot] Topic generated: "${topic}"`);

    // ──────────────────────────────────────
    // PHASE 2: Generate the article
    // ──────────────────────────────────────
    const articlePrompt = `Tu es un expert en rédaction web et en référencement local. Rédige un article de blog pour "${site.name}".

Informations entreprise :
- Nom : "${site.name}"
- Description : "${site.description || ""}"
- Niche : "${site.niche || ""}"
- URL : "${site.url || ""}"
${article.category ? `- Catégorie : "${article.category}"` : ""}
${article.tone ? `- Ton souhaité : "${article.tone}"` : ""}
${article.instructions ? `- Instructions spéciales : "${article.instructions}"` : ""}

SUJET À TRAITER : "${topic}"

ARTICLES EXISTANTS (contexte pour éviter les répétitions) :
${existingTitles ? `- ${existingTitles}` : "(premier article)"}

RÈGLES :
- 800 à 1200 mots
- HTML structuré (h2, h3, p, ul, ol, li, strong, em) — PAS de h1
- Ton naturel, humain, expert du terrain
- Optimisé SEO local
- Commencer par un angle humain ou une problématique concrète
- 3 à 5 sections H2, transitions fluides
- Conclusion avec appel à l'action implicite
- Aucun numéro de téléphone, email, tarif
- NE PAS reprendre le contenu des articles existants

Format STRICT :
TITRE: [titre optimisé SEO]
EXTRAIT: [meta description 150-160 caractères]
CONTENU:
[HTML de l'article]`;

    const articleRaw = await callAI(LOVABLE_API_KEY, articlePrompt, "Rédige l'article");
    const parsed = parseContent(articleRaw);
    console.log(`[Autopilot] Article generated: "${parsed.title}"`);

    // ──────────────────────────────────────
    // PHASE 3: POST-VERIFICATION — quality & uniqueness check
    // ──────────────────────────────────────
    const verifyPrompt = `Tu es un vérificateur qualité d'articles de blog. Analyse cet article et signale les problèmes.

TITRE : "${parsed.title}"
EXTRAIT : "${parsed.excerpt}"
CONTENU (premiers 500 car.) : "${parsed.content.substring(0, 500)}"

ARTICLES EXISTANTS DU MÊME SITE :
${existingTitles ? `- ${existingTitles}` : "(aucun)"}

Vérifie :
1. Le titre est-il trop similaire à un article existant ? (reformulation = similaire)
2. Le contenu semble-t-il naturel et humain ?
3. Le contenu est-il suffisamment long (800+ mots) ?
4. La structure HTML est-elle correcte (h2, h3, p) ?
5. Y a-t-il des informations inventées, des numéros de téléphone, des emails ou des tarifs ?
6. L'extrait fait-il entre 150 et 160 caractères ?

Réponds au format STRICT :
SCORE: [1 à 10]
PROBLEMES: [liste séparée par | ou "aucun"]
TITRE_SUGGESTION: [nouveau titre si l'actuel est trop similaire, sinon "ok"]
EXTRAIT_SUGGESTION: [nouvel extrait si trop court/long, sinon "ok"]`;

    const verifyRaw = await callAI(LOVABLE_API_KEY, verifyPrompt, "Vérifie la qualité");
    const verification = parseVerification(verifyRaw);
    console.log(`[Autopilot] Verification score: ${verification.score}/10 | Problems: ${verification.problems}`);

    // ──────────────────────────────────────
    // PHASE 4: AUTO-CORRECTION if needed
    // ──────────────────────────────────────
    let finalTitle = parsed.title;
    let finalExcerpt = parsed.excerpt;
    let finalContent = parsed.content;

    if (verification.score < 7) {
      console.log(`[Autopilot] Score too low (${verification.score}), auto-correcting...`);

      const correctPrompt = `Tu es un correcteur d'articles de blog. Corrige cet article en tenant compte des problèmes détectés.

PROBLÈMES DÉTECTÉS : ${verification.problems}

ARTICLE ORIGINAL :
TITRE: ${parsed.title}
EXTRAIT: ${parsed.excerpt}
CONTENU:
${parsed.content}

${verification.titleSuggestion !== "ok" ? `SUGGESTION DE TITRE : ${verification.titleSuggestion}` : ""}
${verification.excerptSuggestion !== "ok" ? `SUGGESTION D'EXTRAIT : ${verification.excerptSuggestion}` : ""}

Corrige les problèmes identifiés tout en gardant le même sujet et la même structure.
Retourne le résultat au format STRICT :
TITRE: [titre corrigé]
EXTRAIT: [extrait corrigé]
CONTENU:
[HTML corrigé de l'article complet]`;

      const correctedRaw = await callAI(LOVABLE_API_KEY, correctPrompt, "Corrige l'article");
      const corrected = parseContent(correctedRaw);

      if (corrected.title) finalTitle = corrected.title;
      if (corrected.excerpt) finalExcerpt = corrected.excerpt;
      if (corrected.content && corrected.content.length > 200) finalContent = corrected.content;

      console.log(`[Autopilot] Article corrected: "${finalTitle}"`);
    } else {
      // Apply minor suggestions even if score is good
      if (verification.titleSuggestion && verification.titleSuggestion !== "ok") {
        finalTitle = verification.titleSuggestion;
      }
      if (verification.excerptSuggestion && verification.excerptSuggestion !== "ok") {
        finalExcerpt = verification.excerptSuggestion;
      }
    }

    // ──────────────────────────────────────
    // PHASE 5: Save the generated article
    // ──────────────────────────────────────
    const slug = slugify(finalTitle);
    const pageUrl = `${site.url.replace(/\/$/, "")}${site.blog_path}/${slug}`;

    const { error: updateErr } = await supabase
      .from("articles")
      .update({
        title: finalTitle,
        slug,
        content: finalContent,
        excerpt: finalExcerpt,
        status: "scheduled", // stays scheduled until publish-scheduled publishes it
        page_url: pageUrl,
      })
      .eq("id", articleId);

    if (updateErr) throw updateErr;

    // Generate image
    try {
      await fetch(`${supabaseUrl}/functions/v1/generate-article-image`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${serviceRoleKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          articleId,
          title: finalTitle,
          category: article.category || "",
          siteName: site.name,
          siteCity: site.city || "",
        }),
      });
      console.log(`[Autopilot] Image generation triggered`);
    } catch (imgErr) {
      console.error(`[Autopilot] Image generation failed:`, imgErr);
    }

    console.log(`[Autopilot] ✅ Pipeline complete for "${finalTitle}"`);

    return new Response(JSON.stringify({
      success: true,
      articleId,
      title: finalTitle,
      score: verification.score,
      corrected: verification.score < 7,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[Autopilot] Error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erreur inconnue" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

// ── Helpers ──

async function callAI(apiKey: string, prompt: string, task: string): Promise<string> {
  console.log(`[Autopilot AI] ${task}...`);
  const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-3-flash-preview",
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!resp.ok) {
    const t = await resp.text();
    console.error(`[Autopilot AI] Error ${resp.status}:`, t);
    throw new Error(`AI error ${resp.status}: ${t}`);
  }

  const data = await resp.json();
  return data.choices?.[0]?.message?.content || "";
}

function parseContent(raw: string) {
  const titleMatch = raw.match(/TITRE:\s*(.+)/);
  const excerptMatch = raw.match(/EXTRAIT:\s*(.+)/);
  const contentMatch = raw.match(/CONTENU:\s*([\s\S]*)/);
  return {
    title: titleMatch?.[1]?.trim() || "",
    excerpt: excerptMatch?.[1]?.trim() || "",
    content: contentMatch?.[1]?.trim() || raw,
  };
}

function parseVerification(raw: string) {
  const scoreMatch = raw.match(/SCORE:\s*(\d+)/);
  const problemsMatch = raw.match(/PROBLEMES:\s*(.+)/);
  const titleMatch = raw.match(/TITRE_SUGGESTION:\s*(.+)/);
  const excerptMatch = raw.match(/EXTRAIT_SUGGESTION:\s*(.+)/);
  return {
    score: parseInt(scoreMatch?.[1] || "7"),
    problems: problemsMatch?.[1]?.trim() || "aucun",
    titleSuggestion: titleMatch?.[1]?.trim() || "ok",
    excerptSuggestion: excerptMatch?.[1]?.trim() || "ok",
  };
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}
