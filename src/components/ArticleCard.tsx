import { Article, getSiteName, getSiteColor } from "@/lib/mockData";
import { ExternalLink, Pencil, Trash2, Copy, Clock, Bot, PenLine } from "lucide-react";
import { format, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface ArticleCardProps {
  article: Article;
}

const ArticleCard = ({ article }: ArticleCardProps) => {
  const siteName = getSiteName(article.siteId);
  const siteColor = getSiteColor(article.siteId);
  const isPublished = article.status === "published";

  return (
    <div className="bg-card border border-border rounded-lg p-5 transition-all hover:border-primary/30 group">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: siteColor }} />
            <span className="font-mono text-xs text-muted-foreground">{siteName}</span>
            <Badge
              variant={isPublished ? "default" : "secondary"}
              className={`text-[10px] px-1.5 py-0 ${
                isPublished ? "bg-primary/15 text-primary border-primary/20" : "bg-amber/10 text-amber border-amber/20"
              }`}
            >
              {isPublished ? "Publié" : "Planifié"}
            </Badge>
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 gap-1">
              {article.mode === "auto" ? <Bot className="w-3 h-3" /> : <PenLine className="w-3 h-3" />}
              {article.mode === "auto" ? "Auto" : "Perso"}
            </Badge>
          </div>

          <h3 className="font-display text-base font-semibold text-foreground truncate">{article.title}</h3>
          <p className="text-xs text-muted-foreground mt-1 truncate">{article.excerpt}</p>

          <div className="flex items-center gap-3 mt-3">
            <span className="font-mono text-[10px] text-muted-foreground flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {article.scheduledAt
                ? format(parseISO(article.scheduledAt), "dd MMM yyyy · HH:mm", { locale: fr })
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
          {article.pageUrl ? (
            <a href={article.pageUrl} target="_blank" rel="noopener noreferrer">
              <Button variant="ghost" size="icon" className="h-8 w-8 text-primary">
                <ExternalLink className="w-3.5 h-3.5" />
              </Button>
            </a>
          ) : (
            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground cursor-not-allowed" disabled>
              <ExternalLink className="w-3.5 h-3.5" />
            </Button>
          )}
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <Pencil className="w-3.5 h-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <Copy className="w-3.5 h-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive">
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ArticleCard;
