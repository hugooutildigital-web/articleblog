import { useState } from "react";
import type { Article, Site } from "@/hooks/useData";
import { useDeleteArticle, useUpdateArticle } from "@/hooks/useData";
import { ExternalLink, Pencil, Trash2, Copy, Clock, Bot, PenLine, Rocket, Eye, Zap } from "lucide-react";
import { format, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import ArticlePreviewModal from "./ArticlePreviewModal";

interface ArticleCardProps {
  article: Article;
  sites: Site[];
}

const ArticleCard = ({ article, sites }: ArticleCardProps) => {
  const site = sites.find((s) => s.id === article.site_id);
  const siteName = site?.name ?? "Inconnu";
  const siteColor = site?.color ?? "#666";
  const isPublished = article.status === "published";
  const deleteArticle = useDeleteArticle();
  const updateArticle = useUpdateArticle();
  const [previewOpen, setPreviewOpen] = useState(false);

  const handleDelete = () => {
    deleteArticle.mutate(article.id, {
      onSuccess: () => toast.success("Article supprimé"),
      onError: () => toast.error("Erreur lors de la suppression"),
    });
  };

  const handlePublishNow = () => {
    if (!site) {
      toast.error("Site introuvable");
      return;
    }
    const blogPath = site.blog_path.replace(/\/+$/, "");
    const baseUrl = site.url.replace(/\/+$/, "");
    const pageUrl = `${baseUrl}${blogPath}/${article.slug}`;

    updateArticle.mutate(
      {
        id: article.id,
        status: "published",
        published_at: new Date().toISOString(),
        page_url: pageUrl,
      },
      {
        onSuccess: () => toast.success("Article publié !"),
        onError: () => toast.error("Erreur lors de la publication"),
      }
    );
  };

  return (
    <>
      <div className="bg-card border border-border rounded-lg p-5 transition-all hover:border-primary/30 group">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0 cursor-pointer" onClick={() => setPreviewOpen(true)}>
            <div className="flex items-center gap-2 mb-2">
              <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: siteColor }} />
              <span className="font-mono text-xs text-muted-foreground">{siteName}</span>
              <Badge
                variant={isPublished ? "default" : "secondary"}
                className={`text-[10px] px-1.5 py-0 ${
                  isPublished ? "bg-primary/15 text-primary border-primary/20" : "bg-amber/10 text-amber border-amber/20"
                }`}
              >
                {isPublished ? "Publié" : article.status === "scheduled" ? "Planifié" : "Brouillon"}
              </Badge>
              <Badge variant="outline" className={`text-[10px] px-1.5 py-0 gap-1 ${article.mode === "autopilot" ? "border-yellow-500/50 text-yellow-400" : ""}`}>
                {article.mode === "autopilot" ? <Zap className="w-3 h-3" /> : article.mode === "auto" ? <Bot className="w-3 h-3" /> : <PenLine className="w-3 h-3" />}
                {article.mode === "autopilot" ? "Autopilot" : article.mode === "auto" ? "Auto" : "Perso"}
              </Badge>
            </div>

            <h3 className="font-display text-base font-semibold text-foreground truncate">{article.title}</h3>
            {article.excerpt && <p className="text-xs text-muted-foreground mt-1 truncate">{article.excerpt}</p>}

            <div className="flex items-center gap-3 mt-3">
              <span className="font-mono text-[10px] text-muted-foreground flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {article.scheduled_at
                  ? format(parseISO(article.scheduled_at), "dd MMM yyyy · HH:mm", { locale: fr })
                  : "—"}
              </span>
              {article.category && (
                <span className="text-[10px] text-muted-foreground bg-secondary px-2 py-0.5 rounded">
                  {article.category}
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-primary"
              onClick={() => setPreviewOpen(true)}
              title="Prévisualiser"
            >
              <Eye className="w-3.5 h-3.5" />
            </Button>
            {!isPublished && (
              <Button
                variant="emerald"
                size="sm"
                className="h-8 text-xs gap-1"
                onClick={handlePublishNow}
                disabled={updateArticle.isPending}
              >
                <Rocket className="w-3.5 h-3.5" />
                Publier
              </Button>
            )}
            {article.page_url ? (
              <a href={article.page_url} target="_blank" rel="noopener noreferrer">
                <Button variant="ghost" size="icon" className="h-8 w-8 text-primary">
                  <ExternalLink className="w-3.5 h-3.5" />
                </Button>
              </a>
            ) : (
              <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" disabled>
                <ExternalLink className="w-3.5 h-3.5" />
              </Button>
            )}
            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={handleDelete}>
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      </div>

      <ArticlePreviewModal
        article={article}
        site={site}
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
      />
    </>
  );
};

export default ArticleCard;
