import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useSites, useCreateSite, useDeleteSite, useAllArticles } from "@/hooks/useData";
import { Globe, ExternalLink, Plus, FileText, Trash2, Copy, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { format, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import { toast } from "sonner";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";

const Sites = () => {
  const navigate = useNavigate();
  const { data: sites = [], isLoading } = useSites();
  const { data: articles = [] } = useAllArticles();
  const createSite = useCreateSite();
  const deleteSite = useDeleteSite();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", url: "", blog_path: "/blog", description: "", niche: "", color: "#00e87a" });

  const handleSubmit = () => {
    if (!form.name || !form.url) return toast.error("Nom et URL requis");
    createSite.mutate(form, {
      onSuccess: () => { toast.success("Site ajouté"); setOpen(false); setForm({ name: "", url: "", blog_path: "/blog", description: "", niche: "", color: "#00e87a" }); },
      onError: () => toast.error("Erreur lors de l'ajout"),
    });
  };

  const handleDelete = (id: string) => {
    deleteSite.mutate(id, {
      onSuccess: () => toast.success("Site supprimé"),
      onError: () => toast.error("Erreur lors de la suppression"),
    });
  };

  if (isLoading) {
    return <div className="p-8 flex items-center justify-center min-h-[50vh]"><p className="text-muted-foreground font-mono text-sm animate-pulse">Chargement...</p></div>;
  }

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground">Sites Lovable</h1>
          <p className="font-mono text-xs text-muted-foreground mt-1">Gérer vos sites connectés</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button variant="emerald" className="gap-2"><Plus className="w-4 h-4" />Connecter un site</Button>
          </DialogTrigger>
          <DialogContent className="bg-card border-border">
            <DialogHeader>
              <DialogTitle className="font-display">Connecter un site Lovable</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-2">
              {[
                { key: "name", label: "Nom du site", placeholder: "Mon Blog" },
                { key: "url", label: "URL du site", placeholder: "https://monsite.lovable.app" },
                { key: "blog_path", label: "Chemin blog", placeholder: "/blog" },
                { key: "description", label: "Description", placeholder: "Blog tech & innovation" },
                { key: "niche", label: "Niche", placeholder: "Technology" },
              ].map((f) => (
                <div key={f.key}>
                  <label className="text-xs text-muted-foreground font-mono mb-1.5 block">{f.label}</label>
                  <input
                    type="text"
                    value={(form as any)[f.key]}
                    onChange={(e) => setForm((p) => ({ ...p, [f.key]: e.target.value }))}
                    placeholder={f.placeholder}
                    className="w-full bg-surface border border-border rounded-md px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
              ))}
              <div>
                <label className="text-xs text-muted-foreground font-mono mb-1.5 block">Couleur</label>
                <input type="color" value={form.color} onChange={(e) => setForm((p) => ({ ...p, color: e.target.value }))} className="h-10 w-full rounded-md border border-border bg-surface cursor-pointer" />
              </div>
              <Button variant="emerald" className="w-full" onClick={handleSubmit} disabled={createSite.isPending}>
                {createSite.isPending ? "Ajout..." : "Ajouter le site"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {sites.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-16">Aucun site connecté. Ajoutez votre premier site !</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {sites.map((site) => {
            const siteArticles = articles.filter((a) => a.site_id === site.id && a.status === "published");
            const lastPublished = siteArticles.length > 0
              ? siteArticles.sort((a, b) => (b.published_at ?? "").localeCompare(a.published_at ?? ""))[0]?.published_at
              : null;

            return (
              <div key={site.id} className="bg-card border border-border rounded-lg p-5 transition-all hover:border-primary/30 group">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3 mb-4">
                    <div className="w-10 h-10 rounded-md flex items-center justify-center text-sm font-bold shrink-0" style={{ backgroundColor: (site.color ?? "#00e87a") + "22", color: site.color ?? "#00e87a" }}>
                      {site.name.charAt(0)}
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-display text-base font-semibold text-foreground">{site.name}</h3>
                      <a href={site.url} target="_blank" rel="noopener noreferrer" className="font-mono text-xs text-primary hover:underline flex items-center gap-1">
                        {site.url.replace("https://", "")}
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  </div>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => handleDelete(site.id)}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>

                {site.description && <p className="text-xs text-muted-foreground mb-3">{site.description}</p>}

                <div className="flex items-center gap-1.5 mb-3">
                  <span className="font-mono text-[10px] text-muted-foreground bg-surface px-2 py-1 rounded truncate">{site.id}</span>
                  <button
                    onClick={() => { navigator.clipboard.writeText(site.id); toast.success("UUID copié !"); }}
                    className="text-muted-foreground hover:text-primary transition-colors shrink-0"
                    title="Copier l'UUID"
                  >
                    <Copy className="w-3 h-3" />
                  </button>
                </div>

                <div className="flex items-center justify-between text-xs text-muted-foreground border-t border-border pt-3">
                  <span className="flex items-center gap-1"><FileText className="w-3 h-3" />{siteArticles.length} articles</span>
                  <span className="font-mono">
                    {lastPublished ? format(parseISO(lastPublished), "dd MMM", { locale: fr }) : "—"}
                  </span>
                </div>

                {site.niche && (
                  <div className="mt-3">
                    <span className="text-[10px] bg-secondary text-secondary-foreground px-2 py-0.5 rounded">{site.niche}</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default Sites;
