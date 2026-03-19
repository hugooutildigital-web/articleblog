import { addDays, addWeeks, addMonths, addYears, format } from "date-fns";
import { fr } from "date-fns/locale";

export type IntervalUnit = "days" | "weeks" | "months";
export type PeriodUnit = "day" | "week" | "month" | "year";

const INTERVAL_UNIT_LABELS: Record<IntervalUnit, string> = {
  days: "jour(s)",
  weeks: "semaine(s)",
  months: "mois",
};

const INTERVAL_UNIT_OPTIONS: IntervalUnit[] = ["days", "weeks", "months"];

const PERIOD_LABELS: Record<PeriodUnit, string> = {
  day: "Jour(s)",
  week: "Semaine(s)",
  month: "Mois",
  year: "An(s)",
};

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
 * Interval in days for a custom interval.
 */
export function intervalToDays(value: number, unit: IntervalUnit): number {
  switch (unit) {
    case "days": return value;
    case "weeks": return value * 7;
    case "months": return value * 30;
  }
}

/**
 * Add interval to a date.
 */
function addInterval(date: Date, value: number, unit: IntervalUnit): Date {
  switch (unit) {
    case "days": return addDays(date, value);
    case "weeks": return addWeeks(date, value);
    case "months": return addMonths(date, value);
  }
}

/**
 * Format interval as human-readable French string.
 */
export function formatInterval(value: number, unit: IntervalUnit): string {
  if (value === 1) {
    switch (unit) {
      case "days": return "Tous les jours";
      case "weeks": return "Toutes les semaines";
      case "months": return "Tous les mois";
    }
  }
  return `Tous les ${value} ${INTERVAL_UNIT_LABELS[unit]}`;
}

/**
 * Calculate the list of scheduled dates for the batch.
 */
export function calculateScheduledDates(
  intervalValue: number,
  intervalUnit: IntervalUnit,
  periodCount: number,
  periodUnit: PeriodUnit,
  startDate: Date = new Date()
): Date[] {
  if (periodCount <= 0 || intervalValue <= 0) return [];

  const totalDays = periodToDays(periodCount, periodUnit);
  const gapDays = intervalToDays(intervalValue, intervalUnit);
  const articleCount = Math.max(1, Math.floor(totalDays / gapDays));

  const dates: Date[] = [];
  let current = startDate;

  for (let i = 0; i < articleCount; i++) {
    dates.push(new Date(current));
    current = addInterval(current, intervalValue, intervalUnit);
  }

  return dates;
}

/**
 * Generate N dates spaced by interval (for autopilot).
 */
export function generateDatesForCount(
  count: number,
  intervalValue: number,
  intervalUnit: IntervalUnit,
  startDate: Date = new Date()
): Date[] {
  const dates: Date[] = [];
  let current = startDate;
  for (let i = 0; i < count; i++) {
    dates.push(new Date(current));
    current = addInterval(current, intervalValue, intervalUnit);
  }
  return dates;
}

export function formatDateFr(date: Date): string {
  return format(date, "dd MMM yyyy · HH:mm", { locale: fr });
}

export { INTERVAL_UNIT_LABELS, INTERVAL_UNIT_OPTIONS, PERIOD_LABELS, PERIOD_OPTIONS };
