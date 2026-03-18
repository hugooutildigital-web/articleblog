import { sites } from "@/lib/mockData";
import { Globe, ExternalLink, Plus, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { format, parseISO } from "date-fns";
import { fr } from "date-fns/locale";

const Sites = () => {
  return (
    <div className="p-8 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground">Sites Lovable</h1>
          <p className="font-mono text-xs text-muted-foreground mt-1">
            Gérer vos sites connectés
          </p>
        </div>
        <Button variant="emerald" className="gap-2">
          <Plus className="w-4 h-4" />
          Connecter un site
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {sites.map((site) => (
          <div
            key={site.id}
            className="bg-card border border-border rounded-lg p-5 transition-all hover:border-primary/30 group"
          >
            <div className="flex items-start gap-3 mb-4">
              <div
                className="w-10 h-10 rounded-md flex items-center justify-center text-sm font-bold shrink-0"
                style={{ backgroundColor: site.color + "22", color: site.color }}
              >
                {site.name.charAt(0)}
              </div>
              <div className="min-w-0">
                <h3 className="font-display text-base font-semibold text-foreground">{site.name}</h3>
                <a
                  href={site.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-mono text-xs text-primary hover:underline flex items-center gap-1"
                >
                  {site.url.replace("https://", "")}
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>

            <p className="text-xs text-muted-foreground mb-4">{site.description}</p>

            <div className="flex items-center justify-between text-xs text-muted-foreground border-t border-border pt-3">
              <span className="flex items-center gap-1">
                <FileText className="w-3 h-3" />
                {site.articlesCount} articles
              </span>
              <span className="font-mono">
                {site.lastPublished
                  ? format(parseISO(site.lastPublished), "dd MMM", { locale: fr })
                  : "—"}
              </span>
            </div>

            <div className="mt-3">
              <span className="text-[10px] bg-secondary text-secondary-foreground px-2 py-0.5 rounded">
                {site.niche}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Sites;
