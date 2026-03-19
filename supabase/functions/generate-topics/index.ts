import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { count, siteName, siteCity, siteDescription, siteUrl, siteNiche } = await req.json();

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const n = Math.max(1, Math.min(50, parseInt(count) || 5));

    const systemPrompt = `Tu es un expert en stratégie de contenu web et en référencement local. Ton rôle est de proposer des sujets précis, engageants et optimisés SEO pour des articles de blog. Ces sujets doivent être adaptés à une entreprise locale qui veut améliorer sa visibilité sur Google et apporter une vraie valeur informative à ses visiteurs.

Objectifs de la mission :

Générer ${n} sujets d'articles de blog

Chaque sujet doit être concret, clair et centré sur une problématique réelle vécue par les clients ou une question fréquente dans le secteur

Les sujets doivent être variés et couvrir différents formats : guide pratique, conseil expert, comparatif, FAQ développée, article saisonnier, focus sur un service précis, retour d'expérience, sensibilisation à un problème, tendances du secteur, coulisses du métier, etc.

Les sujets doivent être pensés pour le SEO local : intégrer naturellement la ville, la région ou les spécificités géographiques quand c'est pertinent

Le ton doit rester humain, professionnel et proche du quotidien des clients

TRES IMPORTANT :

Génère ${n} sujets EN UNE SEULE FOIS, et chacun doit être RADICALEMENT différent :

Varier les angles, thèmes, formulations, intentions de recherche et approches

Ne pas réutiliser les mêmes tournures ou synonymes évidents

Alterner les intentions SEO (informationnelle, navigationnelle, commerciale, locale)

Alterner les styles (conseil, mise en situation, question fréquente, comparatif, guide étape par étape, focus saisonnier, etc.)

Veiller à la clarté, à la pertinence et au potentiel de référencement de chaque sujet

Contraintes de rédaction :

Chaque sujet doit être formulé comme un titre d'article exploitable et accrocheur (pas un mot-clé seul)

Entre 6 et 12 mots par sujet

Le sujet doit donner envie de cliquer et de lire

Pas de numérotation globale 1), 2), etc.

Les sujets doivent se baser sur la réelle activité de l'entreprise, ses services concrets et son contexte local — aucune invention

Rappels stricts :

Chaque sujet doit être unique et non redondant

Les sujets doivent refléter la vraie activité de l'entreprise

Penser SEO local : ville, région, spécificités du territoire quand pertinent

Sortie au format pipe unique sans texte additionnel`;

    const userPrompt = `Informations sur l'entreprise :

Nom : "${siteName}"
${siteCity ? `Ville : "${siteCity}"` : ""}
${siteDescription ? `Description : "${siteDescription}"` : ""}
${siteUrl ? `Source site internet : "${siteUrl}"` : ""}
${siteNiche ? `Niche / domaine d'activité : "${siteNiche}"` : ""}

Tâche : Proposer ${n} sujets distincts et exploitables pour la rédaction d'articles de blog optimisés SEO, adaptés à l'activité locale de l'entreprise. Ces sujets seront ensuite utilisés pour générer les articles complets — ils doivent donc être suffisamment précis et riches pour permettre la rédaction d'un article de 800 à 1200 mots.

Format de sortie STRICT :

Retourne EXACTEMENT ${n} sujets
Sépare chaque sujet par | (pipe)
Sortie au format pipe unique sans texte additionnel
Aucune introduction, aucune conclusion, aucun commentaire`;

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
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "Erreur du service IA" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const raw = data.choices?.[0]?.message?.content || "";
    const topics = raw.split("|").map((t: string) => t.trim()).filter((t: string) => t.length > 0);

    return new Response(JSON.stringify({ topics }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-topics error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erreur inconnue" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
