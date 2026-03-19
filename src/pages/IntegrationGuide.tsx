import { useSites } from "@/hooks/useData";
import { Copy, Check, BookOpen, Rocket, ChevronDown } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

const getSetupPrompt = (siteId: string, siteName: string) =>
  `Connecte ce projet à la base de données Supabase partagée de SEO Sans Lesbienne et configure le blog complet.

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

const CopyBlock = ({ prompt }: { prompt: string }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(prompt);
    setCopied(true);
    toast.success("Prompt copié !");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="bg-card border border-border rounded-lg overflow-hidden">
      <pre className="p-4 text-xs text-muted-foreground font-mono whitespace-pre-wrap leading-relaxed max-h-96 overflow-y-auto">
        {prompt}
      </pre>
      <div className="px-4 py-3 border-t border-border flex justify-end">
        <Button variant="emerald" size="sm" className="gap-2" onClick={handleCopy}>
          {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
          {copied ? "Copié !" : "Copier le prompt"}
        </Button>
      </div>
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
          Prompt de configuration à copier-coller dans le Lovable du site connecté
        </p>
      </div>

      {sites.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-16">
          Aucun site connecté. Ajoutez un site depuis la page Sites pour voir le prompt.
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
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Rocket className="w-4 h-4 text-primary" />
                <h2 className="font-display text-base font-semibold text-foreground">
                  Prompt de configuration pour {selectedSite.name}
                </h2>
              </div>
              <p className="text-xs text-muted-foreground">
                Copiez ce prompt et collez-le dans le chat Lovable du projet <strong>{selectedSite.name}</strong>. Il configure la connexion à la base de données, la mise en page blog et les corrections de bugs.
              </p>
              <CopyBlock prompt={getSetupPrompt(selectedSite.id, selectedSite.name)} />
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default IntegrationGuide;
