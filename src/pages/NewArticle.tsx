import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bot, PenLine, ArrowLeft, ArrowRight, CalendarDays, Sparkles, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSites, useCreateArticle } from "@/hooks/useData";
import { toast } from "sonner";

type Mode = "auto" | "custom" | null;

const slugify = (text: string) =>
  text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

const GENERATE_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-article`;
const GENERATE_IMAGE_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-article-image`;

async function streamArticle({
  body,
  onDelta,
  onDone,
}: {
  body: Record<string, unknown>;
  onDelta: (text: string) => void;
  onDone: () => void;
}) {
  const resp = await fetch(GENERATE_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
    },
    body: JSON.stringify(body),
  });

  if (!resp.ok) {
    const err = await resp.json().catch(() => ({ error: "Erreur réseau" }));
    throw new Error(err.error || `Erreur ${resp.status}`);
  }

  if (!resp.body) throw new Error("Pas de réponse streaming");

  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let done = false;

  while (!done) {
    const { done: readerDone, value } = await reader.read();
    if (readerDone) break;
    buffer += decoder.decode(value, { stream: true });

    let newlineIndex: number;
    while ((newlineIndex = buffer.indexOf("\n")) !== -1) {
      let line = buffer.slice(0, newlineIndex);
      buffer = buffer.slice(newlineIndex + 1);

      if (line.endsWith("\r")) line = line.slice(0, -1);
      if (line.startsWith(":") || line.trim() === "") continue;
      if (!line.startsWith("data: ")) continue;

      const jsonStr = line.slice(6).trim();
      if (jsonStr === "[DONE]") { done = true; break; }

      try {
        const parsed = JSON.parse(jsonStr);
        const content = parsed.choices?.[0]?.delta?.content as string | undefined;
        if (content) onDelta(content);
      } catch {
        buffer = line + "\n" + buffer;
        break;
      }
    }
  }

  // Flush remaining
  if (buffer.trim()) {
    for (let raw of buffer.split("\n")) {
      if (!raw || raw.startsWith(":") || raw.trim() === "") continue;
      if (!raw.startsWith("data: ")) continue;
      const jsonStr = raw.slice(6).trim();
      if (jsonStr === "[DONE]") continue;
      try {
        const parsed = JSON.parse(jsonStr);
        const content = parsed.choices?.[0]?.delta?.content as string | undefined;
        if (content) onDelta(content);
      } catch { /* ignore */ }
    }
  }

  onDone();
}

function parseGeneratedContent(raw: string) {
  const titleMatch = raw.match(/TITRE:\s*(.+)/);
  const excerptMatch = raw.match(/EXTRAIT:\s*(.+)/);
  const contentMatch = raw.match(/CONTENU:\s*([\s\S]*)/);

  return {
    title: titleMatch?.[1]?.trim() || "",
    excerpt: excerptMatch?.[1]?.trim() || "",
    content: contentMatch?.[1]?.trim() || raw,
  };
}

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
  const [tone, setTone] = useState("");
  const [keywords, setKeywords] = useState("");

  // AI generation state
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedRaw, setGeneratedRaw] = useState("");
  const [generationDone, setGenerationDone] = useState(false);

  const selectedSiteData = sites.find((s) => s.id === selectedSite);
  const parsed = generationDone ? parseGeneratedContent(generatedRaw) : null;

  const handleGenerate = async () => {
    setIsGenerating(true);
    setGeneratedRaw("");
    setGenerationDone(false);

    try {
      await streamArticle({
        body: {
          mode,
          siteName: selectedSiteData?.name || "",
          siteNiche: selectedSiteData?.niche || "",
          siteDescription: selectedSiteData?.description || "",
          siteUrl: selectedSiteData?.url || "",
          title,
          instructions,
          tone,
          keywords,
          category,
        },
        onDelta: (chunk) => setGeneratedRaw((prev) => prev + chunk),
        onDone: () => {
          setIsGenerating(false);
          setGenerationDone(true);
        },
      });
    } catch (e) {
      setIsGenerating(false);
      toast.error(e instanceof Error ? e.message : "Erreur lors de la génération");
    }
  };

  const handleCreate = () => {
    if (!selectedSite) return toast.error("Sélectionnez un site");
    const finalTitle = parsed?.title || title || "Article auto-généré";

    createArticle.mutate(
      {
        site_id: selectedSite,
        title: finalTitle,
        slug: slugify(finalTitle),
        mode: mode ?? "custom",
        status: scheduledDate ? "scheduled" : "draft",
        scheduled_at: scheduledDate ? new Date(scheduledDate).toISOString() : null,
        frequency,
        instructions: instructions || null,
        category: category || null,
        content: parsed?.content || null,
        excerpt: parsed?.excerpt || null,
        tone: tone || null,
        keywords: keywords ? keywords.split(",").map((k) => k.trim()) : null,
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

  const goToStep3 = () => {
    setStep(3);
    if (!generatedRaw) handleGenerate();
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

      {/* Step 1: Mode */}
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

      {/* Step 2: Settings */}
      {step === 2 && (
        <div className="space-y-6">
          <h2 className="font-display text-lg font-semibold text-foreground">Paramètres</h2>
          <div className="space-y-4">
            <div>
              <label className="text-xs text-muted-foreground font-mono mb-1.5 block">Site Lovable cible</label>
              <select value={selectedSite} onChange={(e) => setSelectedSite(e.target.value)} className="w-full bg-surface border border-border rounded-md px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary">
                <option value="">Sélectionner un site...</option>
                {sites.map((s) => <option key={s.id} value={s.id}>{s.name} — {s.url}</option>)}
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
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs text-muted-foreground font-mono mb-1.5 block">Ton</label>
                    <input type="text" value={tone} onChange={(e) => setTone(e.target.value)} placeholder="Professionnel, décontracté..." className="w-full bg-surface border border-border rounded-md px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary" />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground font-mono mb-1.5 block">Mots-clés (virgules)</label>
                    <input type="text" value={keywords} onChange={(e) => setKeywords(e.target.value)} placeholder="seo, marketing, blog..." className="w-full bg-surface border border-border rounded-md px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary" />
                  </div>
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
            <Button variant="emerald" disabled={!selectedSite} onClick={goToStep3} className="gap-2">
              <Sparkles className="w-4 h-4" /> Générer l'article
            </Button>
          </div>
        </div>
      )}

      {/* Step 3: AI Generation & Preview */}
      {step === 3 && (
        <div className="space-y-6">
          <h2 className="font-display text-lg font-semibold text-foreground">
            {isGenerating ? "Génération en cours..." : "Aperçu & Confirmation"}
          </h2>

          <div className="bg-card border border-border rounded-lg p-6 space-y-4">
            {/* Meta info */}
            <div className="flex items-center gap-3 text-xs text-muted-foreground font-mono">
              <div className="flex items-center gap-1.5">
                <CalendarDays className="w-4 h-4" />
                {scheduledDate || "Date non définie"}
              </div>
              <span>·</span>
              <span>{frequency === "once" ? "Publication unique" : `Récurrent (${frequency})`}</span>
              <span>·</span>
              <span>{selectedSiteData?.name}</span>
            </div>

            <div className="border-t border-border pt-4">
              {/* Generation indicator */}
              <div className="flex items-center gap-2 mb-4">
                {isGenerating ? (
                  <Loader2 className="w-4 h-4 text-primary animate-spin" />
                ) : (
                  <Sparkles className="w-4 h-4 text-primary" />
                )}
                <span className="text-xs text-primary font-mono">
                  {isGenerating
                    ? "L'IA rédige votre article en temps réel..."
                    : mode === "auto"
                    ? "Article généré automatiquement"
                    : "Article personnalisé généré"}
                </span>
              </div>

              {/* Streaming content */}
              {generatedRaw ? (
                <div className="space-y-3">
                  {parsed && generationDone ? (
                    <>
                      <h3 className="font-display text-xl font-bold text-foreground">{parsed.title}</h3>
                      {parsed.excerpt && (
                        <p className="text-sm text-muted-foreground italic border-l-2 border-primary/30 pl-3">
                          {parsed.excerpt}
                        </p>
                      )}
                      <div
                        className="prose prose-sm prose-invert max-w-none text-foreground/90 [&_h2]:font-display [&_h2]:text-foreground [&_h2]:text-lg [&_h2]:mt-6 [&_h2]:mb-2 [&_h3]:font-display [&_h3]:text-foreground [&_h3]:text-base [&_p]:leading-relaxed [&_strong]:text-foreground [&_ul]:text-foreground/80 [&_li]:text-foreground/80"
                        dangerouslySetInnerHTML={{ __html: parsed.content }}
                      />
                    </>
                  ) : (
                    <div className="font-mono text-sm text-foreground/80 whitespace-pre-wrap leading-relaxed">
                      {generatedRaw}
                      {isGenerating && <span className="inline-block w-2 h-4 bg-primary/70 animate-pulse-glow ml-0.5" />}
                    </div>
                  )}
                </div>
              ) : isGenerating ? (
                <div className="flex items-center gap-3 py-8 justify-center">
                  <Loader2 className="w-5 h-5 text-primary animate-spin" />
                  <span className="text-sm text-muted-foreground">Analyse du site et rédaction...</span>
                </div>
              ) : null}
            </div>
          </div>

          <div className="flex justify-between">
            <Button variant="ghost" onClick={() => setStep(2)}>
              <ArrowLeft className="w-4 h-4 mr-2" /> Retour
            </Button>
            <div className="flex gap-2">
              {generationDone && (
                <Button variant="surface" onClick={handleGenerate} className="gap-2">
                  <Sparkles className="w-4 h-4" /> Régénérer
                </Button>
              )}
              <Button
                variant="emerald"
                className="gap-2"
                onClick={handleCreate}
                disabled={createArticle.isPending || isGenerating || !generationDone}
              >
                <Sparkles className="w-4 h-4" />
                {createArticle.isPending ? "Création..." : "Planifier la publication"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default NewArticle;
