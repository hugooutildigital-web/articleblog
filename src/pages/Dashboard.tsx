import { FileText, CalendarCheck, Clock, Globe, Plus } from "lucide-react";
import { useNavigate } from "react-router-dom";
import StatCard from "@/components/StatCard";
import TimelineStrip from "@/components/TimelineStrip";
import ArticleCard from "@/components/ArticleCard";
import { Button } from "@/components/ui/button";
import { articles, sites } from "@/lib/mockData";

const Dashboard = () => {
  const navigate = useNavigate();
  const published = articles.filter((a) => a.status === "published");
  const scheduled = articles.filter((a) => a.status === "scheduled");
  const recent = [...articles].sort((a, b) => {
    const da = a.publishedAt || a.scheduledAt || "";
    const db = b.publishedAt || b.scheduledAt || "";
    return db.localeCompare(da);
  }).slice(0, 3);

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

      <div className="grid grid-cols-4 gap-4">
        <StatCard label="Articles publiés" value={published.length} icon={FileText} accent />
        <StatCard label="Planifiés" value={scheduled.length} icon={CalendarCheck} />
        <StatCard label="En attente" value={0} icon={Clock} />
        <StatCard label="Sites connectés" value={sites.length} icon={Globe} />
      </div>

      <TimelineStrip />

      <div>
        <h2 className="font-display text-lg font-semibold text-foreground mb-4">Activité récente</h2>
        <div className="space-y-3">
          {recent.map((article) => (
            <ArticleCard key={article.id} article={article} />
          ))}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
