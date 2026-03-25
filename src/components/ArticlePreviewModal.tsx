import { useState } from "react";
import { X, Save, Edit3, Calendar, Globe, Tag, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useUpdateArticle, type Article, type Site } from "@/hooks/useData";
import { format, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import ArticleImage from "./ArticleImage";

interface ArticlePreviewModalProps {
  article: Article;
  site?: Site;
  open: boolean;
  onClose: () => void;
}

const ArticlePreviewModal = ({ article, site, open, onClose }: ArticlePreviewModalProps) => {
  const updateArticle = useUpdateArticle();
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(article.title);
  const [editExcerpt, setEditExcerpt] = useState(article.excerpt || "");
  const [editContent, setEditContent] = useState(article.content || "");
  const [editCategory, setEditCategory] = useState(article.category || "");

  if (!open) return null;

  const isPublished = article.status === "published";
  const isScheduled = article.status === "scheduled";
  const articleDate = article.published_at || article.scheduled_at || article.created_at;
  const siteColor = site?.color ?? "#00e87a";

  const handleSave = () => {
    updateArticle.mutate(
      {
        id: article.id,
        title: editTitle,
        excerpt: editExcerpt || null,
        content: editContent || null,
        category: editCategory || null,
      },
      {
        onSuccess: () => {
          toast.success("Article mis à jour !");
          setIsEditing(false);
        },
        onError: () => toast.error("Erreur lors de la sauvegarde"),
      }
    );
  };

  const startEditing = () => {
    setEditTitle(article.title);
    setEditExcerpt(article.excerpt || "");
    setEditContent(article.content || "");
    setEditCategory(article.category || "");
    setIsEditing(true);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative w-full max-w-4xl max-h-[90vh] mx-4 bg-card border border-border rounded-xl shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold shrink-0"
              style={{ backgroundColor: siteColor + "22", color: siteColor }}
            >
              {site?.name?.charAt(0) || "?"}
            </div>
            <div className="min-w-0">
              <p className="font-mono text-xs text-muted-foreground">{site?.name || "Site inconnu"}</p>
              <div className="flex items-center gap-2 mt-0.5">
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
                <span className="font-mono text-[10px] text-muted-foreground flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  {format(parseISO(articleDate), "dd MMM yyyy · HH:mm", { locale: fr })}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {isEditing ? (
              <>
                <Button variant="ghost" size="sm" className="text-xs" onClick={() => setIsEditing(false)}>
                  Annuler
                </Button>
                <Button
                  variant="emerald"
                  size="sm"
                  className="text-xs gap-1.5"
                  onClick={handleSave}
                  disabled={updateArticle.isPending}
                >
                  <Save className="w-3.5 h-3.5" />
                  {updateArticle.isPending ? "Sauvegarde..." : "Enregistrer"}
                </Button>
              </>
            ) : (
              <Button variant="surface" size="sm" className="text-xs gap-1.5" onClick={startEditing}>
                <Edit3 className="w-3.5 h-3.5" />
                Modifier
              </Button>
            )}
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose}>
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-6">
          {isEditing ? (
            <div className="space-y-5 max-w-3xl mx-auto">
              <div>
                <label className="text-xs text-muted-foreground font-mono mb-1.5 block">Titre</label>
                <input
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="w-full bg-surface border border-border rounded-md px-3 py-2.5 text-lg font-display font-bold text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div>
                <label className="text-xs text-muted-foreground font-mono mb-1.5 block">Extrait / Meta description</label>
                <textarea
                  value={editExcerpt}
                  onChange={(e) => setEditExcerpt(e.target.value)}
                  rows={2}
                  className="w-full bg-surface border border-border rounded-md px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary resize-none"
                />
              </div>

              <div>
                <label className="text-xs text-muted-foreground font-mono mb-1.5 block">Catégorie</label>
                <input
                  type="text"
                  value={editCategory}
                  onChange={(e) => setEditCategory(e.target.value)}
                  className="w-full bg-surface border border-border rounded-md px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div>
                <label className="text-xs text-muted-foreground font-mono mb-1.5 block">Contenu HTML</label>
                <textarea
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  rows={20}
                  className="w-full bg-surface border border-border rounded-md px-3 py-2.5 text-sm text-foreground font-mono focus:outline-none focus:ring-1 focus:ring-primary resize-y leading-relaxed"
                />
              </div>
            </div>
          ) : (
            <article className="max-w-3xl mx-auto">
              {/* Image */}
              {article.image_url && (
                <div className="rounded-lg overflow-hidden mb-6 border border-border">
                  <img
                    src={article.image_url}
                    alt={article.title}
                    className="w-full h-64 object-cover"
                  />
                </div>
              )}

              {/* Meta */}
              <div className="flex items-center gap-3 mb-4 flex-wrap">
                {article.category && (
                  <span className="text-xs font-medium text-foreground bg-muted px-2.5 py-1 rounded flex items-center gap-1">
                    <Tag className="w-3 h-3" />
                    {article.category}
                  </span>
                )}
                {article.mode && (
                  <span className="text-xs text-muted-foreground bg-muted/50 px-2 py-1 rounded flex items-center gap-1">
                    <Sparkles className="w-3 h-3" />
                    {article.mode === "auto" ? "Auto" : "Personnalisé"}
                  </span>
                )}
                {article.page_url && (
                  <a
                    href={article.page_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-primary hover:underline flex items-center gap-1"
                  >
                    <Globe className="w-3 h-3" />
                    Voir en ligne
                  </a>
                )}
              </div>

              {/* Title */}
              <h1 className="font-display text-2xl md:text-3xl font-bold text-foreground mb-4 leading-tight">
                {article.title}
              </h1>

              {/* Excerpt */}
              {article.excerpt && (
                <p className="text-sm text-muted-foreground italic border-l-2 border-primary/30 pl-4 mb-6">
                  {article.excerpt}
                </p>
              )}

              {/* Content */}
              {article.content ? (
                <div
                  className="prose prose-sm prose-invert max-w-none text-foreground/90
                    [&_h2]:font-display [&_h2]:text-foreground [&_h2]:text-xl [&_h2]:mt-8 [&_h2]:mb-3 [&_h2]:font-bold
                    [&_h3]:font-display [&_h3]:text-foreground [&_h3]:text-lg [&_h3]:mt-6 [&_h3]:mb-2
                    [&_p]:leading-relaxed [&_p]:mb-4
                    [&_strong]:text-foreground
                    [&_ul]:text-foreground/80 [&_li]:text-foreground/80
                    [&_a]:text-primary [&_a]:underline"
                  dangerouslySetInnerHTML={{ __html: article.content }}
                />
              ) : (
                <p className="text-sm text-muted-foreground text-center py-12">
                  Aucun contenu disponible pour cet article.
                </p>
              )}
            </article>
          )}
        </div>
      </div>
    </div>
  );
};

export default ArticlePreviewModal;
