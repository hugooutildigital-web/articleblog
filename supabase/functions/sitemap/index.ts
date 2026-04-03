import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const EMPTY_SITEMAP = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
</urlset>`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const xmlHeaders = {
    ...corsHeaders,
    "Content-Type": "application/xml; charset=utf-8",
  };

  try {
    const url = new URL(req.url);
    const siteId = url.searchParams.get("site_id");

    if (!siteId) {
      return new Response(EMPTY_SITEMAP, { headers: xmlHeaders });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: site, error: siteError } = await supabase
      .from("sites")
      .select("url, blog_path")
      .eq("id", siteId)
      .single();

    if (siteError || !site) {
      return new Response(EMPTY_SITEMAP, { headers: xmlHeaders });
    }

    const { data: articles, error: articlesError } = await supabase
      .from("articles")
      .select("slug, published_at, created_at, updated_at")
      .eq("site_id", siteId)
      .eq("status", "published")
      .order("published_at", { ascending: false });

    if (articlesError) {
      return new Response(EMPTY_SITEMAP, { headers: xmlHeaders });
    }

    const baseUrl = site.url.replace(/\/$/, "");
    const blogPath = site.blog_path.replace(/\/$/, "");

    const urls = (articles ?? []).map((article) => {
      const lastmod = (article.published_at ?? article.created_at).split("T")[0];
      const loc = `${baseUrl}${blogPath}/${article.slug}`;
      return `  <url>
    <loc>${escapeXml(loc)}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.7</priority>
  </url>`;
    });

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.join("\n")}
</urlset>`;

    return new Response(xml, {
      headers: {
        ...xmlHeaders,
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch {
    return new Response(EMPTY_SITEMAP, { headers: xmlHeaders });
  }
});

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
