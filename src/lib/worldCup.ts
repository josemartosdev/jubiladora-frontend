import type {
  FixtureItem,
  ForecastDay,
  Prediction,
  WorldCupCalendar,
} from "../api/client";

const WC_ROUND_MARKERS = [
  "GROUP_STAGE",
  "LAST_32",
  "LAST_16",
  "QUARTER",
  "SEMI",
  "FINAL",
  "WORLD_CUP",
  "ROUND_OF",
];

/** Fases del cuadro del Mundial (calendario WC a veces sin nombre de torneo). */
export function isWorldCupRound(round: string | null | undefined): boolean {
  if (!round?.trim()) return false;
  const r = round.toUpperCase();
  return WC_ROUND_MARKERS.some((m) => r.includes(m));
}

/** Torneos que cuentan como Mundial 2026 (no ligas ni copas continentales). */
export function isWorldCupTournament(
  tournament: string | null | undefined,
  round?: string | null,
): boolean {
  if (isWorldCupRound(round)) return true;
  if (!tournament?.trim()) return false;
  const t = tournament.toLowerCase();
  // Clasificatorios históricos (Saarland, etc.) no cuentan como Mundial 2026.
  if (t.includes("qualif")) return false;
  if (t.includes("2026") || t.includes("wc 2026") || t.includes("wc2026")) {
    return (
      t.includes("world cup") ||
      t.includes("worldcup") ||
      t.includes("mundial") ||
      t.includes("fifa world")
    );
  }
  return (
    t === "fifa world cup" ||
    t === "world cup" ||
    t.includes("fifa world cup 20")
  );
}

export function isWorldCupPrediction(p: Prediction): boolean {
  return isWorldCupTournament(p.tournament);
}

export function isWorldCupFixture(f: FixtureItem): boolean {
  return isWorldCupTournament(f.tournament, f.round);
}

export function filterWorldCupPredictions(items: Prediction[]): Prediction[] {
  return items.filter(isWorldCupPrediction);
}

export function filterWorldCupDays(days: ForecastDay[]): ForecastDay[] {
  return days
    .map((d) => {
      const items = filterWorldCupPredictions(d.items);
      return {
        ...d,
        items,
        count: items.length,
        with_prediction: items.filter(
          (p) => p.has_prediction !== false && p.confidence > 0,
        ).length,
      };
    })
    .filter((d) => d.count > 0);
}

/** Partidos próximos del calendario oficial del Mundial (por días de calendario, no mezcla otras ligas). */
export function worldCupUpcomingFixtures(
  wc: WorldCupCalendar,
  maxCalendarDays = 7,
): FixtureItem[] {
  const today = new Date().toISOString().slice(0, 10);
  return wc.by_date
    .filter((d) => d.date >= today && d.upcoming.length > 0)
    .slice(0, maxCalendarDays)
    .flatMap((d) => d.upcoming);
}

export function bestWorldCupPick(items: Prediction[]): Prediction | null {
  const wc = filterWorldCupPredictions(items).filter(
    (p) => p.has_prediction !== false && p.confidence > 0,
  );
  if (wc.length === 0) return null;
  return [...wc].sort((a, b) => b.confidence - a.confidence)[0];
}
