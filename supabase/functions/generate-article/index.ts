import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { mode, siteName, siteNiche, siteDescription, siteUrl, siteCity, title, instructions, tone, keywords, category } = await req.json();

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    let systemPrompt: string;
    let userPrompt: string;

    if (mode === "auto") {
      systemPrompt = `Tu es un expert en rédaction web et en référencement local. Ton rôle est de rédiger un article de blog long, naturel et engageant, comme si tu étais un conseiller ou un gérant d'entreprise qui connaît son terrain. Le texte doit refléter un ton humain, empathique, professionnel, sans jamais sembler généré par une IA.

Tu retournes le contenu en HTML structuré avec des balises h2, h3, p, ul, ol, li, strong, em. Ne mets PAS de balise h1 — le titre sera ajouté séparément.

Règles strictes :
- Le texte doit absolument éviter tout style robotique ou générique
- Il doit sembler rédigé par un expert du terrain, qui connaît les problématiques concrètes des clients
- Ton naturel, proche, professionnel mais pas scolaire
- L'article doit partir d'un constat réel, d'un problème vécu, ou d'une mise en situation locale
- Ne commence JAMAIS directement par une liste ou une solution
- Pars toujours d'un angle humain, local ou contextuel
- Sous-titres H2 et H3 clairs, paragraphes bien aérés, transitions fluides
- Intègre naturellement des mots-clés locaux et métier sans forcer
- Ponctuation et orthographe parfaites
- Aucun numéro de téléphone ni email
- Pas de numérotation globale 1), 2), etc.
- Pas d'introduction/conclusion générique ou bateau
- Majuscules uniquement en début de phrase et pour les noms propres
- Pas de promotions directes ni de tarifs
- Optimisé pour le référencement naturel local`;

      userPrompt = `Rédige un article de blog complet pour l'entreprise "${siteName}"${siteCity ? ` dans la ville de "${siteCity}"` : ""}.

${siteNiche ? `Domaine d'activité : ${siteNiche}` : ""}
${siteDescription ? `Description de l'entreprise : ${siteDescription}` : ""}
${siteUrl ? `Site internet : ${siteUrl}` : ""}
${category ? `Catégorie : ${category}` : ""}

L'article doit :
- Avoir un titre H1 accrocheur, optimisé SEO, qui donne envie de lire
- Faire entre 800 et 1200 mots
- Commencer par un angle humain ou une problématique concrète (PAS une liste)
- Contenir 3 à 5 sections avec sous-titres H2, pouvant contenir des sous-sections H3
- Se terminer par une conclusion naturelle avec un appel à l'action implicite vers l'entreprise
- Positionner naturellement l'entreprise comme experte locale de son domaine
- Apporter une vraie valeur informationnelle au lecteur
- Alterner les formats : guide pratique, conseils d'expert, storytelling, cas concret, FAQ développée, article éducatif, retour d'expérience, focus saisonnier, comparatif, coulisses du métier

Format de réponse STRICT :
TITRE: [titre de l'article]
EXTRAIT: [extrait de 2 phrases, 150-160 caractères, optimisé SEO]
CONTENU:
[contenu HTML de l'article]`;
    } else {
      systemPrompt = `Tu es un expert en rédaction web et en référencement local. Tu rédiges des articles de blog sur mesure selon les instructions fournies. Le texte doit refléter un ton humain, empathique, professionnel, sans jamais sembler généré par une IA.

Tu retournes le contenu en HTML structuré avec des balises h2, h3, p, ul, ol, li, strong, em. Ne mets PAS de balise h1.

Règles strictes :
- Ton naturel, proche, professionnel mais pas scolaire
- Sous-titres H2 et H3 clairs, paragraphes bien aérés, transitions fluides
- Intègre naturellement des mots-clés locaux et métier
- Ponctuation et orthographe parfaites
- Aucun numéro de téléphone ni email
- Pas de numérotation globale 1), 2), etc.
- Pas d'introduction/conclusion générique
- Pas de promotions directes ni de tarifs
- Optimisé pour le référencement naturel local`;

      userPrompt = `Rédige un article de blog pour l'entreprise "${siteName}"${siteCity ? ` dans la ville de "${siteCity}"` : ""}.
${title ? `Sujet : ${title}` : ""}
${instructions ? `Instructions : ${instructions}` : ""}
${tone ? `Ton souhaité : ${tone}` : ""}
${keywords ? `Mots-clés cibles : ${keywords}` : ""}
${category ? `Catégorie : ${category}` : ""}
${siteDescription ? `Description de l'entreprise : ${siteDescription}` : ""}
${siteUrl ? `Site internet : ${siteUrl}` : ""}

L'article doit :
- Faire entre 800 et 1200 mots
- Être optimisé SEO local
- Commencer par un angle humain ou une problématique concrète
- Contenir 3 à 5 sections avec sous-titres H2/H3
- Se terminer par un appel à l'action implicite
- Si aucun titre n'est fourni, en proposer un accrocheur et optimisé SEO

Format de réponse STRICT :
TITRE: [titre de l'article]
EXTRAIT: [extrait de 2 phrases, 150-160 caractères, optimisé SEO]
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
        model: "google/gemini-3-flash-preview",
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
