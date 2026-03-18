import { useState } from "react";
import { articles, getSiteName, getSiteColor } from "@/lib/mockData";
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addDays,
  isSameMonth,
  isSameDay,
  parseISO,
  addMonths,
  subMonths,
} from "date-fns";
import { fr } from "date-fns/locale";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

const Scheduler = () => {
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(monthStart);
  const calStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const calEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });

  const scheduled = articles.filter((a) => a.scheduledAt);

  const days: Date[] = [];
  let d = calStart;
  while (d <= calEnd) {
    days.push(d);
    d = addDays(d, 1);
  }

  const weekDays = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-foreground">Planificateur</h1>
        <p className="font-mono text-xs text-muted-foreground mt-1">
          Calendrier des publications automatiques
        </p>
      </div>

      <div className="bg-card border border-border rounded-lg overflow-hidden">
        {/* Month header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <Button variant="ghost" size="icon" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <h2 className="font-display text-lg font-semibold capitalize">
            {format(currentMonth, "MMMM yyyy", { locale: fr })}
          </h2>
          <Button variant="ghost" size="icon" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}>
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>

        {/* Weekday headers */}
        <div className="grid grid-cols-7 border-b border-border">
          {weekDays.map((wd) => (
            <div key={wd} className="p-2 text-center font-mono text-xs text-muted-foreground">
              {wd}
            </div>
          ))}
        </div>

        {/* Day cells */}
        <div className="grid grid-cols-7">
          {days.map((day) => {
            const dayArticles = scheduled.filter(
              (a) => a.scheduledAt && isSameDay(parseISO(a.scheduledAt), day)
            );
            const isCurrentMonth = isSameMonth(day, currentMonth);
            const isToday = isSameDay(day, new Date());

            return (
              <div
                key={day.toISOString()}
                className={`min-h-[90px] border-b border-r border-border p-2 transition-colors hover:bg-surface-hover ${
                  !isCurrentMonth ? "opacity-30" : ""
                }`}
              >
                <span
                  className={`font-mono text-xs inline-flex w-6 h-6 items-center justify-center rounded-full ${
                    isToday ? "bg-primary text-primary-foreground font-bold" : "text-muted-foreground"
                  }`}
                >
                  {format(day, "d")}
                </span>
                <div className="mt-1 space-y-1">
                  {dayArticles.map((a) => (
                    <div
                      key={a.id}
                      className="text-[10px] truncate rounded px-1.5 py-0.5 font-medium cursor-pointer"
                      style={{
                        backgroundColor: getSiteColor(a.siteId).replace(")", " / 0.15)").replace("hsl(", "hsl("),
                        color: getSiteColor(a.siteId),
                        borderLeft: `2px solid ${getSiteColor(a.siteId)}`,
                      }}
                      title={`${a.title} — ${getSiteName(a.siteId)}`}
                    >
                      {a.title}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default Scheduler;
