import { useSites } from "@/hooks/useData";
import { Copy, Check, BookOpen, Database, Layout, Bug } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

const CopyBlock = ({ label, icon: Icon, prompt }: { label: string; icon: React.ElementType; prompt: string }) => {
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
      </div>
      <pre className="p-4 text-xs text-muted-foreground font-mono whitespace-pre-wrap leading-relaxed max-h-64 overflow-y-auto">
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

const getSupabasePrompt = (siteId: string, siteName: string) =>
  `Connecte ce projet Lovable à la base de données Supabase partagée de BlogFlow.

URL Supabase : ${SUPABASE_URL}
Clé anon : ${SUPABASE_KEY}

Ce site a l'identifiant site_id : ${siteId}
Nom du site : ${siteName}

Crée un hook React "useBlogArticles" qui récupère les articles depuis la table "articles" avec les filtres :
- site_id = '${siteId}'
- status = 'published'
Ordonne par published_at DESC.

Crée aussi un hook "useBlogArticle(slug)" qui récupère un seul article par son slug et site_id.

Utilise le client Supabase avec createClient(URL, KEY) et @tanstack/react-query.`;

const getLayoutPrompt = () =>
  `Refais la mise en page du blog pour qu'il ressemble à un vrai blog professionnel :

Page /blog (liste des articles) :
- Grille 3 colonnes sur desktop, 1 colonne sur mobile
- Chaque carte affiche : image, titre, extrait, date de publication, bouton "Lire l'article"
- Pour l'image, utilise image_url de l'article. Si null, génère une image via Pollinations.ai :
  https://image.pollinations.ai/prompt/{encodeURIComponent(titre + ', professional photography, high quality')}?width=1200&height=630&nologo=true

Page /blog/:slug (article) :
- Image hero pleine largeur (hauteur 450px) avec dégradé sombre en bas et titre superposé en blanc
- Métadonnées sous le hero : date de publication, temps de lecture estimé, catégorie
- Contenu centré, largeur max 750px, police 18px, interligne 1.8
- Titres h2 avec bordure gauche accent, h3 en gras avec couleur accent
- Image illustrative insérée au milieu du contenu (même logique Pollinations.ai)
- Encadré de présentation en bas avec logo et bouton CTA`;

const getBugfixPrompt = () =>
  `Corrige ces bugs connus sur les pages blog :

1. DATE INCORRECTE : La date affiche "1 janvier 1970" quand published_at est null.
   → Utilise ce fallback partout : article.published_at || article.created_at
   → Format avec date-fns : format(parseISO(date), "d MMMM yyyy", { locale: fr })

2. IMAGES MANQUANTES : image_url est souvent null dans la base.
   → Génère une image de fallback via Pollinations.ai :
   const imageUrl = article.image_url || \`https://image.pollinations.ai/prompt/\${encodeURIComponent(article.title + ', professional photography, high quality')}?width=1200&height=630&nologo=true\`;
   → Utilise cette logique dans la liste /blog ET dans le hero de /blog/:slug

3. LAYOUT ARTICLE : La page article doit avoir :
   - Hero image 450px avec titre superposé sur dégradé sombre
   - Contenu centré max-w-[750px], text-lg, leading-relaxed (interligne 1.8)
   - Métadonnées formatées sous le hero
   - Pas de texte coupé, pas de layout cassé`;

const IntegrationGuide = () => {
  const { data: sites = [], isLoading } = useSites();

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
          Prompts prêts à copier-coller dans le Lovable de chaque site connecté
        </p>
      </div>

      {sites.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-16">
          Aucun site connecté. Ajoutez un site depuis la page Sites pour voir les prompts.
        </p>
      ) : (
        sites.map((site) => (
          <div key={site.id} className="space-y-4">
            <div className="flex items-center gap-3 pb-2 border-b border-border">
              <div
                className="w-8 h-8 rounded-md flex items-center justify-center text-sm font-bold shrink-0"
                style={{
                  backgroundColor: (site.color ?? "#00e87a") + "22",
                  color: site.color ?? "#00e87a",
                }}
              >
                {site.name.charAt(0)}
              </div>
              <div>
                <h2 className="font-display text-lg font-semibold text-foreground">{site.name}</h2>
                <p className="font-mono text-xs text-muted-foreground">{site.url}</p>
              </div>
            </div>

            <div className="space-y-4 pl-2">
              <div className="flex items-start gap-3">
                <span className="mt-1 w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold shrink-0">1</span>
                <div className="flex-1">
                  <CopyBlock
                    label="Connexion à la base de données"
                    icon={Database}
                    prompt={getSupabasePrompt(site.id, site.name)}
                  />
                </div>
              </div>

              <div className="flex items-start gap-3">
                <span className="mt-1 w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold shrink-0">2</span>
                <div className="flex-1">
                  <CopyBlock
                    label="Mise en page du blog"
                    icon={Layout}
                    prompt={getLayoutPrompt()}
                  />
                </div>
              </div>

              <div className="flex items-start gap-3">
                <span className="mt-1 w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold shrink-0">3</span>
                <div className="flex-1">
                  <CopyBlock
                    label="Corrections de bugs connus"
                    icon={Bug}
                    prompt={getBugfixPrompt()}
                  />
                </div>
              </div>
            </div>
          </div>
        ))
      )}
    </div>
  );
};

export default IntegrationGuide;
