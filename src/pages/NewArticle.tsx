import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Bot, PenLine, ArrowLeft, ArrowRight, CalendarDays, Sparkles, Loader2, Calendar, CheckCircle2, X, Edit3, Check, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSites, useCreateArticle } from "@/hooks/useData";
import { toast } from "sonner";
import {
  calculateScheduledDates,
  generateDatesForCount,
  formatDateFr,
  formatInterval,
  intervalToDays,
  INTERVAL_UNIT_LABELS,
  INTERVAL_UNIT_OPTIONS,
  PERIOD_LABELS,
  PERIOD_OPTIONS,
  type IntervalUnit,
  type PeriodUnit,
} from "@/lib/scheduling";

type Mode = "auto" | "custom" | "autopilot" | null;

/** For autopilot, compute a reasonable first-batch count based on interval */
function getAutopilotTopicCount(intervalValue: number, intervalUnit: IntervalUnit): number {
  const days = intervalToDays(intervalValue, intervalUnit);
  if (days <= 1) return 7;
  if (days <= 7) return 5;
  if (days <= 14) return 4;
  return 3;
}

const slugify = (text: string) =>
  text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

const GENERATE_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-article`;
const GENERATE_IMAGE_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-article-image`;
const GENERATE_TOPICS_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-topics`;

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

  if (buffer.trim()) {
    for (const raw of buffer.split("\n")) {
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

interface TopicItem {
  text: string;
  checked: boolean;
  editing: boolean;
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
  const [category, setCategory] = useState("");
  const [tone, setTone] = useState("");
  const [keywords, setKeywords] = useState("");

  // Batch planning
  const [intervalValue, setIntervalValue] = useState(1);
  const [intervalUnit, setIntervalUnit] = useState<IntervalUnit>("weeks");
  const [planCount, setPlanCount] = useState(3);
  const [planPeriod, setPlanPeriod] = useState<PeriodUnit>("month");

  // Topics state (auto step 3)
  const [topics, setTopics] = useState<TopicItem[]>([]);
  const [topicsLoading, setTopicsLoading] = useState(false);
  const [editingValue, setEditingValue] = useState("");

  // Batch generation state (auto step 4)
  const [batchGenerating, setBatchGenerating] = useState(false);
  const [batchProgress, setBatchProgress] = useState(0);
  const [batchTotal, setBatchTotal] = useState(0);
  const [batchCompleted, setBatchCompleted] = useState<string[]>([]);

  // Single article generation state (custom mode)
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedRaw, setGeneratedRaw] = useState("");
  const [generationDone, setGenerationDone] = useState(false);

  const selectedSiteData = sites.find((s) => s.id === selectedSite);
  const parsed = generationDone ? parseGeneratedContent(generatedRaw) : null;

  const validatedTopics = topics.filter((t) => t.checked);

  const isBatchMode = mode === "auto" || mode === "autopilot";

  const autopilotTopicCount = mode === "autopilot" ? getAutopilotTopicCount(intervalValue, intervalUnit) : 0;
  const frequencyLabel = formatInterval(intervalValue, intervalUnit);

  // Calculate scheduled dates based on validated topics count
  const scheduledDates = useMemo(() => {
    if (!isBatchMode) return [];
    const startDate = scheduledDate ? new Date(scheduledDate) : new Date();
    if (validatedTopics.length > 0) {
      return generateDatesForCount(validatedTopics.length, intervalValue, intervalUnit, startDate);
    }
    if (mode === "autopilot") {
      return generateDatesForCount(autopilotTopicCount, intervalValue, intervalUnit, startDate);
    }
    return calculateScheduledDates(intervalValue, intervalUnit, planCount, planPeriod, startDate);
  }, [mode, isBatchMode, intervalValue, intervalUnit, planCount, planPeriod, scheduledDate, validatedTopics.length, autopilotTopicCount]);

  // Step 3 auto: fetch topics
  const handleGenerateTopics = async () => {
    setTopicsLoading(true);
    setTopics([]);
    try {
      const targetCount = mode === "autopilot" ? autopilotTopicCount : calculateScheduledDates(intervalValue, intervalUnit, planCount, planPeriod).length;
      const resp = await fetch(GENERATE_TOPICS_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          count: targetCount,
          siteName: selectedSiteData?.name || "",
          siteCity: selectedSiteData?.niche || "", // city not in DB yet, use niche as context
          siteDescription: selectedSiteData?.description || "",
          siteUrl: selectedSiteData?.url || "",
          siteNiche: selectedSiteData?.niche || "",
        }),
      });
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ error: "Erreur réseau" }));
        throw new Error(err.error || `Erreur ${resp.status}`);
      }
      const data = await resp.json();
      const fetchedTopics: string[] = data.topics || [];
      setTopics(fetchedTopics.map((t) => ({ text: t, checked: true, editing: false })));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erreur lors de la génération des sujets");
    } finally {
      setTopicsLoading(false);
    }
  };

  const toggleTopic = (idx: number) => {
    setTopics((prev) => prev.map((t, i) => i === idx ? { ...t, checked: !t.checked } : t));
  };

  const removeTopic = (idx: number) => {
    setTopics((prev) => prev.filter((_, i) => i !== idx));
  };

  const startEditTopic = (idx: number) => {
    setEditingValue(topics[idx].text);
    setTopics((prev) => prev.map((t, i) => i === idx ? { ...t, editing: true } : t));
  };

  const confirmEditTopic = (idx: number) => {
    setTopics((prev) => prev.map((t, i) => i === idx ? { ...t, text: editingValue.trim() || t.text, editing: false } : t));
  };

  const handleGenerateSingle = async () => {
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

  // Generate a single article for a given topic
  const generateOneArticle = async (topic: string): Promise<ReturnType<typeof parseGeneratedContent>> => {
    return new Promise((resolve, reject) => {
      let raw = "";
      streamArticle({
        body: {
          mode: mode || "auto",
          siteName: selectedSiteData?.name || "",
          siteNiche: selectedSiteData?.niche || "",
          siteDescription: selectedSiteData?.description || "",
          siteUrl: selectedSiteData?.url || "",
          category,
          topic,
        },
        onDelta: (chunk) => { raw += chunk; },
        onDone: () => resolve(parseGeneratedContent(raw)),
      }).catch(reject);
    });
  };

  const handleBatchGenerate = async () => {
    if (!selectedSite || validatedTopics.length === 0) return;

    setBatchGenerating(true);
    setBatchProgress(0);
    setBatchTotal(validatedTopics.length);
    setBatchCompleted([]);

    for (let i = 0; i < validatedTopics.length; i++) {
      try {
        setBatchProgress(i + 1);
        const content = await generateOneArticle(validatedTopics[i].text);
        const finalTitle = content.title || validatedTopics[i].text;

        await new Promise<void>((resolve, reject) => {
          createArticle.mutate(
            {
              site_id: selectedSite,
              title: finalTitle,
              slug: slugify(finalTitle),
              mode: mode || "auto",
              status: "scheduled",
              scheduled_at: scheduledDates[i]?.toISOString() || new Date().toISOString(),
              frequency: frequencyLabel,
              category: category || null,
              content: content.content || null,
              excerpt: content.excerpt || null,
            },
            {
              onSuccess: (data) => {
                setBatchCompleted((prev) => [...prev, finalTitle]);
                fetch(GENERATE_IMAGE_URL, {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
                  },
                  body: JSON.stringify({
                    articleId: data.id,
                    title: finalTitle,
                    siteName: selectedSiteData?.name || "",
                    siteNiche: selectedSiteData?.niche || "",
                  }),
                }).catch(() => {});
                resolve();
              },
              onError: (err) => reject(err),
            }
          );
        });
      } catch (e) {
        toast.error(`Erreur article ${i + 1}: ${e instanceof Error ? e.message : "Erreur"}`);
      }
    }

    setBatchGenerating(false);
    toast.success(`${validatedTopics.length} articles générés et planifiés !`);
    setTimeout(() => navigate("/articles"), 1500);
  };

  const handleCreateSingle = () => {
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
        frequency: "once",
        instructions: instructions || null,
        category: category || null,
        content: parsed?.content || null,
        excerpt: parsed?.excerpt || null,
        tone: tone || null,
        keywords: keywords ? keywords.split(",").map((k) => k.trim()) : null,
      },
      {
        onSuccess: (data) => {
          toast.success("Article planifié !");
          navigate("/articles");
          fetch(GENERATE_IMAGE_URL, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
            },
            body: JSON.stringify({
              articleId: data.id,
              title: finalTitle,
              siteName: selectedSiteData?.name || "",
              siteNiche: selectedSiteData?.niche || "",
            }),
          }).catch(() => {});
        },
        onError: () => toast.error("Erreur lors de la création"),
      }
    );
  };

  const goToStep3 = () => {
    setStep(3);
    if (isBatchMode) {
      handleGenerateTopics();
    } else if (mode === "custom" && !generatedRaw) {
      handleGenerateSingle();
    }
  };

  const goToStep4 = () => {
    if (validatedTopics.length === 0) return toast.error("Sélectionnez au moins un sujet");
    setStep(4);
  };

  const totalSteps = isBatchMode ? 4 : 3;

  return (
    <div className="p-8 max-w-3xl mx-auto space-y-8">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground">Nouvel Article</h1>
          <p className="font-mono text-xs text-muted-foreground mt-1">Étape {step} sur {totalSteps}</p>
        </div>
      </div>

      <div className="flex gap-2">
        {Array.from({ length: totalSteps }, (_, i) => i + 1).map((s) => (
          <div key={s} className={`h-1 flex-1 rounded-full transition-colors ${s <= step ? "bg-primary" : "bg-border"}`} />
        ))}
      </div>

      {/* Step 1: Mode */}
      {step === 1 && (
        <div className="space-y-4">
          <h2 className="font-display text-lg font-semibold text-foreground">Choisir le mode</h2>
          <div className="grid grid-cols-3 gap-4">
            {([
              { key: "autopilot" as const, icon: Zap, title: "Autopilote", desc: "Choisissez la fréquence, l'IA publie en continu. Mode campagne illimitée." },
              { key: "auto" as const, icon: Bot, title: "Campagne planifiée", desc: "Définissez une période et une fréquence. L'IA génère les sujets, vous validez." },
              { key: "custom" as const, icon: PenLine, title: "Article unique", desc: "Fournissez le sujet et les instructions. L'IA rédige un seul article." },
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

            {/* Batch planning: auto or autopilot */}
            {isBatchMode && (
              <div className="space-y-4 border border-primary/20 rounded-lg p-4 bg-primary/5">
                <div className="flex items-center gap-2 mb-1">
                  <Calendar className="w-4 h-4 text-primary" />
                  <span className="text-sm font-semibold text-foreground">
                    {mode === "autopilot" ? "Fréquence de publication" : "Planification automatique"}
                  </span>
                </div>

                {/* Shared frequency picker: "Tous les X jours/semaines/mois" */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-muted-foreground font-mono mb-1.5 block">Tous les</label>
                    <input
                      type="number"
                      min={1}
                      max={365}
                      value={intervalValue}
                      onChange={(e) => setIntervalValue(Math.max(1, parseInt(e.target.value) || 1))}
                      className="w-full bg-surface border border-border rounded-md px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground font-mono mb-1.5 block">Unité</label>
                    <select
                      value={intervalUnit}
                      onChange={(e) => setIntervalUnit(e.target.value as IntervalUnit)}
                      className="w-full bg-surface border border-border rounded-md px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                    >
                      {INTERVAL_UNIT_OPTIONS.map((u) => (
                        <option key={u} value={u}>{INTERVAL_UNIT_LABELS[u]}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {mode === "autopilot" ? (
                  <div className="text-xs text-primary font-mono mt-2">
                    → {frequencyLabel} · {autopilotTopicCount} sujets seront générés
                  </div>
                ) : (
                  /* Campaign mode: also pick a period */
                  <>
                    <div className="grid grid-cols-2 gap-3 mt-3">
                      <div>
                        <label className="text-xs text-muted-foreground font-mono mb-1.5 block">Pendant</label>
                        <input
                          type="number"
                          min={1}
                          max={365}
                          value={planCount}
                          onChange={(e) => setPlanCount(Math.max(1, parseInt(e.target.value) || 1))}
                          className="w-full bg-surface border border-border rounded-md px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground font-mono mb-1.5 block">Période</label>
                        <select
                          value={planPeriod}
                          onChange={(e) => setPlanPeriod(e.target.value as PeriodUnit)}
                          className="w-full bg-surface border border-border rounded-md px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                        >
                          {PERIOD_OPTIONS.map((p) => (
                            <option key={p} value={p}>{PERIOD_LABELS[p]}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {(() => {
                      const previewCount = calculateScheduledDates(intervalValue, intervalUnit, planCount, planPeriod).length;
                      return previewCount > 0 ? (
                        <div className="text-xs text-primary font-mono mt-2">
                          → {frequencyLabel} · {previewCount} sujet{previewCount > 1 ? "s" : ""} seront générés
                        </div>
                      ) : null;
                    })()}
                  </>
                )}
              </div>
            )}

            {/* Date for custom mode or start date for auto */}
            <div className={isBatchMode ? "" : "grid grid-cols-2 gap-4"}>
              <div>
                <label className="text-xs text-muted-foreground font-mono mb-1.5 block">
                  {isBatchMode ? "Date de début (optionnel, par défaut maintenant)" : "Date & heure"}
                </label>
                <input type="datetime-local" value={scheduledDate} onChange={(e) => setScheduledDate(e.target.value)} className="w-full bg-surface border border-border rounded-md px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
              </div>
              {!isBatchMode && (
                <div>
                  <label className="text-xs text-muted-foreground font-mono mb-1.5 block">Fréquence</label>
                  <select value="once" disabled className="w-full bg-surface border border-border rounded-md px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary">
                    <option value="once">Une seule fois</option>
                  </select>
                </div>
              )}
            </div>
          </div>

          <div className="flex justify-between">
            <Button variant="ghost" onClick={() => setStep(1)}><ArrowLeft className="w-4 h-4 mr-2" /> Retour</Button>
            <Button variant="emerald" disabled={!selectedSite} onClick={goToStep3} className="gap-2">
              {isBatchMode ? (
                <><Sparkles className="w-4 h-4" /> Générer les sujets</>
              ) : (
                <><Sparkles className="w-4 h-4" /> Générer l'article</>
              )}
            </Button>
          </div>
        </div>
      )}

      {/* Step 3 Auto: Topic review */}
      {step === 3 && isBatchMode && (
        <div className="space-y-6">
          <h2 className="font-display text-lg font-semibold text-foreground">
            {topicsLoading ? "Génération des sujets..." : "Valider les sujets"}
          </h2>

          {topicsLoading ? (
            <div className="bg-card border border-border rounded-lg p-8 flex flex-col items-center gap-4">
              <Loader2 className="w-8 h-8 text-primary animate-spin" />
              <p className="text-sm text-muted-foreground">L'IA analyse votre site et génère des sujets pertinents...</p>
            </div>
          ) : (
            <div className="bg-card border border-border rounded-lg p-6 space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground font-mono">
                  {validatedTopics.length} sujet{validatedTopics.length > 1 ? "s" : ""} sélectionné{validatedTopics.length > 1 ? "s" : ""} sur {topics.length}
                </p>
                <Button variant="ghost" size="sm" onClick={handleGenerateTopics} className="text-xs gap-1.5">
                  <Sparkles className="w-3 h-3" /> Régénérer
                </Button>
              </div>

              <div className="max-h-[400px] overflow-y-auto space-y-2 pr-1">
                {topics.map((topic, i) => (
                  <div
                    key={i}
                    className={`flex items-center gap-3 py-2.5 px-3 rounded-md border transition-colors ${
                      topic.checked ? "border-primary/30 bg-primary/5" : "border-border bg-muted/30"
                    }`}
                  >
                    <button
                      onClick={() => toggleTopic(i)}
                      className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${
                        topic.checked ? "border-primary bg-primary" : "border-muted-foreground/40"
                      }`}
                    >
                      {topic.checked && <Check className="w-3 h-3 text-primary-foreground" />}
                    </button>

                    {topic.editing ? (
                      <div className="flex-1 flex items-center gap-2">
                        <input
                          type="text"
                          value={editingValue}
                          onChange={(e) => setEditingValue(e.target.value)}
                          onKeyDown={(e) => e.key === "Enter" && confirmEditTopic(i)}
                          autoFocus
                          className="flex-1 bg-surface border border-primary/40 rounded px-2 py-1 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                        />
                        <button onClick={() => confirmEditTopic(i)} className="text-primary hover:text-primary/80">
                          <Check className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <>
                        <span className={`flex-1 text-sm ${topic.checked ? "text-foreground" : "text-muted-foreground line-through"}`}>
                          {topic.text}
                        </span>
                        <button onClick={() => startEditTopic(i)} className="text-muted-foreground hover:text-foreground shrink-0">
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => removeTopic(i)} className="text-muted-foreground hover:text-destructive shrink-0">
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </>
                    )}
                  </div>
                ))}
              </div>

              {validatedTopics.length > 0 && scheduledDates.length > 0 && (
                <div className="border-t border-border pt-4 text-xs text-muted-foreground font-mono">
                  <p className="text-primary font-semibold mb-2">
                    {validatedTopics.length} article{validatedTopics.length > 1 ? "s" : ""} seront générés et planifiés
                    {scheduledDates.length >= 2 && (
                      <> du {formatDateFr(scheduledDates[0])} au {formatDateFr(scheduledDates[scheduledDates.length - 1])}</>
                    )}
                  </p>
                  <div className="max-h-[150px] overflow-y-auto space-y-1">
                    {validatedTopics.map((topic, i) => (
                      <div key={i} className="flex items-center gap-2 py-1">
                        <CalendarDays className="w-3 h-3 text-muted-foreground shrink-0" />
                        <span className="truncate">{topic.text}</span>
                        <span className="ml-auto text-muted-foreground/70 shrink-0">
                          {scheduledDates[i] ? formatDateFr(scheduledDates[i]) : "—"}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="flex justify-between">
            <Button variant="ghost" onClick={() => setStep(2)}>
              <ArrowLeft className="w-4 h-4 mr-2" /> Modifier
            </Button>
            <Button variant="emerald" className="gap-2" disabled={validatedTopics.length === 0 || topicsLoading} onClick={goToStep4}>
              <ArrowRight className="w-4 h-4" />
              Lancer la rédaction ({validatedTopics.length} article{validatedTopics.length > 1 ? "s" : ""})
            </Button>
          </div>
        </div>
      )}

      {/* Step 4 Auto: Batch generation */}
      {step === 4 && isBatchMode && (
        <div className="space-y-6">
          <h2 className="font-display text-lg font-semibold text-foreground">
            {batchGenerating ? "Rédaction en cours..." : batchCompleted.length > 0 ? "Génération terminée !" : "Lancer la rédaction"}
          </h2>

          {!batchGenerating && batchCompleted.length === 0 && (
            <div className="bg-card border border-border rounded-lg p-6 space-y-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Calendar className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">
                    {validatedTopics.length} article{validatedTopics.length > 1 ? "s" : ""} seront rédigés et planifiés
                  </p>
                  {scheduledDates.length >= 2 && (
                    <p className="text-xs text-muted-foreground font-mono">
                      du {formatDateFr(scheduledDates[0])} au {formatDateFr(scheduledDates[scheduledDates.length - 1])}
                    </p>
                  )}
                </div>
              </div>

              <div className="border-t border-border pt-4 max-h-[300px] overflow-y-auto space-y-1.5">
                {validatedTopics.map((topic, i) => (
                  <div key={i} className="flex items-center gap-3 py-1.5 px-3 rounded-md bg-muted/50">
                    <span className="text-xs font-mono text-primary w-6 text-right">{i + 1}.</span>
                    <span className="text-sm text-foreground truncate flex-1">{topic.text}</span>
                    <span className="text-xs text-muted-foreground font-mono shrink-0">
                      {scheduledDates[i] ? formatDateFr(scheduledDates[i]) : "—"}
                    </span>
                  </div>
                ))}
              </div>

              <div className="flex justify-between pt-2">
                <Button variant="ghost" onClick={() => setStep(3)}>
                  <ArrowLeft className="w-4 h-4 mr-2" /> Modifier les sujets
                </Button>
                <Button variant="emerald" className="gap-2" onClick={handleBatchGenerate}>
                  <Sparkles className="w-4 h-4" />
                  Lancer la génération ({validatedTopics.length} articles)
                </Button>
              </div>
            </div>
          )}

          {(batchGenerating || batchCompleted.length > 0) && (
            <div className="bg-card border border-border rounded-lg p-6 space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between text-xs font-mono text-muted-foreground">
                  <span>Progression</span>
                  <span>{batchProgress} / {batchTotal}</span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary rounded-full transition-all duration-500"
                    style={{ width: `${(batchProgress / batchTotal) * 100}%` }}
                  />
                </div>
              </div>

              <div className="space-y-1.5 max-h-[300px] overflow-y-auto">
                {batchCompleted.map((title, i) => (
                  <div key={i} className="flex items-center gap-2 py-1.5 px-3 rounded-md bg-primary/5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-primary shrink-0" />
                    <span className="text-sm text-foreground truncate">{title}</span>
                    <span className="text-xs text-muted-foreground font-mono ml-auto shrink-0">
                      {scheduledDates[i] ? formatDateFr(scheduledDates[i]) : ""}
                    </span>
                  </div>
                ))}
                {batchGenerating && (
                  <div className="flex items-center gap-2 py-1.5 px-3 rounded-md bg-muted/50">
                    <Loader2 className="w-3.5 h-3.5 text-primary animate-spin shrink-0" />
                    <span className="text-sm text-muted-foreground">Rédaction : {validatedTopics[batchProgress - 1]?.text || `Article ${batchProgress}`}...</span>
                  </div>
                )}
              </div>

              {!batchGenerating && batchCompleted.length > 0 && (
                <div className="flex justify-end pt-2">
                  <Button variant="emerald" onClick={() => navigate("/articles")} className="gap-2">
                    <ArrowRight className="w-4 h-4" /> Voir les articles
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Step 3: Custom mode - single article preview */}
      {step === 3 && !isBatchMode && (
        <div className="space-y-6">
          <h2 className="font-display text-lg font-semibold text-foreground">
            {isGenerating ? "Génération en cours..." : "Aperçu & Confirmation"}
          </h2>

          <div className="bg-card border border-border rounded-lg p-6 space-y-4">
            <div className="flex items-center gap-3 text-xs text-muted-foreground font-mono">
              <div className="flex items-center gap-1.5">
                <CalendarDays className="w-4 h-4" />
                {scheduledDate || "Date non définie"}
              </div>
              <span>·</span>
              <span>Publication unique</span>
              <span>·</span>
              <span>{selectedSiteData?.name}</span>
            </div>

            <div className="border-t border-border pt-4">
              <div className="flex items-center gap-2 mb-4">
                {isGenerating ? (
                  <Loader2 className="w-4 h-4 text-primary animate-spin" />
                ) : (
                  <Sparkles className="w-4 h-4 text-primary" />
                )}
                <span className="text-xs text-primary font-mono">
                  {isGenerating ? "L'IA rédige votre article en temps réel..." : "Article personnalisé généré"}
                </span>
              </div>

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
                <Button variant="surface" onClick={handleGenerateSingle} className="gap-2">
                  <Sparkles className="w-4 h-4" /> Régénérer
                </Button>
              )}
              <Button
                variant="emerald"
                className="gap-2"
                onClick={handleCreateSingle}
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
