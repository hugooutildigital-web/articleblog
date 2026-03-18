-- Create sites table
CREATE TABLE public.sites (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  blog_path TEXT NOT NULL DEFAULT '/blog',
  description TEXT,
  niche TEXT,
  color TEXT DEFAULT '#00e87a',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create articles table
CREATE TABLE public.articles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  site_id UUID NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  slug TEXT NOT NULL,
  content TEXT,
  excerpt TEXT,
  mode TEXT NOT NULL DEFAULT 'custom' CHECK (mode IN ('auto', 'custom')),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'scheduled', 'published')),
  category TEXT,
  image_url TEXT,
  keywords TEXT[],
  tone TEXT,
  instructions TEXT,
  scheduled_at TIMESTAMP WITH TIME ZONE,
  published_at TIMESTAMP WITH TIME ZONE,
  page_url TEXT,
  frequency TEXT DEFAULT 'once' CHECK (frequency IN ('once', 'daily', 'weekly', 'biweekly', 'monthly')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.sites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.articles ENABLE ROW LEVEL SECURITY;

-- Public read access (shared Supabase — external Lovable sites read articles)
CREATE POLICY "Anyone can read sites" ON public.sites FOR SELECT USING (true);
CREATE POLICY "Anyone can read articles" ON public.articles FOR SELECT USING (true);

-- Write access (BlogFlow app via anon key)
CREATE POLICY "Anon can insert sites" ON public.sites FOR INSERT WITH CHECK (true);
CREATE POLICY "Anon can update sites" ON public.sites FOR UPDATE USING (true);
CREATE POLICY "Anon can delete sites" ON public.sites FOR DELETE USING (true);

CREATE POLICY "Anon can insert articles" ON public.articles FOR INSERT WITH CHECK (true);
CREATE POLICY "Anon can update articles" ON public.articles FOR UPDATE USING (true);
CREATE POLICY "Anon can delete articles" ON public.articles FOR DELETE USING (true);

-- Indexes
CREATE INDEX idx_articles_site_id ON public.articles(site_id);
CREATE INDEX idx_articles_status ON public.articles(status);
CREATE INDEX idx_articles_scheduled_at ON public.articles(scheduled_at);
CREATE INDEX idx_articles_slug ON public.articles(slug);

-- Auto-update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_sites_updated_at
  BEFORE UPDATE ON public.sites
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_articles_updated_at
  BEFORE UPDATE ON public.articles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
