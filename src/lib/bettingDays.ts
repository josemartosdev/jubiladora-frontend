import type {
  BettingDailyDay,
  BettingDailyPick,
  BettingDayMatch,
  WorldCupCalendar,
} from "../api/client";
import { formatMatchDateEs } from "./datetimeEs";
import { isWorldCupTournament } from "./worldCup";

function fixtureToDayMatch(f: {
  id: number;
  home_team: string;
  away_team: string;
  date: string;
  kickoff_at?: string | null;
  tournament?: string | null;
  round?: string | null;
}): BettingDayMatch {
  return {
    match_id: f.id,
    home_team: f.home_team,
    away_team: f.away_team,
    date: f.date,
    kickoff_at: f.kickoff_at,
    tournament: f.tournament ?? null,
    round: f.round ?? null,
    selections_count: 0,
  };
}

/** Añade partidos del calendario WC a días sin datos de /betting/daily. */
export function mergeWorldCupMatchesIntoDays(
  days: BettingDailyDay[],
  wc: WorldCupCalendar,
  todayIso: string,
  maxCalendarDays = 7,
): BettingDailyDay[] {
  const dayMap = new Map<string, BettingDailyDay>(
    days.map((d) => [d.date, { ...d, matches: [...d.matches], picks: [...d.picks] }]),
  );

  const wcDays = wc.by_date
    .filter((d) => d.date >= todayIso && d.upcoming.length > 0)
    .slice(0, maxCalendarDays);

  for (const wcDay of wcDays) {
    const existing = dayMap.get(wcDay.date) ?? {
      date: wcDay.date,
      label: formatMatchDateEs(wcDay.date),
      matches: [],
      picks: [],
    };
    const byId = new Map(existing.matches.map((m) => [m.match_id, m]));
    for (const f of wcDay.upcoming) {
      if (!byId.has(f.id)) {
        byId.set(f.id, fixtureToDayMatch(f));
      }
    }
    existing.matches = [...byId.values()].sort((a, b) =>
      `${a.kickoff_at ?? ""}`.localeCompare(`${b.kickoff_at ?? ""}`),
    );
    existing.match_count = existing.matches.length;
    dayMap.set(wcDay.date, existing);
  }

  return [...dayMap.values()].sort((a, b) => a.date.localeCompare(b.date));
}

export function filterBettingDayWorldCup(day: BettingDailyDay): BettingDailyDay {
  const wcMatches = day.matches.filter((m) =>
    isWorldCupTournament(m.tournament, m.round),
  );
  const wcIds = new Set(wcMatches.map((m) => m.match_id));
  const picks = day.picks.filter((p) => wcIds.has(p.match_id));
  return {
    ...day,
    matches: wcMatches,
    match_count: wcMatches.length,
    picks,
  };
}

export function filterBettingDaysWorldCup(days: BettingDailyDay[]): BettingDailyDay[] {
  return days
    .map(filterBettingDayWorldCup)
    .filter((d) => d.picks.length > 0 || d.matches.length > 0);
}

export function picksOnDate(
  picks: BettingDailyPick[] | undefined,
  date: string,
): BettingDailyPick[] {
  const day = date.slice(0, 10);
  return (picks ?? []).filter((p) => !p.date || p.date.slice(0, 10) === day);
}

/** Días con partidos o picks, desde hoy. */
export function visibleBettingDays(
  days: BettingDailyDay[],
  todayIso: string,
): BettingDailyDay[] {
  return filterBettingDaysWorldCup(days).filter((d) => d.date >= todayIso);
}

export function initialBettingDayIndex(
  days: BettingDailyDay[],
  todayIso: string,
): number {
  if (days.length === 0) return 0;
  const todayIdx = days.findIndex((d) => d.date === todayIso);
  if (todayIdx >= 0) return todayIdx;
  const nextIdx = days.findIndex((d) => d.date > todayIso);
  return nextIdx >= 0 ? nextIdx : 0;
}

export function bestPickForDay(picks: BettingDailyPick[]): BettingDailyPick | null {
  if (picks.length === 0) return null;
  return [...picks].sort((a, b) => b.model_probability - a.model_probability)[0];
}
