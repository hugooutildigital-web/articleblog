import { useParams, useNavigate } from "react-router-dom";
import { useSites, useAllArticles, useDeleteArticle, useUpdateArticle } from "@/hooks/useData";
import { format, parseISO, isPast, isFuture } from "date-fns";
import { fr } from "date-fns/locale";
import {
  ArrowLeft, Calendar, ExternalLink, Trash2, Rocket, Clock,
  FileText, CheckCircle2, Timer, Globe,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

const getImageUrl = (article: { title: string; image_url: string | null }) =>
  article.image_url ||
  `https://image.pollinations.ai/prompt/${encodeURIComponent(
    article.title + ", professional photography, high quality"
  )}?width=600&height=400&nologo=true`;

const SiteDashboard = () => {
  const { siteId } = useParams<{ siteId: string }>();
  const navigate = useNavigate();
  const { data: sites = [], isLoading: loadingSites } = useSites();
  const { data: articles = [], isLoading: loadingArticles } = useAllArticles();
  const deleteArticle = useDeleteArticle();
  const updateArticle = useUpdateArticle();

  const site = sites.find((s) => s.id === siteId);
  const siteArticles = articles.filter((a) => a.site_id === siteId);

  const published = siteArticles.filter((a) => a.status === "published");
  const scheduled = siteArticles.filter((a) => a.status === "scheduled");
  const drafts = siteArticles.filter((a) => a.status === "draft");

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

      {/* Article Cards */}
      <div>
        <h2 className="font-display text-lg font-semibold text-foreground mb-4">
          {upcoming.length > 0 ? "Prochains articles" : "Tous les articles"}
        </h2>

        {siteArticles.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-12">
            Aucun article pour ce site.
          </p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {(upcoming.length > 0 ? [...upcoming, ...published] : siteArticles).map((article) => {
              const imageUrl = getImageUrl(article);
              const date = article.published_at || article.scheduled_at || article.created_at;
              const isPublished = article.status === "published";
              const isScheduled = article.status === "scheduled";

              return (
                <div
                  key={article.id}
                  className="bg-card border border-border rounded-lg overflow-hidden hover:border-primary/30 transition-all group"
                >
                  <div className="flex">
                    {/* Image */}
                    <div className="w-[200px] shrink-0">
                      <img
                        src={imageUrl}
                        alt={article.title}
                        className="w-full h-full object-cover min-h-[180px]"
                        loading="lazy"
                      />
                    </div>

                    {/* Content */}
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

                      <h3 className="font-display text-sm font-semibold text-foreground line-clamp-2 mb-1">
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
                          {format(parseISO(date), "dd/MM/yyyy HH:mm", { locale: fr })}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 mt-auto">
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
        )}
      </div>
    </div>
  );
};

export default SiteDashboard;
