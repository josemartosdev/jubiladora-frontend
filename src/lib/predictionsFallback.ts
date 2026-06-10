import {
  fixtureToPrediction,
  getMatchPrediction,
  getWorldCupCalendar,
  type FixtureItem,
  type ForecastDay,
  type HomePredictionsResponse,
  type Prediction,
} from "../api/client";
import { formatMatchDateEs } from "./datetimeEs";
import {
  bestWorldCupPick,
  filterWorldCupPredictions,
  worldCupUpcomingFixtures,
} from "./worldCup";

const BATCH = 8;

function dedupeFixtures(fixtures: FixtureItem[]): FixtureItem[] {
  const byKey = new Map<string, FixtureItem>();
  for (const f of fixtures) {
    const key = `${f.date}|${f.home_team}|${f.away_team}`;
    const prev = byKey.get(key);
    if (!prev || f.source === "football_data") {
      byKey.set(key, f);
    }
  }
  return [...byKey.values()].sort((a, b) =>
    `${a.date}${a.kickoff_at}`.localeCompare(`${b.date}${b.kickoff_at}`),
  );
}

async function enrichWithPredictions(fixtures: FixtureItem[]): Promise<Prediction[]> {
  const items: Prediction[] = [];
  for (let i = 0; i < fixtures.length; i += BATCH) {
    const chunk = fixtures.slice(i, i + BATCH);
    const settled = await Promise.allSettled(
      chunk.map(async (f) => {
        try {
          const res = await getMatchPrediction(f.id);
          if (res.prediction) {
            return {
              ...res.prediction,
              match_id: f.id,
              external_fixture_id: f.external_id
                ? Number(f.external_id)
                : res.prediction.external_fixture_id ?? f.id,
              kickoff_at: res.prediction.kickoff_at ?? f.kickoff_at,
              tournament: res.prediction.tournament ?? f.tournament,
            } as Prediction;
          }
        } catch {
          /* sin prediccion individual */
        }
        return fixtureToPrediction(f);
      }),
    );
    for (const r of settled) {
      if (r.status === "fulfilled") items.push(r.value);
    }
  }
  return filterWorldCupPredictions(items);
}

function toByDay(items: Prediction[]): ForecastDay[] {
  const map = new Map<string, Prediction[]>();
  for (const p of items) {
    const day = p.date.slice(0, 10);
    if (!map.has(day)) map.set(day, []);
    map.get(day)!.push(p);
  }
  return [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, dayItems]) => ({
      date,
      label: formatMatchDateEs(date),
      count: dayItems.length,
      with_prediction: dayItems.filter(
        (p) => p.has_prediction !== false && p.confidence > 0,
      ).length,
      items: dayItems,
    }));
}

/** Fallback cuando /predictions/home y /forecast devuelven 500 — solo Mundial. */
export async function buildHomePredictionsFromCalendar(
  days = 7,
): Promise<HomePredictionsResponse> {
  const wc = await getWorldCupCalendar();
  const fixtures = dedupeFixtures(worldCupUpcomingFixtures(wc, days));
  const items = await enrichWithPredictions(fixtures);
  const withPred = items.filter((p) => p.has_prediction !== false && p.confidence > 0);
  const pick = bestWorldCupPick(items);

  return {
    status: "ok",
    mode: "calendar_match_fallback",
    days,
    count: items.length,
    count_with_prediction: withPred.length,
    pick,
    items,
    by_day: toByDay(items),
    message: null,
    hint: "Pronósticos del Mundial (calendario WC + predicción por partido).",
    api_hint: null,
  };
}

export async function buildUpcomingFromCalendar(limit = 40): Promise<{
  count: number;
  mode: string;
  items: Prediction[];
  hint: string | null;
}> {
  const wc = await getWorldCupCalendar();
  const fixtures = dedupeFixtures(worldCupUpcomingFixtures(wc, 14)).slice(0, limit);
  const items = await enrichWithPredictions(fixtures);
  return {
    count: items.length,
    mode: "calendar_match_fallback",
    items,
    hint: "Próximos partidos del Mundial (fallback calendario WC).",
  };
}
