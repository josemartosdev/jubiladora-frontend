import type { ForecastDay, WorldCupCalendar } from "../api/client";
import { fixtureToPrediction } from "../api/client";
import { formatMatchDateEs } from "./datetimeEs";
import { filterWorldCupDays } from "./worldCup";

/** Solo días con partidos, desde hoy, máximo `maxDays` entradas de calendario. */
export function worldCupToForecastDays(
  wc: WorldCupCalendar,
  maxDays = 7,
): ForecastDay[] {
  const today = new Date().toISOString().slice(0, 10);
  return wc.by_date
    .filter((d) => d.date >= today && d.upcoming.length > 0)
    .slice(0, maxDays)
    .map((d) => ({
      date: d.date,
      label: formatMatchDateEs(d.date),
      count: d.upcoming.length,
      with_prediction: 0,
      items: d.upcoming.map(fixtureToPrediction),
    }));
}

export function filterDaysWithMatches(days: ForecastDay[]): ForecastDay[] {
  return filterWorldCupDays(days).filter((d) => d.count > 0 && d.items.length > 0);
}

export function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Índice del primer día >= hoy; si no hay, 0. */
export function initialDayIndex(days: ForecastDay[]): number {
  if (days.length === 0) return 0;
  const today = todayIso();
  const idx = days.findIndex((d) => d.date >= today);
  return idx >= 0 ? idx : 0;
}
