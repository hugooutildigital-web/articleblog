export interface SiteLovable {
  id: string;
  name: string;
  url: string;
  blogPath: string;
  description: string;
  niche: string;
  articlesCount: number;
  lastPublished: string | null;
  color: string;
}

export interface Article {
  id: string;
  siteId: string;
  title: string;
  slug: string;
  excerpt: string;
  mode: "auto" | "custom";
  status: "draft" | "scheduled" | "published";
  scheduledAt: string | null;
  publishedAt: string | null;
  pageUrl: string | null;
  category: string;
}

export const sites: SiteLovable[] = [
  {
    id: "1",
    name: "TechPulse",
    url: "https://techpulse.lovable.app",
    blogPath: "/blog",
    description: "Blog tech & innovation",
    niche: "Technology",
    articlesCount: 24,
    lastPublished: "2026-03-17",
    color: "hsl(152 100% 45%)",
  },
  {
    id: "2",
    name: "DesignLab",
    url: "https://designlab.lovable.app",
    blogPath: "/blog",
    description: "UI/UX et design moderne",
    niche: "Design",
    articlesCount: 18,
    lastPublished: "2026-03-16",
    color: "hsl(280 80% 60%)",
  },
  {
    id: "3",
    name: "StartupWeekly",
    url: "https://startupweekly.lovable.app",
    blogPath: "/articles",
    description: "Actualités startup & entrepreneuriat",
    niche: "Business",
    articlesCount: 31,
    lastPublished: "2026-03-18",
    color: "hsl(38 92% 50%)",
  },
];

export const articles: Article[] = [
  {
    id: "a1",
    siteId: "1",
    title: "L'avenir de l'IA générative en 2026",
    slug: "avenir-ia-generative-2026",
    excerpt: "Découvrez les tendances majeures de l'intelligence artificielle...",
    mode: "auto",
    status: "published",
    scheduledAt: "2026-03-15T09:00:00",
    publishedAt: "2026-03-15T09:00:00",
    pageUrl: "https://techpulse.lovable.app/blog/avenir-ia-generative-2026",
    category: "Intelligence Artificielle",
  },
  {
    id: "a2",
    siteId: "2",
    title: "10 principes de design minimaliste",
    slug: "principes-design-minimaliste",
    excerpt: "Le minimalisme n'est pas l'absence de design...",
    mode: "custom",
    status: "published",
    scheduledAt: "2026-03-14T14:00:00",
    publishedAt: "2026-03-14T14:02:00",
    pageUrl: "https://designlab.lovable.app/blog/principes-design-minimaliste",
    category: "Design",
  },
  {
    id: "a3",
    siteId: "1",
    title: "Web Components : le renouveau",
    slug: "web-components-renouveau",
    excerpt: "Les Web Components reviennent en force avec de nouvelles APIs...",
    mode: "auto",
    status: "scheduled",
    scheduledAt: "2026-03-20T10:00:00",
    publishedAt: null,
    pageUrl: null,
    category: "Développement",
  },
  {
    id: "a4",
    siteId: "3",
    title: "Lever des fonds en 2026 : guide complet",
    slug: "lever-fonds-2026-guide",
    excerpt: "Tout ce qu'il faut savoir pour réussir sa levée de fonds...",
    mode: "custom",
    status: "scheduled",
    scheduledAt: "2026-03-22T08:00:00",
    publishedAt: null,
    pageUrl: null,
    category: "Financement",
  },
  {
    id: "a5",
    siteId: "2",
    title: "Figma vs Framer : comparatif 2026",
    slug: "figma-vs-framer-2026",
    excerpt: "Quel outil de design choisir cette année...",
    mode: "auto",
    status: "scheduled",
    scheduledAt: "2026-03-25T11:00:00",
    publishedAt: null,
    pageUrl: null,
    category: "Outils",
  },
  {
    id: "a6",
    siteId: "3",
    title: "Les erreurs fatales des premiers entrepreneurs",
    slug: "erreurs-entrepreneurs",
    excerpt: "Évitez ces pièges courants lors du lancement...",
    mode: "custom",
    status: "scheduled",
    scheduledAt: "2026-03-28T09:00:00",
    publishedAt: null,
    pageUrl: null,
    category: "Entrepreneuriat",
  },
];

export const getSiteName = (siteId: string) => sites.find((s) => s.id === siteId)?.name ?? "Inconnu";
export const getSiteColor = (siteId: string) => sites.find((s) => s.id === siteId)?.color ?? "hsl(0 0% 50%)";
