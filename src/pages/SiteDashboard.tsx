import { useState, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useSites, useAllArticles, useDeleteArticle, useUpdateArticle } from "@/hooks/useData";
import { useQueryClient } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import {
  ArrowLeft, Calendar, ExternalLink, Trash2, Rocket, Eye,
  FileText, CheckCircle2, Timer, Globe, ShieldCheck, Loader2, AlertTriangle, CircleCheck, Zap, ZapOff,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import SiteArticleThumbnail from "@/components/SiteArticleThumbnail";
import ArticlePreviewModal from "@/components/ArticlePreviewModal";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

type TabView = "scheduled" | "published";

const SiteDashboard = () => {
  const [activeTab, setActiveTab] = useState<TabView>("scheduled");
  const { siteId } = useParams<{ siteId: string }>();
  const navigate = useNavigate();
  const { data: sites = [], isLoading: loadingSites } = useSites();
  const { data: articles = [], isLoading: loadingArticles } = useAllArticles();
  const deleteArticle = useDeleteArticle();
  const updateArticle = useUpdateArticle();
  const [previewArticle, setPreviewArticle] = useState<(typeof articles)[0] | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [verifyResult, setVerifyResult] = useState<{
    summary: string;
    issues_count: number;
    total_articles: number;
    fixes_applied: number;
    fixes_details: { article_title: string; issue: string; action: string; applied: boolean }[];
  } | null>(null);
  const queryClient = useQueryClient();

  const site = sites.find((s) => s.id === siteId);
  const siteArticles = articles.filter((a) => a.site_id === siteId);

  const published = siteArticles.filter((a) => a.status === "published");
  const scheduled = siteArticles.filter((a) => a.status === "scheduled");
  const drafts = siteArticles.filter((a) => a.status === "draft");

  // Autopilot: check both scheduled AND published articles in autopilot mode
  const autopilotScheduled = scheduled.filter((a) => a.mode === "autopilot");
  const autopilotPublished = published.filter((a) => a.mode === "autopilot");
  const allAutopilotArticles = [...autopilotScheduled, ...autopilotPublished];
  const isAutopilotActive = allAutopilotArticles.length > 0;
  const hasAutopilotPending = autopilotScheduled.length > 0;
  const nextAutopilot = hasAutopilotPending
    ? [...autopilotScheduled].sort((a, b) => (a.scheduled_at ?? "").localeCompare(b.scheduled_at ?? ""))[0]
    : null;
  const currentFrequency = (nextAutopilot?.frequency || autopilotPublished[0]?.frequency) || "";

  const frequencyOptions = [
    { label: "Tous les jours", value: "Tous les jours" },
    { label: "Tous les 3 jours", value: "Tous les 3 jours" },
    { label: "Toutes les semaines", value: "Toutes les semaines" },
    { label: "Toutes les 2 semaines", value: "Toutes les 2 semaines" },
    { label: "Tous les mois", value: "Tous les mois" },
  ];

  const upcoming = [...scheduled].sort((a, b) =>
    (a.scheduled_at ?? "").localeCompare(b.scheduled_at ?? "")
  );

  const handleDelete = (id: string) => {
    deleteArticle.mutate(id, {
      onSuccess: () => toast.success("Article supprimé"),
      onError: () => toast.error("Erreur"),
    });
  };

  const handlePublish = (article: (typeof siteArticles)[0]) => {
    if (!site) return;
    const baseUrl = site.url.replace(/\/+$/, "");
    const blogPath = site.blog_path.replace(/\/+$/, "");
    updateArticle.mutate(
      {
        id: article.id,
        status: "published",
        published_at: new Date().toISOString(),
        page_url: `${baseUrl}${blogPath}/${article.slug}`,
      },
      {
        onSuccess: () => toast.success("Article publié !"),
        onError: () => toast.error("Erreur"),
      }
    );
  };

  const handleVerifyAll = async () => {
    if (!site) return;
    setVerifying(true);
    setVerifyResult(null);
    try {
      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/verify-articles`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          siteId: site.id,
          siteName: site.name,
          siteNiche: site.niche || "",
          siteDescription: site.description || "",
          siteUrl: site.url,
        }),
      });
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ error: "Erreur réseau" }));
        throw new Error(err.error || `Erreur ${resp.status}`);
      }
      const result = await resp.json();
      setVerifyResult(result);
      if (result.fixes_applied > 0) {
        queryClient.invalidateQueries({ queryKey: ["articles"] });
        toast.success(`${result.fixes_applied} correction${result.fixes_applied > 1 ? "s" : ""} appliquée${result.fixes_applied > 1 ? "s" : ""}`);
      } else if (result.issues_count === 0) {
        toast.success("Tous les articles sont cohérents !");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erreur lors de la vérification");
    } finally {
      setVerifying(false);
    }
  };

  if (loadingSites || loadingArticles) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[50vh]">
        <p className="text-muted-foreground font-mono text-sm animate-pulse">Chargement...</p>
      </div>
    );
  }

  if (!site) {
    return (
      <div className="p-8 text-center">
        <p className="text-muted-foreground">Site introuvable</p>
        <Button variant="ghost" className="mt-4" onClick={() => navigate("/sites")}>
          Retour aux sites
        </Button>
      </div>
    );
  }

  const siteColor = site.color ?? "#00e87a";

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate("/sites")}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div
          className="w-12 h-12 rounded-lg flex items-center justify-center text-lg font-bold shrink-0"
          style={{ backgroundColor: siteColor + "22", color: siteColor }}
        >
          {site.name.charAt(0)}
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="font-display text-2xl font-bold text-foreground">{site.name}</h1>
          <a
            href={site.url}
            target="_blank"
            rel="noopener noreferrer"
            className="font-mono text-xs text-primary hover:underline flex items-center gap-1"
          >
            {site.url.replace("https://", "")}
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Publiés", value: published.length, icon: CheckCircle2, color: "text-primary" },
          { label: "Planifiés", value: scheduled.length, icon: Timer, color: "text-amber-400" },
          { label: "Brouillons", value: drafts.length, icon: FileText, color: "text-muted-foreground" },
          { label: "Total", value: siteArticles.length, icon: Globe, color: "text-foreground" },
        ].map((s) => (
          <div key={s.label} className="bg-card border border-border rounded-lg p-4 flex items-center gap-3">
            <s.icon className={`w-5 h-5 ${s.color}`} />
            <div>
              <p className="font-display text-xl font-bold text-foreground">{s.value}</p>
              <p className="font-mono text-[10px] text-muted-foreground">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Autopilot banner */}
      {isAutopilotActive && (
        <div className="bg-card border-2 border-yellow-500/30 rounded-lg p-5 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-yellow-500/10 flex items-center justify-center shrink-0">
              <Zap className="w-5 h-5 text-yellow-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-foreground flex items-center gap-2">
                ⚡ Autopilote actif
                <Badge className="bg-yellow-500/15 text-yellow-400 border-yellow-500/20 text-[10px]">
                  {autopilotPublished.length} publié{autopilotPublished.length > 1 ? "s" : ""}
                  {autopilotScheduled.length > 0 ? ` · ${autopilotScheduled.length} en file` : ""}
                </Badge>
              </p>
              <p className="text-xs text-muted-foreground font-mono mt-0.5">
                {hasAutopilotPending
                  ? `Prochain article ${format(parseISO(nextAutopilot!.scheduled_at!), "dd MMM yyyy · HH:mm", { locale: fr })}`
                  : "⚠️ Aucun article en file — relancez l'autopilote"}
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="text-destructive hover:text-destructive hover:bg-destructive/10 gap-1.5 shrink-0"
              onClick={async () => {
                const ids = autopilotArticles.map((a) => a.id);
                const { error } = await supabase.from("articles").delete().in("id", ids);
                if (error) {
                  toast.error("Erreur lors de la désactivation");
                } else {
                  queryClient.invalidateQueries({ queryKey: ["articles"] });
                  toast.success(`Autopilote désactivé · ${ids.length} article${ids.length > 1 ? "s" : ""} supprimé${ids.length > 1 ? "s" : ""}`);
                }
              }}
            >
              <ZapOff className="w-3.5 h-3.5" />
              Désactiver
            </Button>
          </div>

          {/* Frequency editor */}
          <div className="flex items-center gap-3 pt-3 border-t border-border">
            <span className="text-xs text-muted-foreground font-mono shrink-0">Fréquence :</span>
            <div className="flex flex-wrap gap-1.5">
              {frequencyOptions.map((opt) => (
                <button
                  key={opt.value}
                  className={`text-[11px] px-2.5 py-1.5 rounded-md border transition-all ${
                    currentFrequency === opt.value
                      ? "bg-yellow-500/15 border-yellow-500/30 text-yellow-400 font-semibold"
                      : "bg-card border-border text-muted-foreground hover:border-yellow-500/20 hover:text-foreground"
                  }`}
                  onClick={async () => {
                    if (currentFrequency === opt.value) return;
                    const ids = autopilotArticles.map((a) => a.id);
                    const promises = ids.map((id) =>
                      supabase.from("articles").update({ frequency: opt.value }).eq("id", id)
                    );
                    const results = await Promise.all(promises);
                    const hasError = results.some((r) => r.error);
                    if (hasError) {
                      toast.error("Erreur lors de la mise à jour");
                    } else {
                      queryClient.invalidateQueries({ queryKey: ["articles"] });
                      toast.success(`Fréquence mise à jour : ${opt.value}`);
                    }
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Verify Button & Results */}
      {scheduled.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <Button
              variant="emerald"
              className="gap-2"
              onClick={handleVerifyAll}
              disabled={verifying}
            >
              {verifying ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Vérification en cours...</>
              ) : (
                <><ShieldCheck className="w-4 h-4" /> Vérifier tout</>
              )}
            </Button>
            {verifying && (
              <span className="text-xs text-muted-foreground font-mono animate-pulse">
                L'IA analyse la cohérence de {scheduled.length} articles planifiés...
              </span>
            )}
          </div>

          {verifyResult && (
            <div className={`border rounded-lg p-5 space-y-4 ${
              verifyResult.issues_count === 0
                ? "border-primary/30 bg-primary/5"
                : "border-amber-400/30 bg-amber-400/5"
            }`}>
              <div className="flex items-start gap-3">
                {verifyResult.issues_count === 0 ? (
                  <CircleCheck className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                ) : (
                  <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                )}
                <div>
                  <p className="text-sm font-semibold text-foreground">{verifyResult.summary}</p>
                  <p className="text-xs text-muted-foreground font-mono mt-1">
                    {verifyResult.total_articles} articles analysés · {verifyResult.issues_count} problème{verifyResult.issues_count !== 1 ? "s" : ""} détecté{verifyResult.issues_count !== 1 ? "s" : ""} · {verifyResult.fixes_applied} correction{verifyResult.fixes_applied !== 1 ? "s" : ""} appliquée{verifyResult.fixes_applied !== 1 ? "s" : ""}
                  </p>
                </div>
              </div>

              {verifyResult.fixes_details && verifyResult.fixes_details.length > 0 && (
                <div className="space-y-2 border-t border-border pt-3">
                  <p className="text-xs text-muted-foreground font-mono">Détail des corrections :</p>
                  {verifyResult.fixes_details.map((fix, i) => (
                    <div key={i} className="flex items-start gap-2 py-1.5 px-3 rounded-md bg-card">
                      {fix.applied ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
                      ) : (
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                      )}
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-foreground truncate">{fix.article_title}</p>
                        <p className="text-[10px] text-muted-foreground">{fix.issue}</p>
                        <Badge variant="outline" className="text-[9px] mt-1 px-1.5 py-0">
                          {fix.action === "regenerate" ? "Régénéré" : fix.action === "replace_content" ? "Contenu corrigé" : fix.action === "replace_title" ? "Titre corrigé" : "Extrait corrigé"}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Article Cards */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <Button
            variant={activeTab === "scheduled" ? "emerald" : "surface"}
            size="sm"
            className="text-xs gap-1.5"
            onClick={() => setActiveTab("scheduled")}
          >
            <Timer className="w-3.5 h-3.5" />
            Planifiés ({scheduled.length})
          </Button>
          <Button
            variant={activeTab === "published" ? "emerald" : "surface"}
            size="sm"
            className="text-xs gap-1.5"
            onClick={() => setActiveTab("published")}
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            Publiés ({published.length})
          </Button>
        </div>

        {(() => {
          const displayArticles = activeTab === "scheduled" ? upcoming : published;
          if (displayArticles.length === 0) return (
            <p className="text-sm text-muted-foreground text-center py-12">
              {activeTab === "scheduled" ? "Aucun article planifié." : "Aucun article publié."}
            </p>
          );
          return (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {displayArticles.map((article) => {
              const articleDate = article.published_at || article.scheduled_at || article.created_at;
              const isPublished = article.status === "published";
              const isScheduled = article.status === "scheduled";

              return (
                <div
                  key={article.id}
                  className="bg-card border border-border rounded-lg overflow-hidden hover:border-primary/30 transition-all group"
                >
                  <div className="flex">
                    <SiteArticleThumbnail title={article.title} imageUrl={article.image_url} />

                    <div className="flex-1 p-4 flex flex-col min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        {article.category && (
                          <span className="text-xs font-medium text-foreground bg-muted px-2 py-0.5 rounded">
                            {article.category}
                          </span>
                        )}
                        <Badge
                          className={`text-[10px] px-1.5 py-0 ${
                            isPublished
                              ? "bg-primary/15 text-primary border-primary/20"
                              : isScheduled
                              ? "bg-amber-400/15 text-amber-400 border-amber-400/20"
                              : "bg-muted text-muted-foreground border-border"
                          }`}
                        >
                          {isPublished ? "Publié" : isScheduled ? "Planifié" : "Brouillon"}
                        </Badge>
                      </div>

                      <h3
                        className="font-display text-sm font-semibold text-foreground line-clamp-2 mb-1 cursor-pointer hover:text-primary transition-colors"
                        onClick={() => setPreviewArticle(article)}
                      >
                        {article.title}
                      </h3>

                      {article.excerpt && (
                        <p className="text-xs text-muted-foreground line-clamp-3 mb-3 flex-1">
                          {article.excerpt}
                        </p>
                      )}

                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-3">
                        <Calendar className="w-3 h-3" />
                        <span className="font-mono" style={{ color: siteColor }}>
                          {format(parseISO(articleDate), "dd/MM/yyyy HH:mm", { locale: fr })}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 mt-auto">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs gap-1 text-primary"
                          onClick={() => setPreviewArticle(article)}
                        >
                          <Eye className="w-3 h-3" />
                          Lire
                        </Button>
                        {isScheduled && (
                          <Button
                            variant="emerald"
                            size="sm"
                            className="h-7 text-xs gap-1"
                            onClick={() => handlePublish(article)}
                            disabled={updateArticle.isPending}
                          >
                            <Rocket className="w-3 h-3" />
                            Publier
                          </Button>
                        )}
                        {article.page_url && (
                          <a href={article.page_url} target="_blank" rel="noopener noreferrer">
                            <Button variant="ghost" size="sm" className="h-7 text-xs gap-1 text-primary">
                              <ExternalLink className="w-3 h-3" />
                              Voir
                            </Button>
                          </a>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs text-destructive opacity-0 group-hover:opacity-100 transition-opacity ml-auto"
                          onClick={() => handleDelete(article.id)}
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          );
        })()}
      </div>

      {/* Preview Modal */}
      {previewArticle && (
        <ArticlePreviewModal
          article={previewArticle}
          site={site}
          open={!!previewArticle}
          onClose={() => setPreviewArticle(null)}
        />
      )}
    </div>
  );
};

export default SiteDashboard;
