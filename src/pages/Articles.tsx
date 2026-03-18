import { useState } from "react";
import { useAllArticles, useSites } from "@/hooks/useData";
import ArticleCard from "@/components/ArticleCard";

const tabs = [
  { key: "published", label: "Publiés" },
  { key: "scheduled", label: "Planifiés" },
] as const;

const Articles = () => {
  const [activeTab, setActiveTab] = useState<"published" | "scheduled">("published");
  const { data: articles = [], isLoading } = useAllArticles();
  const { data: sites = [] } = useSites();

  const filtered = articles.filter((a) =>
    activeTab === "published" ? a.status === "published" : a.status === "scheduled"
  );

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-foreground">Articles</h1>
        <p className="font-mono text-xs text-muted-foreground mt-1">Gérer vos publications automatiques</p>
      </div>

      <div className="flex gap-1 bg-surface rounded-md p-1 w-fit">
        {tabs.map((tab) => {
          const count = articles.filter((a) =>
            tab.key === "published" ? a.status === "published" : a.status === "scheduled"
          ).length;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-2 rounded text-sm font-medium transition-all ${
                activeTab === tab.key
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab.label}
              <span className="ml-2 font-mono text-xs text-muted-foreground">{count}</span>
            </button>
          );
        })}
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground text-center py-16 animate-pulse font-mono">Chargement...</p>
      ) : (
        <div className="space-y-3">
          {filtered.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground text-sm">
              Aucun article {activeTab === "published" ? "publié" : "planifié"}
            </div>
          ) : (
            filtered.map((article) => <ArticleCard key={article.id} article={article} sites={sites} />)
          )}
        </div>
      )}
    </div>
  );
};

export default Articles;
