import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useSites, useCreateSite, useDeleteSite, useUpdateSite, useAllArticles } from "@/hooks/useData";
import { Globe, ExternalLink, Plus, FileText, Trash2, Copy, DollarSign, Zap } from "lucide-react";
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
  const updateSite = useUpdateSite();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", url: "", blog_path: "/blog", description: "", niche: "", color: "#00e87a" });
  const [editingRevenue, setEditingRevenue] = useState<string | null>(null);
  const [revenueValue, setRevenueValue] = useState("");

  const handleSubmit = () => {
    if (!form.name || !form.url) return toast.error("Nom et URL requis");
    createSite.mutate(form, {
      onSuccess: () => { toast.success("Site ajouté"); setOpen(false); setForm({ name: "", url: "", blog_path: "/blog", description: "", niche: "", color: "#00e87a" }); },
      onError: () => toast.error("Erreur lors de l'ajout"),
    });
  };

  const handleDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    deleteSite.mutate(id, {
      onSuccess: () => toast.success("Site supprimé"),
      onError: () => toast.error("Erreur lors de la suppression"),
    });
  };

  const startEditRevenue = (siteId: string, currentRevenue: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingRevenue(siteId);
    setRevenueValue(currentRevenue > 0 ? String(currentRevenue) : "");
  };

  const saveRevenue = (siteId: string, e?: React.MouseEvent | React.KeyboardEvent) => {
    e?.stopPropagation();
    const val = parseFloat(revenueValue) || 0;
    updateSite.mutate(
      { id: siteId, monthly_revenue: val } as any,
      {
        onSuccess: () => {
          toast.success("Mensualité mise à jour");
          setEditingRevenue(null);
        },
        onError: () => toast.error("Erreur"),
      }
    );
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
            const scheduledArticles = articles.filter((a) => a.site_id === site.id && a.status === "scheduled");
            const autopilotArticles = articles.filter((a) => a.site_id === site.id && a.mode === "autopilot" && a.status === "scheduled");
            const isAutopilot = autopilotArticles.length > 0;
            const autopilotFrequency = autopilotArticles[0]?.frequency || "";
            const hasScheduled = scheduledArticles.length > 0;
            const lastPublished = siteArticles.length > 0
              ? siteArticles.sort((a, b) => (b.published_at ?? "").localeCompare(a.published_at ?? ""))[0]?.published_at
              : null;
            const revenue = Number((site as any).monthly_revenue) || 0;

            return (
              <div
                key={site.id}
                className={`bg-card rounded-lg p-5 transition-all group cursor-pointer border-2 ${
                  hasScheduled
                    ? "border-primary/60 hover:border-primary"
                    : "border-destructive/60 hover:border-destructive"
                }`}
                onClick={() => navigate(`/sites/${site.id}`)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3 mb-4">
                    <div className="w-10 h-10 rounded-md flex items-center justify-center text-sm font-bold shrink-0" style={{ backgroundColor: (site.color ?? "#00e87a") + "22", color: site.color ?? "#00e87a" }}>
                      {site.name.charAt(0)}
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-display text-base font-semibold text-foreground">{site.name}</h3>
                      <a href={site.url} target="_blank" rel="noopener noreferrer" className="font-mono text-xs text-primary hover:underline flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                        {site.url.replace("https://", "")}
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  </div>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => handleDelete(site.id, e)}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>

                {site.description && <p className="text-xs text-muted-foreground mb-3">{site.description}</p>}

                {/* Revenue */}
                <div className="flex items-center gap-2 mb-3 p-2 rounded-md bg-surface border border-border" onClick={(e) => e.stopPropagation()}>
                  <DollarSign className="w-3.5 h-3.5 text-primary shrink-0" />
                  {editingRevenue === site.id ? (
                    <div className="flex items-center gap-2 flex-1">
                      <input
                        type="number"
                        value={revenueValue}
                        onChange={(e) => setRevenueValue(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && saveRevenue(site.id, e)}
                        autoFocus
                        placeholder="0"
                        className="flex-1 bg-transparent text-sm font-mono text-foreground focus:outline-none w-16"
                      />
                      <span className="text-xs text-muted-foreground">€/mois</span>
                      <Button variant="emerald" size="sm" className="h-6 text-[10px] px-2" onClick={(e) => saveRevenue(site.id, e)}>
                        OK
                      </Button>
                    </div>
                  ) : (
                    <button
                      onClick={(e) => startEditRevenue(site.id, revenue, e)}
                      className="flex items-center gap-1.5 flex-1 text-left"
                    >
                      <span className="font-mono text-sm font-semibold text-foreground">
                        {revenue > 0 ? `${revenue}€` : "—"}
                      </span>
                      <span className="text-[10px] text-muted-foreground">/mois</span>
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-1.5 mb-3">
                  <span className="font-mono text-[10px] text-muted-foreground bg-surface px-2 py-1 rounded truncate">{site.id}</span>
                  <button
                    onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(site.id); toast.success("UUID copié !"); }}
                    className="text-muted-foreground hover:text-primary transition-colors shrink-0"
                    title="Copier l'UUID"
                  >
                    <Copy className="w-3 h-3" />
                  </button>
                </div>

                <div className="flex items-center justify-between text-xs text-muted-foreground border-t border-border pt-3">
                  <span className="flex items-center gap-1"><FileText className="w-3 h-3" />{siteArticles.length} publiés · {scheduledArticles.length} planifiés</span>
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
