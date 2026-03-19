SEO Sans Lesbienne SaaS - blog automation dashboard. Architecture: shared Supabase + Make.com webhooks.

## Design System
- Background: #0f1117 (HSL 228 30% 7%)
- Accent: #00e87a emerald (HSL 152 100% 45%)
- Fonts: Playfair Display (headings), DM Mono (metadata), Inter (body)
- Dark editorial newsroom aesthetic, subtle grid background

## Branding
- Name: "SEO Sans Lesbienne" (NOT BlogFlow)
- Tagline: "automation engine"
- Sidebar logo: "SEO" in primary, " Sans Lesbienne" in foreground

## Architecture
- Shared Supabase: SEO Sans Lesbienne writes, Lovable sites read
- Make.com webhook triggers writes at scheduled times
- Tables: sites, articles (with RLS - public read, open write)
- No auth yet (intentionally open for shared access)

## Database
- sites: id, name, url, blog_path, description, niche, color, monthly_revenue
- articles: id, site_id, title, slug, content, excerpt, mode, status, category, image_url, keywords, tone, instructions, scheduled_at, published_at, page_url, frequency

## Hooks
- useData.ts: useSites, useArticles, useAllArticles, useCreateSite, useUpdateSite, useDeleteSite, useCreateArticle, useUpdateArticle, useDeleteArticle
