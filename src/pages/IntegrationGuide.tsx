import { useSites } from "@/hooks/useData";
import { Copy, Check, BookOpen, Rocket, ChevronDown, Sparkles, ListChecks, Workflow } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

// ---- PROMPT 1: Setup complet ----
const getSetupPrompt = (siteId: string, siteName: string) =>
  `Connecte ce projet à la base de données Supabase partagée de BlogFlow et configure le blog complet.

=== 1. CONNEXION SUPABASE ===

URL Supabase : ${SUPABASE_URL}
Clé anon : ${SUPABASE_KEY}
site_id : ${siteId}
Nom du site : ${siteName}

Installe @supabase/supabase-js et @tanstack/react-query.
Crée un client Supabase avec createClient(URL, KEY).

Crée un hook "useBlogArticles" qui récupère les articles depuis la table "articles" avec :
- site_id = '${siteId}'
- status = 'published'
- Ordre : published_at DESC

Crée un hook "useBlogArticle(slug)" qui récupère un seul article par slug et site_id = '${siteId}'.

=== 2. MISE EN PAGE BLOG ===

Page /blog (liste des articles) :
- Grille 3 colonnes sur desktop, 1 colonne sur mobile
- Chaque carte affiche : image, titre, extrait, date de publication, bouton "Lire l'article"
- Pour l'image, utilise image_url de l'article. Si null, génère une image via Pollinations.ai :
  const imageUrl = article.image_url || \`https://image.pollinations.ai/prompt/\${encodeURIComponent(article.title + ', professional photography, high quality')}?width=1200&height=630&nologo=true\`;

Page /blog/:slug (article) :
- Image hero pleine largeur (hauteur 450px) avec dégradé sombre en bas et titre superposé en blanc
- Métadonnées sous le hero : date de publication, temps de lecture estimé, catégorie
- Contenu centré, largeur max 750px, police 18px, interligne 1.8
- Titres h2 avec bordure gauche accent, h3 en gras avec couleur accent
- Image illustrative insérée au milieu du contenu (même logique Pollinations.ai)
- Encadré de présentation en bas avec logo et bouton CTA

=== 3. CORRECTIONS IMPORTANTES ===

DATE : Ne JAMAIS utiliser published_at directement car il peut être null.
→ Utilise ce fallback partout : article.published_at || article.created_at
→ Format avec date-fns : format(parseISO(date), "d MMMM yyyy", { locale: fr })

IMAGES : image_url est souvent null dans la base.
→ Génère TOUJOURS une image de fallback via Pollinations.ai avec le titre encodé en URL
→ Utilise cette logique dans la liste /blog ET dans le hero de /blog/:slug

LAYOUT : La page article doit avoir :
- Hero image 450px avec titre superposé sur dégradé sombre (gradient-to-t from-black/80)
- Contenu centré max-w-[750px], text-lg, leading-relaxed
- Métadonnées formatées en ligne sous le hero
- Pas de texte coupé, pas de layout cassé sur mobile`;

// ---- PROMPT 2: Génération de sujets ----
const getTopicsPrompt = (siteName: string, siteDescription: string, siteUrl: string) =>
  `Tu es un expert en stratégie de contenu web et en référencement local. Ton rôle est de proposer des sujets précis, engageants et optimisés SEO pour des articles de blog. Ces sujets doivent être adaptés à une entreprise locale qui veut améliorer sa visibilité sur Google et apporter une vraie valeur informative à ses visiteurs.

Objectifs de la mission :

Générer N sujets d'articles de blog

Chaque sujet doit être concret, clair et centré sur une problématique réelle vécue par les clients ou une question fréquente dans le secteur

Les sujets doivent être variés et couvrir différents formats : guide pratique, conseil expert, comparatif, FAQ développée, article saisonnier, focus sur un service précis, retour d'expérience, sensibilisation à un problème, tendances du secteur, coulisses du métier, etc.

Les sujets doivent être pensés pour le SEO local : intégrer naturellement la ville, la région ou les spécificités géographiques quand c'est pertinent

Le ton doit rester humain, professionnel et proche du quotidien des clients

TRES IMPORTANT :

Génère N sujets EN UNE SEULE FOIS, et chacun doit être RADICALEMENT différent :

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

Informations sur l'entreprise :

Nom : "${siteName}"

Ville : "[VILLE]"

Description : "${siteDescription || "[DESCRIPTION_ENTREPRISE]"}"

Source site internet : "${siteUrl}" "[INFO_SITE]"

Tâche : Proposer N sujets distincts et exploitables pour la rédaction d'articles de blog optimisés SEO, adaptés à l'activité locale de l'entreprise. Ces sujets seront ensuite utilisés pour générer les articles complets — ils doivent donc être suffisamment précis et riches pour permettre la rédaction d'un article de 800 à 1200 mots.

Format de sortie STRICT :

Retourne EXACTEMENT N sujets

Sépare chaque sujet par | (pipe)

Sortie au format pipe unique sans texte additionnel

Aucune introduction, aucune conclusion, aucun commentaire

Rappels stricts :

Chaque sujet doit être unique et non redondant

Les sujets doivent refléter la vraie activité de l'entreprise

Penser SEO local : ville, région, spécificités du territoire quand pertinent

Sortie au format pipe unique sans texte additionnel`;

// ---- PROMPT 3: Rédaction d'articles ----
const getArticlePrompt = (siteName: string, siteDescription: string, siteUrl: string) =>
  `CONTEXTE
Tu es un expert en rédaction web et en référencement local. Ton rôle est de rédiger un article de blog long, naturel et engageant, comme si tu étais un conseiller ou un gérant d'entreprise qui connaît son terrain. Le texte doit refléter un ton humain, empathique, professionnel, sans jamais sembler généré par une IA.

Objectifs de la mission :

Rédiger un article de blog convaincant et optimisé SEO pour l'entreprise "${siteName}" dans la ville de "[VILLE]"

Adapter le message aux spécificités du blog d'un site internet professionnel

L'article doit capter l'attention dès le titre et la première phrase, développer le sujet en profondeur avec des angles concrets et locaux, et se terminer par une invitation naturelle à contacter l'entreprise

Le texte doit absolument éviter tout style robotique ou générique. Il doit sembler rédigé par un expert du terrain, qui connaît les problématiques concrètes des clients. Utilisez un ton naturel, proche, professionnel mais pas scolaire

L'article doit partir d'un constat réel, d'un problème vécu, ou d'une mise en situation locale. Ne commencez jamais directement par une liste ou une solution. Partez toujours d'un angle humain, local ou contextuel

Structurez l'article avec des sous-titres H2 et H3 clairs, des paragraphes bien aérés, et des transitions fluides entre les sections

Intégrez naturellement des mots-clés locaux et métier tout au long du texte, sans forcer ni sur-optimiser

TRES IMPORTANT: Génère N articles EN UNE SEULE FOIS, en parallèle, et chacun doit être RADICALEMENT différent des autres :

Varier angle, structure, arguments, vocabulaire, rythme, organisation des sections

Ne pas réutiliser les mêmes tournures, synonymes évidents, ordres de paragraphes, CTA identiques

Alterner les formats rédactionnels (guide pratique, conseils d'expert, storytelling, cas concret, FAQ développée, article éducatif, retour d'expérience, focus saisonnier, comparatif, coulisses du métier)

Veiller à avoir une ponctuation et une orthographe parfaites

Contraintes de rédaction :

Longueur : 800 à 1200 mots

Style d'écriture : Professionnel (sérieux mais accessible, ton neutre et poli)

Aucun numéro de téléphone ni email dans le contenu

Pas de numérotation globale 1), 2), etc.

Pas d'introduction/conclusion générique ou bateau

Majuscules : seulement en début de phrase et pour les noms propres

Pas de promotions directes ni de tarifs

Optimisé pour le référencement naturel local : intégrer naturellement la ville, la région, les spécificités géographiques ou climatiques si pertinent

Chaque article doit avoir un titre H1 accrocheur, optimisé SEO, qui donne envie de lire

Structure attendue de chaque article :

Un titre H1 accrocheur

Une introduction qui part d'un angle humain ou d'une problématique concrète (pas de liste)

3 à 5 sections avec sous-titres H2, chacune pouvant contenir des sous-sections H3

Une conclusion naturelle avec un appel à l'action implicite vers l'entreprise

Un champ "meta_description" de 150 à 160 caractères optimisé SEO

Informations à intégrer subtilement :

Nom de l'entreprise : "${siteName}"

Description : "${siteDescription || "[DESCRIPTION_ENTREPRISE]"}"

Voici des informations du site internet de l'entreprise : source: "${siteUrl}" "[INFO_SITE]"

L'article de blog doit parler autour de ce sujet : [SUJET]

Précision importante : L'article doit impérativement traiter clairement et exclusivement du sujet indiqué, sans digressions, afin de maximiser sa pertinence SEO pour les internautes recherchant cette prestation spécifique.

Tâche : Rédiger un article de blog qui positionne naturellement l'entreprise comme experte locale de son domaine. Il doit apporter une vraie valeur informationnelle au lecteur tout en renforçant la crédibilité et la visibilité SEO de l'entreprise.`;

// ---- PROMPT 4: Workflow 2 étapes ----
const getWorkflowPrompt = () =>
  `En mode Auto, la génération de contenu doit se faire en 2 étapes distinctes et séquentielles :

Étape 1 — Génération des sujets : utiliser le prompt de génération de sujets pour produire N sujets séparés par des pipes. Afficher ces sujets à l'utilisateur sous forme de liste avec une case à cocher. L'utilisateur peut valider, modifier ou supprimer des sujets avant de passer à l'étape suivante.

Étape 2 — Génération des articles : pour chaque sujet validé, lancer la génération de l'article complet via le prompt de rédaction en injectant le sujet dans le champ [SUJET]. Les articles sont générés en parallèle et ajoutés à la file de planification.

Cette approche en 2 étapes garantit une meilleure qualité et permet à l'utilisateur de contrôler les sujets avant la rédaction.`;

// ---- Components ----
const CopyBlock = ({ prompt, label, icon: Icon }: { prompt: string; label: string; icon: React.ElementType }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(prompt);
    setCopied(true);
    toast.success("Prompt copié !");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="bg-card border border-border rounded-lg overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border bg-muted/30">
        <Icon className="w-4 h-4 text-primary" />
        <h3 className="font-display text-sm font-semibold text-foreground">{label}</h3>
        <Button variant="emerald" size="sm" className="gap-2 ml-auto" onClick={handleCopy}>
          {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
          {copied ? "Copié !" : "Copier"}
        </Button>
      </div>
      <pre className="p-4 text-xs text-muted-foreground font-mono whitespace-pre-wrap leading-relaxed max-h-72 overflow-y-auto">
        {prompt}
      </pre>
    </div>
  );
};

const IntegrationGuide = () => {
  const { data: sites = [], isLoading } = useSites();
  const [selectedSiteId, setSelectedSiteId] = useState<string | null>(null);
  const [selectorOpen, setSelectorOpen] = useState(false);

  const selectedSite = sites.find((s) => s.id === selectedSiteId) ?? sites[0] ?? null;

  if (isLoading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[50vh]">
        <p className="text-muted-foreground font-mono text-sm animate-pulse">Chargement...</p>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="font-display text-2xl font-bold text-foreground flex items-center gap-3">
          <BookOpen className="w-6 h-6 text-primary" />
          Guide d'intégration
        </h1>
        <p className="font-mono text-xs text-muted-foreground mt-1">
          Prompts prêts à copier-coller — configuration, génération de sujets et rédaction d'articles
        </p>
      </div>

      {sites.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-16">
          Aucun site connecté. Ajoutez un site depuis la page Sites pour voir les prompts.
        </p>
      ) : (
        <>
          {/* Site Selector */}
          <div className="relative">
            <button
              onClick={() => setSelectorOpen(!selectorOpen)}
              className="w-full flex items-center justify-between gap-3 bg-card border border-border rounded-lg px-4 py-3 hover:border-primary/40 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-md flex items-center justify-center text-sm font-bold shrink-0"
                  style={{
                    backgroundColor: (selectedSite?.color ?? "#00e87a") + "22",
                    color: selectedSite?.color ?? "#00e87a",
                  }}
                >
                  {selectedSite?.name.charAt(0)}
                </div>
                <div className="text-left">
                  <p className="font-display text-sm font-semibold text-foreground">{selectedSite?.name}</p>
                  <p className="font-mono text-xs text-muted-foreground">{selectedSite?.url}</p>
                </div>
              </div>
              <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${selectorOpen ? "rotate-180" : ""}`} />
            </button>

            {selectorOpen && sites.length > 1 && (
              <div className="absolute z-10 mt-1 w-full bg-card border border-border rounded-lg shadow-lg overflow-hidden">
                {sites.map((site) => (
                  <button
                    key={site.id}
                    onClick={() => { setSelectedSiteId(site.id); setSelectorOpen(false); }}
                    className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/50 transition-colors text-left ${
                      site.id === selectedSite?.id ? "bg-primary/5" : ""
                    }`}
                  >
                    <div
                      className="w-8 h-8 rounded-md flex items-center justify-center text-xs font-bold shrink-0"
                      style={{
                        backgroundColor: (site.color ?? "#00e87a") + "22",
                        color: site.color ?? "#00e87a",
                      }}
                    >
                      {site.name.charAt(0)}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground">{site.name}</p>
                      <p className="font-mono text-xs text-muted-foreground">{site.url}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {selectedSite && (
            <div className="space-y-6">
              {/* Step numbers */}
              <div className="flex items-start gap-3">
                <span className="mt-1 w-7 h-7 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold shrink-0">1</span>
                <div className="flex-1">
                  <CopyBlock
                    label="Configuration du site (Supabase + Blog + Corrections)"
                    icon={Rocket}
                    prompt={getSetupPrompt(selectedSite.id, selectedSite.name)}
                  />
                </div>
              </div>

              <div className="flex items-start gap-3">
                <span className="mt-1 w-7 h-7 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold shrink-0">2</span>
                <div className="flex-1">
                  <CopyBlock
                    label="Prompt de génération de sujets d'articles"
                    icon={ListChecks}
                    prompt={getTopicsPrompt(selectedSite.name, selectedSite.description ?? "", selectedSite.url)}
                  />
                </div>
              </div>

              <div className="flex items-start gap-3">
                <span className="mt-1 w-7 h-7 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold shrink-0">3</span>
                <div className="flex-1">
                  <CopyBlock
                    label="Prompt de rédaction d'articles SEO"
                    icon={Sparkles}
                    prompt={getArticlePrompt(selectedSite.name, selectedSite.description ?? "", selectedSite.url)}
                  />
                </div>
              </div>

              <div className="flex items-start gap-3">
                <span className="mt-1 w-7 h-7 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold shrink-0">4</span>
                <div className="flex-1">
                  <CopyBlock
                    label="Workflow 2 étapes (sujets → articles)"
                    icon={Workflow}
                    prompt={getWorkflowPrompt()}
                  />
                </div>
              </div>

              <div className="bg-muted/30 border border-border rounded-lg p-4">
                <p className="text-xs text-muted-foreground">
                  <strong className="text-foreground">💡 Mode d'emploi :</strong> Copiez le prompt <strong>1</strong> dans le Lovable du site pour configurer la connexion et le blog.
                  Puis utilisez les prompts <strong>2</strong> et <strong>3</strong> dans BlogFlow pour configurer la génération automatique d'articles.
                  Le prompt <strong>4</strong> décrit le workflow en 2 étapes à intégrer dans le mode Auto.
                  Les champs entre crochets <code>[VILLE]</code>, <code>[INFO_SITE]</code>, <code>[SUJET]</code>, <code>[N]</code> sont à remplacer par les valeurs réelles.
                </p>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default IntegrationGuide;
