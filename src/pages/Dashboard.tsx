import { FileText, CalendarCheck, Clock, Globe, Plus, DollarSign } from "lucide-react";
import { useNavigate } from "react-router-dom";
import StatCard from "@/components/StatCard";
import TimelineStrip from "@/components/TimelineStrip";
import ArticleCard from "@/components/ArticleCard";
import { Button } from "@/components/ui/button";
import { useAllArticles, useSites } from "@/hooks/useData";

const Dashboard = () => {
  const navigate = useNavigate();
  const { data: articles = [], isLoading: loadingArticles } = useAllArticles();
  const { data: sites = [], isLoading: loadingSites } = useSites();

  const published = articles.filter((a) => a.status === "published");
  const scheduled = articles.filter((a) => a.status === "scheduled");
  const drafts = articles.filter((a) => a.status === "draft");
  const recent = articles.slice(0, 3);

  const mrr = sites.reduce((sum, s) => sum + (Number((s as any).monthly_revenue) || 0), 0);

  if (loadingArticles || loadingSites) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[50vh]">
        <p className="text-muted-foreground font-mono text-sm animate-pulse">Chargement...</p>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground">Tableau de bord</h1>
          <p className="font-mono text-xs text-muted-foreground mt-1">Vue d'ensemble de votre automatisation</p>
        </div>
        <Button variant="emerald" className="gap-2" onClick={() => navigate("/new-article")}>
          <Plus className="w-4 h-4" />
          Nouvel Article
        </Button>
      </div>

      <div className="grid grid-cols-5 gap-4">
        <StatCard label="MRR" value={`${mrr.toFixed(0)}€`} icon={DollarSign} accent />
        <StatCard label="Articles publiés" value={published.length} icon={FileText} />
        <StatCard label="Planifiés" value={scheduled.length} icon={CalendarCheck} />
        <StatCard label="Brouillons" value={drafts.length} icon={Clock} />
        <StatCard label="Sites connectés" value={sites.length} icon={Globe} />
      </div>

      <TimelineStrip articles={scheduled} sites={sites} />

      <div>
        <h2 className="font-display text-lg font-semibold text-foreground mb-4">Activité récente</h2>
        <div className="space-y-3">
          {recent.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Aucun article pour le moment</p>
          ) : (
            recent.map((article) => (
              <ArticleCard key={article.id} article={article} sites={sites} />
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
