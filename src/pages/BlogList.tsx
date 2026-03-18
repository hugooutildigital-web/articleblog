import { useAllArticles, useSites } from "@/hooks/useData";
import { Link } from "react-router-dom";
import { format, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import { ArrowRight, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";

const getImageUrl = (title: string, width = 800, height = 500) =>
  `https://image.pollinations.ai/prompt/${encodeURIComponent(title + ', professional photography, high quality')}?width=${width}&height=${height}&nologo=true`;

const BlogList = () => {
  const { data: articles = [], isLoading } = useAllArticles();
  const { data: sites = [] } = useSites();

  const published = articles.filter((a) => a.status === "published");

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto px-6 py-8">
          <h1 className="font-display text-4xl font-bold text-foreground">Blog</h1>
          <p className="text-muted-foreground mt-2 text-lg">
            Découvrez nos derniers articles et publications
          </p>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-6xl mx-auto px-6 py-10">
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-card rounded-xl border border-border animate-pulse">
                <div className="h-52 bg-muted rounded-t-xl" />
                <div className="p-5 space-y-3">
                  <div className="h-4 bg-muted rounded w-1/3" />
                  <div className="h-6 bg-muted rounded w-full" />
                  <div className="h-4 bg-muted rounded w-2/3" />
                </div>
              </div>
            ))}
          </div>
        ) : published.length === 0 ? (
          <div className="text-center py-20 text-muted-foreground">
            <p className="text-lg">Aucun article publié pour le moment.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {published.map((article) => {
              const site = sites.find((s) => s.id === article.site_id);
              const siteColor = site?.color ?? "#00e87a";

              return (
                <Link
                  key={article.id}
                  to={`/blog/${article.slug}`}
                  className="group bg-card rounded-xl border border-border overflow-hidden transition-all hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5"
                >
                  {/* Image */}
                  <div className="relative h-52 overflow-hidden">
                    <img
                      src={article.image_url || getImageUrl(article.title)}
                      alt={article.title}
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                      loading="lazy"
                    />
                    {article.category && (
                      <span
                        className="absolute top-3 left-3 text-xs font-medium px-2.5 py-1 rounded-full"
                        style={{ backgroundColor: siteColor, color: "#0f1117" }}
                      >
                        {article.category}
                      </span>
                    )}
                  </div>

                  {/* Content */}
                  <div className="p-5 space-y-3">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground font-mono">
                      <Calendar className="w-3 h-3" />
                      {article.published_at
                        ? format(parseISO(article.published_at), "dd MMMM yyyy", { locale: fr })
                        : "—"}
                      {site && (
                        <>
                          <span className="text-border">·</span>
                          <span>{site.name}</span>
                        </>
                      )}
                    </div>

                    <h2 className="font-display text-lg font-bold text-foreground leading-snug line-clamp-2 group-hover:text-primary transition-colors">
                      {article.title}
                    </h2>

                    {article.excerpt && (
                      <p className="text-sm text-muted-foreground line-clamp-2 leading-relaxed">
                        {article.excerpt}
                      </p>
                    )}

                    <div className="flex items-center gap-1 text-primary text-sm font-medium pt-1">
                      Lire l'article
                      <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
};

export default BlogList;
