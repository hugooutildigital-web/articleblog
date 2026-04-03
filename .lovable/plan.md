

## Plan : Sitemap dynamique + index DB

### 1. Migration SQL — Index composite
Créer un index sur `articles(status, site_id)` pour optimiser les requêtes du sitemap.

```sql
CREATE INDEX IF NOT EXISTS idx_articles_status_site_id ON public.articles (status, site_id);
```

### 2. Edge Function `supabase/functions/sitemap/index.ts`
- Accepte `?site_id=xxx` en query param (obligatoire)
- Requête `articles` (`status = 'published'`, filtre `site_id`) + jointure `sites` pour récupérer `url` et `blog_path`
- Génère un XML sitemap standard (`<urlset>`, `<url>`, `<loc>`, `<lastmod>`)
- `<lastmod>` = `published_at ?? created_at`
- Content-Type `application/xml`, CORS headers
- Pas de JWT requis (accès public pour crawlers)

### 3. `supabase/config.toml`
Ajouter :
```toml
[functions.sitemap]
verify_jwt = false
```

### 4. `public/robots.txt`
Pas de modification — le sitemap est par site client, pas pour le dashboard.

### 5. `src/pages/IntegrationGuide.tsx` — Mise à jour du prompt
Ajouter une section `=== 4. SITEMAP ===` au prompt généré avec :
- L'URL du sitemap dynamique : `${SUPABASE_URL}/functions/v1/sitemap?site_id=${siteId}`
- Instructions pour ajouter `Sitemap: <url>` dans le `robots.txt` du site client
- Instructions pour ajouter une balise `<link rel="sitemap">` dans le `<head>` du site

Le prompt existant référence encore Pollinations.ai pour les images (lignes 35-36, 52-54) — on en profite pour nettoyer ces références obsolètes et les remplacer par un fallback gradient CSS cohérent avec ce qu'on a implémenté.

### Fichiers modifiés
- `supabase/functions/sitemap/index.ts` (nouveau)
- `supabase/config.toml` (ajout section)
- `src/pages/IntegrationGuide.tsx` (ajout section sitemap + nettoyage Pollinations)
- Migration SQL (index)

