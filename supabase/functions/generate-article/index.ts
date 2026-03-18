import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { mode, siteName, siteNiche, siteDescription, title, instructions, tone, keywords, category } = await req.json();

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    let systemPrompt: string;
    let userPrompt: string;

    if (mode === "auto") {
      systemPrompt = `Tu es un rédacteur web professionnel spécialisé en SEO et content marketing. Tu rédiges des articles de blog complets, engageants et optimisés pour le référencement. Tu écris en français sauf indication contraire. Tu retournes le contenu en HTML structuré avec des balises h2, h3, p, ul, li, strong, em. Ne mets PAS de balise h1 — le titre sera ajouté séparément.`;
      
      userPrompt = `Génère un article de blog complet pour le site "${siteName}".
Niche/domaine : ${siteNiche || "général"}
Description du site : ${siteDescription || "non fournie"}
${category ? `Catégorie : ${category}` : ""}

L'article doit :
- Avoir un titre accrocheur (retourne-le sur la première ligne, préfixé par "TITRE: ")
- Faire environ 800-1200 mots
- Être optimisé SEO avec des sous-titres pertinents
- Inclure une introduction engageante et une conclusion
- Être pertinent pour la niche du site
- Retourner aussi un extrait de 2 phrases (préfixé par "EXTRAIT: " sur une ligne séparée après le titre)

Format de réponse :
TITRE: [titre de l'article]
EXTRAIT: [extrait de 2 phrases]
CONTENU:
[contenu HTML de l'article]`;
    } else {
      systemPrompt = `Tu es un rédacteur web professionnel. Tu rédiges des articles de blog sur mesure selon les instructions fournies. Tu écris en français sauf indication contraire. Tu retournes le contenu en HTML structuré avec des balises h2, h3, p, ul, li, strong, em. Ne mets PAS de balise h1.`;

      userPrompt = `Rédige un article de blog pour le site "${siteName}".
${title ? `Sujet/Titre souhaité : ${title}` : ""}
${instructions ? `Instructions : ${instructions}` : ""}
${tone ? `Ton souhaité : ${tone}` : ""}
${keywords ? `Mots-clés cibles : ${keywords}` : ""}
${category ? `Catégorie : ${category}` : ""}

L'article doit :
- Faire environ 800-1200 mots
- Être optimisé SEO
- Inclure une introduction et une conclusion
- Si aucun titre n'est fourni, en proposer un accrocheur
- Retourner aussi un extrait de 2 phrases

Format de réponse :
TITRE: [titre de l'article]
EXTRAIT: [extrait de 2 phrases]
CONTENU:
[contenu HTML de l'article]`;
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Limite de requêtes atteinte. Réessayez dans quelques instants." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Crédits IA épuisés. Ajoutez des crédits dans les paramètres." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "Erreur du service IA" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("generate-article error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erreur inconnue" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
