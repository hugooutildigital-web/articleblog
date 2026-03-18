import { articles, getSiteColor, getSiteName } from "@/lib/mockData";
import { format, addDays, isSameDay, parseISO } from "date-fns";
import { fr } from "date-fns/locale";

const TimelineStrip = () => {
  const today = new Date();
  const days = Array.from({ length: 14 }, (_, i) => addDays(today, i));

  const scheduled = articles.filter((a) => a.status === "scheduled" && a.scheduledAt);

  return (
    <div className="bg-card border border-border rounded-lg p-5">
      <h3 className="font-display text-sm font-semibold text-foreground mb-4">
        Publications à venir — 14 jours
      </h3>
      <div className="flex gap-2 overflow-x-auto pb-2">
        {days.map((day) => {
          const dayArticles = scheduled.filter(
            (a) => a.scheduledAt && isSameDay(parseISO(a.scheduledAt), day)
          );
          const isToday = isSameDay(day, today);

          return (
            <div
              key={day.toISOString()}
              className={`shrink-0 w-20 rounded-md border p-2 text-center transition-colors ${
                isToday
                  ? "border-primary/50 bg-primary/5"
                  : "border-border bg-surface hover:bg-surface-hover"
              }`}
            >
              <p className="font-mono text-[10px] text-muted-foreground uppercase">
                {format(day, "EEE", { locale: fr })}
              </p>
              <p className={`font-mono text-sm font-medium ${isToday ? "text-primary" : "text-foreground"}`}>
                {format(day, "dd")}
              </p>
              <div className="flex justify-center gap-1 mt-2 min-h-[8px]">
                {dayArticles.map((a) => (
                  <div
                    key={a.id}
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: getSiteColor(a.siteId) }}
                    title={`${a.title} — ${getSiteName(a.siteId)}`}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default TimelineStrip;
