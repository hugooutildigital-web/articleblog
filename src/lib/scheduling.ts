import { addDays, addWeeks, addMonths, addYears, format } from "date-fns";
import { fr } from "date-fns/locale";

export type Frequency = "daily" | "weekly" | "biweekly" | "monthly";
export type PeriodUnit = "day" | "week" | "month" | "year";

const FREQUENCY_LABELS: Record<Frequency, string> = {
  daily: "Quotidien",
  weekly: "Hebdomadaire",
  biweekly: "Bimensuel",
  monthly: "Mensuel",
};

const PERIOD_LABELS: Record<PeriodUnit, string> = {
  day: "Jour(s)",
  week: "Semaine(s)",
  month: "Mois",
  year: "An(s)",
};

const FREQUENCY_OPTIONS: Frequency[] = ["daily", "weekly", "biweekly", "monthly"];
const PERIOD_OPTIONS: PeriodUnit[] = ["day", "week", "month", "year"];

/**
 * Calculate total duration in days for a given count + period unit.
 */
function periodToDays(count: number, unit: PeriodUnit): number {
  switch (unit) {
    case "day": return count;
    case "week": return count * 7;
    case "month": return count * 30;
    case "year": return count * 365;
  }
}

/**
 * Interval in days between articles for a given frequency.
 */
function frequencyIntervalDays(freq: Frequency): number {
  switch (freq) {
    case "daily": return 1;
    case "weekly": return 7;
    case "biweekly": return 14;
    case "monthly": return 30;
  }
}

/**
 * Calculate the list of scheduled dates for the batch.
 */
export function calculateScheduledDates(
  frequency: Frequency,
  count: number,
  periodUnit: PeriodUnit,
  startDate: Date = new Date()
): Date[] {
  if (count <= 0) return [];

  const totalDays = periodToDays(count, periodUnit);
  const intervalDays = frequencyIntervalDays(frequency);
  const articleCount = Math.max(1, Math.floor(totalDays / intervalDays));

  const dates: Date[] = [];
  let current = startDate;

  for (let i = 0; i < articleCount; i++) {
    dates.push(new Date(current));
    // Add interval based on frequency for more accurate date math
    switch (frequency) {
      case "daily":
        current = addDays(current, 1);
        break;
      case "weekly":
        current = addWeeks(current, 1);
        break;
      case "biweekly":
        current = addWeeks(current, 2);
        break;
      case "monthly":
        current = addMonths(current, 1);
        break;
    }
  }

  return dates;
}

export function formatDateFr(date: Date): string {
  return format(date, "dd MMM yyyy · HH:mm", { locale: fr });
}

export { FREQUENCY_LABELS, PERIOD_LABELS, FREQUENCY_OPTIONS, PERIOD_OPTIONS };
