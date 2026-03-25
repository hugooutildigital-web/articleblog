import { useParams, Link } from "react-router-dom";
import { useAllArticles, useSites } from "@/hooks/useData";
import { format, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import { ArrowLeft, Calendar, Clock, Tag, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useMemo, useState } from "react";

const estimateReadTime = (content: string | null) => {
  if (!content) return 3;
  const words = content.replace(/<[^>]*>/g, "").split(/\s+/).length;
  return Math.max(1, Math.round(words / 200));
};

const BlogArticle = () => {
  const { slug } = useParams<{ slug: string }>();
  const [heroError, setHeroError] = useState(false);
  const { data: articles = [], isLoading } = useAllArticles();
  const { data: sites = [] } = useSites();

  const article = articles.find((a) => a.slug === slug);
  const site = article ? sites.find((s) => s.id === article.site_id) : null;

  const { firstHalf, secondHalf } = useMemo(() => {
    if (!article?.content) return { firstHalf: "", secondHalf: "" };
    const content = article.content;

    // Split roughly in half at a paragraph boundary
    const paragraphs = content.split(/(<\/p>|<\/h[23]>|<\/ul>|<\/ol>|<\/blockquote>)/gi);
    const full = [];
    for (let i = 0; i < paragraphs.length; i += 2) {
      full.push((paragraphs[i] || "") + (paragraphs[i + 1] || ""));
    }

    const mid = Math.ceil(full.length / 2);
    return {
      firstHalf: full.slice(0, mid).join(""),
      secondHalf: full.slice(mid).join(""),
    };
  }, [article?.content]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground font-mono animate-pulse">Chargement...</p>
      </div>
    );
  }

  if (!article) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4">
        <p className="text-muted-foreground text-lg">Article introuvable</p>
        <Link to="/blog">
          <Button variant="outline">
            <ArrowLeft className="w-4 h-4 mr-2" /> Retour au blog
          </Button>
        </Link>
      </div>
    );
  }

  const readTime = estimateReadTime(article.content);
  const heroImage = article.image_url || getImageUrl(article.title);
  const midImage = getMidImageUrl(`${article.title} ${article.category || ""}`);

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Image */}
      <div className="relative w-full h-[450px] overflow-hidden">
        <img
          src={heroImage}
          alt={article.title}
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent" />

        {/* Back button */}
        <div className="absolute top-6 left-6 z-10">
          <Link to="/blog">
            <Button variant="surface" size="sm" className="gap-1.5 backdrop-blur-sm">
              <ArrowLeft className="w-4 h-4" /> Blog
            </Button>
          </Link>
        </div>

        {/* Title overlay */}
        <div className="absolute bottom-0 left-0 right-0 px-6 pb-10">
          <div className="max-w-[750px] mx-auto">
            {article.category && (
              <span className="inline-block text-xs font-medium px-3 py-1 rounded-full bg-primary text-primary-foreground mb-4">
                {article.category}
              </span>
            )}
            <h1 className="font-display text-3xl md:text-4xl lg:text-5xl font-bold text-foreground leading-tight">
              {article.title}
            </h1>
          </div>
        </div>
      </div>

      {/* Metadata bar */}
      <div className="border-b border-border bg-card/30 backdrop-blur-sm">
        <div className="max-w-[750px] mx-auto px-6 py-4 flex flex-wrap items-center gap-4 md:gap-6 text-sm text-muted-foreground">
          <span className="flex items-center gap-1.5 font-mono text-xs">
            <Calendar className="w-3.5 h-3.5" />
            {format(parseISO(article.published_at || article.created_at), "dd MMMM yyyy", { locale: fr })}
          </span>
          <span className="flex items-center gap-1.5 font-mono text-xs">
            <Clock className="w-3.5 h-3.5" />
            {readTime} min de lecture
          </span>
          {article.category && (
            <span className="flex items-center gap-1.5 font-mono text-xs">
              <Tag className="w-3.5 h-3.5" />
              {article.category}
            </span>
          )}
          {site && (
            <span className="flex items-center gap-1.5 font-mono text-xs">
              <User className="w-3.5 h-3.5" />
              {site.name}
            </span>
          )}
        </div>
      </div>

      {/* Article Content */}
      <article className="max-w-[750px] mx-auto px-6 py-12">
        {/* Excerpt / Lead */}
        {article.excerpt && (
          <p className="text-xl text-foreground/80 leading-relaxed mb-10 font-display italic border-l-2 border-primary pl-6">
            {article.excerpt}
          </p>
        )}

        {/* First half of content */}
        {firstHalf && (
          <div
            className="prose-blog"
            dangerouslySetInnerHTML={{ __html: firstHalf }}
          />
        )}

        {/* Mid-article illustration */}
        {secondHalf && (
          <figure className="my-12 -mx-6 md:mx-0 rounded-xl overflow-hidden">
            <img
              src={midImage}
              alt={`Illustration pour ${article.title}`}
              className="w-full h-auto object-cover rounded-xl"
              loading="lazy"
            />
            <figcaption className="text-center text-xs text-muted-foreground mt-3 font-mono">
              Illustration générée pour cet article
            </figcaption>
          </figure>
        )}

        {/* Second half of content */}
        {secondHalf && (
          <div
            className="prose-blog"
            dangerouslySetInnerHTML={{ __html: secondHalf }}
          />
        )}

        {/* Keywords */}
        {article.keywords && article.keywords.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-12 pt-6 border-t border-border">
            {article.keywords.map((kw) => (
              <span
                key={kw}
                className="text-xs font-mono px-3 py-1 rounded-full bg-secondary text-secondary-foreground"
              >
                #{kw}
              </span>
            ))}
          </div>
        )}
      </article>

      {/* Company CTA */}
      <div className="border-t border-border bg-card/50">
        <div className="max-w-[750px] mx-auto px-6 py-12">
          <div className="bg-surface rounded-2xl p-8 flex flex-col md:flex-row items-center gap-6 border border-border">
            {/* Logo placeholder */}
            <div className="w-16 h-16 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
              <span className="font-display text-2xl font-bold text-primary">B</span>
            </div>
            <div className="flex-1 text-center md:text-left">
              <h3 className="font-display text-lg font-bold text-foreground">
                {site?.name ?? "SEO Sans Lesbienne"}
              </h3>
              <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
                {site?.description ?? "Publication automatisée d'articles de blog de qualité professionnelle, propulsée par l'intelligence artificielle."}
              </p>
            </div>
            {site?.url && (
              <a href={site.url} target="_blank" rel="noopener noreferrer">
                <Button variant="emerald" className="shrink-0">
                  Visiter le site
                </Button>
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default BlogArticle;
