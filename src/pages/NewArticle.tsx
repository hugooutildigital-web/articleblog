import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bot, PenLine, ArrowLeft, ArrowRight, CalendarDays, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSites, useCreateArticle } from "@/hooks/useData";
import { toast } from "sonner";

type Mode = "auto" | "custom" | null;

const slugify = (text: string) =>
  text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

const NewArticle = () => {
  const navigate = useNavigate();
  const { data: sites = [] } = useSites();
  const createArticle = useCreateArticle();
  const [step, setStep] = useState(1);
  const [mode, setMode] = useState<Mode>(null);
  const [selectedSite, setSelectedSite] = useState("");
  const [title, setTitle] = useState("");
  const [instructions, setInstructions] = useState("");
  const [scheduledDate, setScheduledDate] = useState("");
  const [frequency, setFrequency] = useState("once");
  const [category, setCategory] = useState("");

  const handleCreate = () => {
    if (!selectedSite) return toast.error("Sélectionnez un site");
    const articleTitle = title || "Article auto-généré";

    createArticle.mutate(
      {
        site_id: selectedSite,
        title: articleTitle,
        slug: slugify(articleTitle),
        mode: mode ?? "custom",
        status: scheduledDate ? "scheduled" : "draft",
        scheduled_at: scheduledDate ? new Date(scheduledDate).toISOString() : null,
        frequency,
        instructions: instructions || null,
        category: category || null,
        content: null,
        excerpt: null,
      },
      {
        onSuccess: () => {
          toast.success("Article planifié !");
          navigate("/articles");
        },
        onError: () => toast.error("Erreur lors de la création"),
      }
    );
  };

  return (
    <div className="p-8 max-w-3xl mx-auto space-y-8">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground">Nouvel Article</h1>
          <p className="font-mono text-xs text-muted-foreground mt-1">Étape {step} sur 3</p>
        </div>
      </div>

      <div className="flex gap-2">
        {[1, 2, 3].map((s) => (
          <div key={s} className={`h-1 flex-1 rounded-full transition-colors ${s <= step ? "bg-primary" : "bg-border"}`} />
        ))}
      </div>

      {step === 1 && (
        <div className="space-y-4">
          <h2 className="font-display text-lg font-semibold text-foreground">Choisir le mode</h2>
          <div className="grid grid-cols-2 gap-4">
            {([
              { key: "auto" as const, icon: Bot, title: "Mode Auto", desc: "BlogFlow analyse le site, génère les sujets et rédige les articles automatiquement." },
              { key: "custom" as const, icon: PenLine, title: "Mode Personnalisé", desc: "Fournissez le sujet, les instructions et le ton. L'IA rédige, vous validez." },
            ]).map((m) => (
              <button
                key={m.key}
                onClick={() => setMode(m.key)}
                className={`p-6 rounded-lg border text-left transition-all ${
                  mode === m.key ? "border-primary bg-primary/5 glow-emerald" : "border-border bg-card hover:border-primary/30"
                }`}
              >
                <m.icon className={`w-8 h-8 mb-3 ${mode === m.key ? "text-primary" : "text-muted-foreground"}`} />
                <h3 className="font-display text-base font-semibold text-foreground">{m.title}</h3>
                <p className="text-xs text-muted-foreground mt-2">{m.desc}</p>
              </button>
            ))}
          </div>
          <div className="flex justify-end">
            <Button variant="emerald" disabled={!mode} onClick={() => setStep(2)} className="gap-2">
              Suivant <ArrowRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-6">
          <h2 className="font-display text-lg font-semibold text-foreground">Paramètres</h2>
          <div className="space-y-4">
            <div>
              <label className="text-xs text-muted-foreground font-mono mb-1.5 block">Site Lovable cible</label>
              <select
                value={selectedSite}
                onChange={(e) => setSelectedSite(e.target.value)}
                className="w-full bg-surface border border-border rounded-md px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="">Sélectionner un site...</option>
                {sites.map((s) => (
                  <option key={s.id} value={s.id}>{s.name} — {s.url}</option>
                ))}
              </select>
            </div>

            {mode === "custom" && (
              <>
                <div>
                  <label className="text-xs text-muted-foreground font-mono mb-1.5 block">Titre ou sujet</label>
                  <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex: Les tendances SEO en 2026..." className="w-full bg-surface border border-border rounded-md px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground font-mono mb-1.5 block">Instructions / Brief</label>
                  <textarea value={instructions} onChange={(e) => setInstructions(e.target.value)} rows={4} placeholder="Décrivez ce que l'article doit couvrir..." className="w-full bg-surface border border-border rounded-md px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary resize-none" />
                </div>
              </>
            )}

            <div>
              <label className="text-xs text-muted-foreground font-mono mb-1.5 block">Catégorie (optionnel)</label>
              <input type="text" value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Ex: SEO, Design, Tech..." className="w-full bg-surface border border-border rounded-md px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary" />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-muted-foreground font-mono mb-1.5 block">Date & heure</label>
                <input type="datetime-local" value={scheduledDate} onChange={(e) => setScheduledDate(e.target.value)} className="w-full bg-surface border border-border rounded-md px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground font-mono mb-1.5 block">Fréquence</label>
                <select value={frequency} onChange={(e) => setFrequency(e.target.value)} className="w-full bg-surface border border-border rounded-md px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary">
                  <option value="once">Une seule fois</option>
                  <option value="daily">Quotidien</option>
                  <option value="weekly">Hebdomadaire</option>
                  <option value="biweekly">Bimensuel</option>
                  <option value="monthly">Mensuel</option>
                </select>
              </div>
            </div>
          </div>

          <div className="flex justify-between">
            <Button variant="ghost" onClick={() => setStep(1)}><ArrowLeft className="w-4 h-4 mr-2" /> Retour</Button>
            <Button variant="emerald" disabled={!selectedSite} onClick={() => setStep(3)} className="gap-2">Suivant <ArrowRight className="w-4 h-4" /></Button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-6">
          <h2 className="font-display text-lg font-semibold text-foreground">Aperçu & Confirmation</h2>
          <div className="bg-card border border-border rounded-lg p-6 space-y-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground font-mono">
              <CalendarDays className="w-4 h-4" />
              {scheduledDate || "Date non définie"} · {frequency === "once" ? "Publication unique" : `Récurrent (${frequency})`}
            </div>
            <div className="border-t border-border pt-4">
              <div className="flex items-center gap-2 mb-3">
                <Sparkles className="w-4 h-4 text-primary" />
                <span className="text-xs text-primary font-mono">
                  {mode === "auto" ? "Contenu généré automatiquement" : "Contenu personnalisé"}
                </span>
              </div>
              <h3 className="font-display text-xl font-bold text-foreground mb-2">{title || "Titre généré par l'IA"}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {mode === "auto"
                  ? "Le contenu sera généré automatiquement en analysant la niche du site sélectionné."
                  : instructions || "L'article sera rédigé par l'IA selon vos instructions."}
              </p>
            </div>
            <div className="border-t border-border pt-4 flex items-center gap-2 text-xs text-muted-foreground font-mono">
              Site cible : {sites.find((s) => s.id === selectedSite)?.name || "Non sélectionné"}
            </div>
          </div>

          <div className="flex justify-between">
            <Button variant="ghost" onClick={() => setStep(2)}><ArrowLeft className="w-4 h-4 mr-2" /> Retour</Button>
            <Button variant="emerald" className="gap-2" onClick={handleCreate} disabled={createArticle.isPending}>
              <Sparkles className="w-4 h-4" />
              {createArticle.isPending ? "Création..." : "Planifier la publication automatique"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default NewArticle;
