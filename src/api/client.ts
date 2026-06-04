/** En dev, vacio usa proxy Vite -> backend (vite.config.ts). */
const API_URL = import.meta.env.VITE_API_URL ?? "";
const API_FALLBACK = "http://127.0.0.1:8888";
const DEFAULT_TIMEOUT_MS = 45_000;

export type Probabilities = {
  home: number;
  draw: number;
  away: number;
};

export type Prediction = {
  match_id: number;
  date: string;
  kickoff_at?: string | null;
  status: string;
  home_team: string;
  away_team: string;
  tournament: string | null;
  round: string | null;
  source: string;
  home_elo: number | null;
  away_elo: number | null;
  elo_diff: number | null;
  probabilities: Probabilities;
  pick: keyof Probabilities;
  confidence: number;
  has_result: boolean;
  actual_result: string | null;
  home_goals: number | null;
  away_goals: number | null;
  external_fixture_id?: number;
  is_future?: boolean;
  has_prediction?: boolean;
  inference_mode?: string;
};

export type ForecastDay = {
  date: string;
  label: string;
  count: number;
  with_prediction: number;
  items: Prediction[];
};

export type CalendarSync = {
  auto_sync_enabled: boolean;
  interval_seconds: number;
  live_interval_seconds: number;
  last_sync_at: string | null;
  next_sync_at: string | null;
  stale: boolean;
  in_progress: boolean;
  last_error: string | null;
  credentials_ok: boolean;
};

export type ForecastResponse = {
  status: string;
  mode: string;
  days: number;
  app_clock?: AppClock;
  today_match_count?: number;
  count: number;
  count_with_prediction: number;
  pick: Prediction | null;
  items: Prediction[];
  by_day: ForecastDay[];
  message?: string | null;
  api_hint?: string | null;
  calendar_sync?: CalendarSync;
};

export type AppClock = {
  timezone: string;
  now_iso: string;
  today_iso: string;
  date_label_es: string;
  time_label_es: string;
  datetime_label_es: string;
  is_fixed?: boolean;
};

export type Overview = {
  app_clock?: AppClock;
  teams: number;
  matches: number;
  elo_ratings: number;
  active_model: {
    version: string;
    algorithm: string;
    trained_at: string;
    metrics: Record<string, number | string | undefined>;
  } | null;
};

export type PickOfDayResponse = {
  status: string;
  mode?: "future" | "upcoming" | "recent";
  pick?: Prediction;
  message?: string;
  hint?: string | null;
};

export type UpcomingResponse = {
  count: number;
  mode: "future" | "upcoming" | "recent";
  items: Prediction[];
  hint?: string | null;
};

export type HomePredictionsResponse = ForecastResponse & {
  hint?: string | null;
};

export type FixtureItem = {
  id: number;
  date: string;
  kickoff_at?: string | null;
  status: string;
  home_team: string;
  away_team: string;
  tournament: string | null;
  round: string | null;
  source: string;
  external_id: string | null;
  home_goals?: number;
  away_goals?: number;
  result_1x2?: string;
};

export type CalendarDay = {
  date: string;
  upcoming: FixtureItem[];
  finished: FixtureItem[];
};

export type WorldCupGroup = {
  group: string;
  label: string;
  matches: FixtureItem[];
};

export type WorldCupPhase = {
  id: string;
  label: string;
  groups?: WorldCupGroup[];
  matches?: FixtureItem[];
};

export type WorldCupTie = {
  code: string;
  label: string;
  home: string;
  away: string;
  date: string | null;
  match_id: number | null;
  external_id: string | null;
  status: string;
  resolved: boolean;
};

export type WorldCupBracketRound = {
  round: string;
  label: string;
  ties: WorldCupTie[];
};

export type WorldCupCalendar = {
  tournament: string;
  season: number;
  from: string;
  to: string;
  total_matches: number;
  phases: WorldCupPhase[];
  by_date: CalendarDay[];
  bracket: WorldCupBracketRound[];
  sync_hint: string | null;
};

function formatApiError(body: unknown, fallback: string): string {
  if (!body || typeof body !== "object") return fallback;
  const detail = (body as { detail?: unknown }).detail;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) {
    return detail
      .map((d) =>
        typeof d === "object" && d && "msg" in d
          ? String((d as { msg: string }).msg)
          : JSON.stringify(d),
      )
      .join("; ");
  }
  return fallback;
}

async function fetchJsonOnce<T>(
  base: string,
  path: string,
  timeoutMs: number,
  method: "GET" | "POST" = "GET",
  body?: unknown,
): Promise<T> {
  const url = `${base}${path}`;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      method,
      headers: body != null ? { "Content-Type": "application/json" } : undefined,
      body: body != null ? JSON.stringify(body) : undefined,
    });
    const text = await res.text();
    if (!res.ok) {
      let detail = `${res.status} ${path}`;
      if (text) {
        try {
          detail = formatApiError(JSON.parse(text) as unknown, detail);
        } catch {
          detail = text.length > 200 ? `${text.slice(0, 200)}…` : text;
        }
      }
      throw new Error(detail);
    }
    if (!text) {
      throw new Error(`Respuesta vacia (${path})`);
    }
    try {
      return JSON.parse(text) as T;
    } catch {
      throw new Error(`Respuesta no JSON (${path})`);
    }
  } catch (e) {
    if (e instanceof Error && e.name === "AbortError") {
      throw new Error(
        `La API tardo mas de ${timeoutMs / 1000}s (${path}). Reinicia run-api.ps1 e intentalo de nuevo.`,
      );
    }
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

async function fetchJson<T>(
  path: string,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  method: "GET" | "POST" = "GET",
  body?: unknown,
): Promise<T> {
  // En dev sin VITE_API_URL: proxy Vite primero (evita CORS localhost -> 127.0.0.1).
  const bases = API_URL ? [API_URL, API_FALLBACK] : ["", API_FALLBACK];
  let lastErr: Error | null = null;
  for (const base of bases) {
    try {
      return await fetchJsonOnce<T>(base, path, timeoutMs, method, body);
    } catch (e) {
      lastErr = e instanceof Error ? e : new Error(String(e));
      if (base === bases[bases.length - 1]) break;
    }
  }
  throw (
    lastErr ??
    new Error(`No se pudo conectar con la API. ¿Está corriendo .\\scripts\\run-api.ps1?`)
  );
}

export async function getHealth() {
  return fetchJson<{ status: string }>("/api/v1/health", 8_000);
}

export async function checkApiOnline(): Promise<boolean> {
  try {
    const h = await getHealth();
    return h.status === "ok";
  } catch {
    return false;
  }
}

export async function getOverview() {
  return fetchJson<Overview>("/api/v1/stats/overview", 15_000);
}

export async function getAppClock(): Promise<AppClock> {
  const res = await fetchJson<{ status: string } & AppClock>(
    "/api/v1/meta/app-clock",
    10_000,
  );
  return {
    timezone: res.timezone,
    now_iso: res.now_iso,
    today_iso: res.today_iso,
    date_label_es: res.date_label_es,
    time_label_es: res.time_label_es,
    datetime_label_es: res.datetime_label_es,
    is_fixed: res.is_fixed,
  };
}

export async function getFuturePickOfDay() {
  return fetchJson<PickOfDayResponse>("/api/v1/predictions/future/pick-of-the-day");
}

export async function getFuturePredictions(limit = 30) {
  return fetchJson<UpcomingResponse>(
    `/api/v1/predictions/future/upcoming?limit=${limit}`,
  );
}

export async function getUpcomingPredictions(limit = 30) {
  return fetchJson<UpcomingResponse>(
    `/api/v1/predictions/upcoming?limit=${limit}`,
  );
}

export async function getPickOfDay() {
  return fetchJson<PickOfDayResponse>("/api/v1/predictions/pick-of-the-day");
}

export async function getForecast(days = 3, refresh = false) {
  const q = new URLSearchParams({ days: String(days) });
  if (refresh) q.set("refresh", "1");
  return fetchJson<ForecastResponse>(`/api/v1/predictions/forecast?${q}`);
}

export async function getHomePredictions(days = 3, refresh = false) {
  const q = new URLSearchParams({ days: String(days) });
  if (refresh) q.set("refresh", "1");
  return fetchJson<HomePredictionsResponse>(`/api/v1/predictions/home?${q}`);
}

export async function loadHomePredictions(days = 3): Promise<{
  pick: Prediction | null;
  upcoming: Prediction[];
  byDay: ForecastDay[];
  hint: string | null;
  mode: string | null;
  message: string | null;
  countWithPrediction: number;
  apiHint: string | null;
  appClock: AppClock | null;
  todayMatchCount: number;
  calendarSync: CalendarSync | null;
}> {
  const res = await getHomePredictions(days, false);
  const pick =
    res.pick ??
    (res.items.filter((p) => p.has_prediction !== false).length
      ? [...res.items]
          .filter((p) => p.has_prediction !== false)
          .sort((a, b) => b.confidence - a.confidence)[0]
      : null);
  return {
    pick,
    upcoming: res.items,
    byDay: res.by_day ?? [],
    hint: res.hint ?? null,
    mode: res.mode,
    message: res.message ?? null,
    countWithPrediction: res.count_with_prediction ?? 0,
    apiHint: res.api_hint ?? null,
    appClock: res.app_clock ?? null,
    todayMatchCount: res.today_match_count ?? 0,
    calendarSync: res.calendar_sync ?? null,
  };
}

export async function loadPredictionsList(_limit = 200) {
  const res = await getForecast(3, true);
  return {
    items: res.items,
    byDay: res.by_day,
    hint: null,
    mode: res.mode,
  };
}

export async function searchMatchesByTeams(params: {
  home?: string;
  away?: string;
  limit?: number;
}) {
  const q = new URLSearchParams({ limit: String(params.limit ?? 12) });
  if (params.home) q.set("home", params.home);
  if (params.away) q.set("away", params.away);
  return fetchJson<{ count: number; items: Prediction[]; hint?: string }>(
    `/api/v1/matches/search?${q}`,
    30_000,
  );
}

export type OddsSyncResponse = {
  status: string;
  mode?: string;
  sport_keys?: string[];
  fixtures_fetched?: number;
  inserted?: number;
  updated?: number;
  skipped?: number;
  odds_rows?: number;
  finished_with_score?: number;
  api_calls_estimate?: number;
  hints?: string[];
  days_from?: number | null;
};

export async function getOddsSports() {
  return fetchJson<{
    status: string;
    configured_keys: string[];
    active_target_keys: string[];
    soccer_sports_sample: { key: string; title: string; active?: boolean }[];
  }>("/api/v1/calendar/odds/sports");
}

export async function postOddsInitialLoad() {
  return fetchJson<OddsSyncResponse>(
    "/api/v1/calendar/odds/initial-load",
    DEFAULT_TIMEOUT_MS,
    "POST",
  );
}

export async function postOddsUpdateResults(daysFrom?: number) {
  const q =
    daysFrom != null ? `?days_from=${encodeURIComponent(String(daysFrom))}` : "";
  return fetchJson<OddsSyncResponse>(
    `/api/v1/calendar/odds/update-results${q}`,
    60_000,
    "POST",
  );
}

export async function getCalendar(source?: string, daysAhead = 120, daysBack = 30) {
  const q = new URLSearchParams({
    days_ahead: String(daysAhead),
    days_back: String(daysBack),
  });
  if (source) q.set("source", source);
  return fetchJson<{ from: string; to: string; days: CalendarDay[] }>(
    `/api/v1/fixtures/calendar?${q}`,
    20_000,
  );
}

export async function getWorldCupCalendar() {
  return fetchJson<WorldCupCalendar>("/api/v1/fixtures/world-cup", 30_000);
}

export async function syncWorldCup() {
  return fetchJson<{
    status: string;
    fixtures_fetched?: number;
    inserted?: number;
    updated?: number;
    hint?: string;
  }>("/api/v1/calendar/sync-world-cup", 60_000, "POST");
}

export async function getRecentResults(source?: string, days = 21) {
  const q = new URLSearchParams({ days: String(days) });
  if (source) q.set("source", source);
  return fetchJson<{ count: number; items: FixtureItem[] }>(
    `/api/v1/fixtures/recent?${q}`,
    20_000,
  );
}

export type BetSuggestion = {
  tier: string;
  label: string;
  market: string;
  selection: string;
  model_probability: number;
  confidence_band: string;
  rationale: string;
  risk_level: number;
};

export type MarketBet = BetSuggestion & { category: string };

export type TeamFormProfile = {
  team_id: number;
  matches_sampled: number;
  goals_for_avg: number;
  goals_against_avg: number;
  points_per_game: number;
  btts_rate: number;
  over_25_rate: number;
  clean_sheet_rate: number;
  failed_to_score_rate: number;
};

export type ProAnalysis = {
  simulation: {
    expected_home_goals: number;
    expected_away_goals: number;
    expected_total_goals: number;
    markets: {
      home_win: number;
      draw: number;
      away_win: number;
      over_15: number;
      over_25: number;
      over_35: number;
      under_25: number;
      btts_yes: number;
      btts_no: number;
      home_over_15: number;
      away_over_15: number;
    };
    top_scores: Array<{ home: number; away: number; probability: number }>;
    score_matrix: Array<{ home: number; away: number; prob: number }>;
    monte_carlo: {
      iterations: number;
      total_goals_median: number;
      total_goals_p10: number;
      total_goals_p90: number;
      home_goals_median: number;
      away_goals_median: number;
      prob_total_0_1: number;
      prob_total_4_plus: number;
    };
    corners: {
      total_expected: number;
      home_expected: number;
      away_expected: number;
      over_95_prob: number;
      over_105_prob: number;
      source: string;
    };
    discipline: {
      fouls_total_expected: number;
      home_fouls_expected: number;
      away_fouls_expected: number;
      yellow_cards_expected: number;
      red_card_prob: number;
      player_fouls_top_expected: number;
      source: string;
    };
    methodology: string;
  };
  team_form: {
    home: TeamFormProfile | null;
    away: TeamFormProfile | null;
  };
  narrative: Array<{ title: string; body: string }>;
  all_bets: MarketBet[];
  bet_categories: Record<string, number>;
  inference_mode?: string;
};

export type PlayerProjection = {
  name: string;
  number: number | null;
  position: string;
  position_label: string;
  likely_starter: boolean;
  expected_minutes: number;
  goal_probability: number;
  assist_probability: number;
  card_probability: number;
  impact_score: number;
  is_star: boolean;
  outlook: string;
  goal_level?: string;
  assist_level?: string;
  card_level?: string;
  goal_pct?: number;
  assist_pct?: number;
  card_pct?: number;
  role_short?: string;
};

export type LineupPlayer = {
  name: string;
  number: number | null;
  position: string;
  projection?: PlayerProjection;
};

export type LineupSide = {
  source: string;
  formation: string | null;
  coach: string | null;
  starters: LineupPlayer[];
  substitutes: LineupPlayer[];
};

export type MatchLineups = {
  home_team: string;
  away_team: string;
  home: LineupSide;
  away: LineupSide;
  home_is_official: boolean;
  away_is_official: boolean;
  formation_default: string;
  fetch_hint: string | null;
  legend: string;
};

export type TeamStatRow = {
  key: string;
  label: string;
  value: string | number;
  help: string;
};

export type LiveFeed = {
  status: string;
  status_label: string;
  is_live: boolean;
  is_finished: boolean;
  has_score: boolean;
  score: {
    home: number;
    away: number;
    result_1x2?: string;
  } | null;
  stats: { home: TeamStatRow[]; away: TeamStatRow[] } | null;
  stats_source: string | null;
  stats_hint: string | null;
  can_refresh_live: boolean;
  live_note: string;
};

export type PlayerOutlookSide = {
  team: string;
  side: string;
  starters_count: number;
  team_xg: number;
  players: PlayerProjection[];
};

export type PlayerMatchOutlook = {
  methodology: string;
  legend: {
    impact: string;
    goal: string;
    assist: string;
    card: string;
    minutes: string;
  };
  home: PlayerOutlookSide;
  away: PlayerOutlookSide;
};

export type MatchDetail = {
  status: string;
  fixture_id: number;
  match: {
    date: string;
    kickoff_at?: string | null;
    status: string | null;
    status_short: string | null;
    home_team: string;
    away_team: string;
    tournament: string | null;
    round: string | null;
    venue: string | null;
    referee: string | null;
  };
  teams: {
    home: { name: string; elo: Record<string, unknown> | null };
    away: { name: string; elo: Record<string, unknown> | null };
  };
  head_to_head: Array<{
    date: string;
    home_team: string;
    away_team: string;
    tournament: string | null;
    home_goals?: number;
    away_goals?: number;
    result_1x2?: string;
  }>;
  prediction: Prediction | null;
  bet_suggestions: BetSuggestion[];
  pro_analysis: ProAnalysis | null;
  player_outlook: PlayerMatchOutlook | null;
  live_feed?: LiveFeed;
  lineups?: MatchLineups;
  match_statistics: { home: TeamStatRow[]; away: TeamStatRow[] } | null;
  data_layers: Record<string, boolean>;
  roadmap_note: string;
};

export async function getMatchDetail(fixtureId: number) {
  return fetchJson<MatchDetail>(`/api/v1/matches/detail?fixture_id=${fixtureId}`);
}

export type BettingSelection = {
  selection_id: string;
  category: string;
  market: string;
  selection: string;
  model_probability: number;
  decimal_odds: number;
  recommended?: boolean;
  tier?: string;
  team?: string;
  player?: string;
  scope?: string;
};

export type BettingDailyPick = BettingSelection & {
  match_id: number;
  home_team: string;
  away_team: string;
  date?: string;
  kickoff_at?: string | null;
};

export type BettingDayMatch = {
  match_id: number;
  home_team: string;
  away_team: string;
  date?: string;
  kickoff_at?: string | null;
  tournament?: string | null;
  round?: string | null;
  confidence?: number;
  has_prediction?: boolean;
  selections_count: number;
};

export type BettingDailyDay = {
  date: string;
  label: string;
  match_count?: number;
  matches: BettingDayMatch[];
  picks: BettingDailyPick[];
};

export type InterestingMatchResponse = {
  status: string;
  message?: string;
  match_id?: number;
  home_team?: string;
  away_team?: string;
  date?: string;
  kickoff_at?: string | null;
  tournament?: string | null;
  round?: string | null;
  confidence?: number;
  confidence_pct?: number;
  pick?: string;
  pick_label?: string;
  probabilities?: Probabilities;
  inference_mode?: string;
  reason?: string;
};

export async function getInterestingMatch(days = 7) {
  return fetchJson<InterestingMatchResponse>(
    `/api/v1/betting/interesting-match?days=${days}`,
    30_000,
  );
}

export type BettingDailyResponse = {
  status: string;
  disclaimer: string;
  virtual_currency: string;
  days: number;
  app_clock?: AppClock;
  today_match_count?: number;
  by_day: BettingDailyDay[];
  top_picks: BettingDailyPick[];
};

export type BettingMatchMarketsResponse = {
  status: string;
  disclaimer?: string;
  match_id: number;
  home_team: string;
  away_team: string;
  tournament: string | null;
  round: string | null;
  date: string;
  kickoff_at?: string | null;
  local_date: string;
  selections: BettingSelection[];
  by_category: Record<string, BettingSelection[]>;
  recommended: BettingSelection[];
};

export type SlipLegIn = {
  match_id: number;
  selection_id: string;
  market: string;
  selection: string;
  category?: string;
  model_probability?: number;
  decimal_odds?: number;
  scope?: string;
};

export type BettingMatchComboResponse = {
  status: string;
  message?: string;
  match_id: number;
  home_team: string;
  away_team: string;
  legs: BettingDailyPick[];
  legs_by_category: Record<string, BettingDailyPick[]>;
  legs_count: number;
  combined_probability?: number;
  combined_probability_pct?: number;
  combined_odds?: number;
  rationale?: string;
};

export type BettingOutrightsResponse = {
  status: string;
  message?: string;
  tournament?: string;
  teams_considered?: number;
  selections: BettingSelection[];
  by_category: Record<string, BettingSelection[]>;
  disclaimer?: string;
};

export async function getBettingOutrights() {
  return fetchJson<BettingOutrightsResponse>("/api/v1/betting/outrights", 60_000);
}

export async function getBettingMatchBestCombo(matchId: number, maxLegs = 8) {
  return fetchJson<BettingMatchComboResponse>(
    `/api/v1/betting/match/${matchId}/best-combo?max_legs=${maxLegs}`,
    90_000,
  );
}

export type SlipEvaluationLeg = {
  status: string;
  match_id?: number;
  match_label?: string;
  category?: string;
  market?: string;
  selection?: string;
  selection_id?: string;
  model_probability?: number;
  probability_pct?: number;
  decimal_odds?: number;
  edge?: number;
  message?: string;
  stake?: number;
  potential_win?: number;
  potential_profit?: number;
  potential_loss?: number;
};

export type SlipEvaluation = {
  status: string;
  message?: string;
  mode?: string;
  stake?: number;
  stake_total?: number;
  legs_count?: number;
  combined_probability?: number | null;
  combined_probability_pct?: number;
  combined_odds?: number | null;
  potential_win?: number;
  potential_profit?: number;
  potential_loss?: number;
  expected_value?: number;
  verdict?: string;
  legs: SlipEvaluationLeg[];
  disclaimer?: string;
};

export async function getBettingDaily(days = 7) {
  return fetchJson<BettingDailyResponse>(
    `/api/v1/betting/daily?days=${days}`,
    120_000,
  );
}

export type BettingPickOfDayResponse = {
  status: string;
  message?: string;
  type?: "combo" | "single";
  pick?: BettingDailyPick;
  legs?: BettingDailyPick[];
  legs_count?: number;
  combined_probability?: number;
  combined_probability_pct?: number;
  combined_odds?: number;
  rationale?: string;
  score?: number;
  disclaimer?: string;
};

export async function getBettingPickOfDay(days = 5) {
  return fetchJson<BettingPickOfDayResponse>(
    `/api/v1/betting/pick-of-the-day?days=${days}`,
    120_000,
  );
}

export type BettingSafeComboResponse = {
  status: string;
  message?: string;
  type?: "multi_match" | "same_match" | "single_safe";
  date?: string;
  min_probability?: number;
  min_probability_pct?: number;
  matches_today?: number;
  matches_in_combo?: number;
  skipped_matches?: Array<{
    match_id: number;
    label: string;
    reason: string;
    best_probability_pct?: number | null;
  }>;
  legs?: BettingDailyPick[];
  legs_by_category?: Record<string, BettingDailyPick[]>;
  legs_count?: number;
  combined_probability?: number;
  combined_probability_pct?: number;
  combined_odds?: number;
  expected_return_multiplier?: number;
  rationale?: string;
  disclaimer?: string;
};

export async function getBettingSafeCombo(
  minProbability = 0.60,
  maxLegs = 12,
) {
  return fetchJson<BettingSafeComboResponse>(
    `/api/v1/betting/safe-combo?min_probability=${minProbability}&max_legs=${maxLegs}`,
    120_000,
  );
}

export async function getBettingMatchMarkets(matchId: number) {
  return fetchJson<BettingMatchMarketsResponse>(
    `/api/v1/betting/match/${matchId}`,
    90_000,
  );
}

export async function evaluateBettingSlip(body: {
  stake: number;
  mode: "accumulator" | "single" | "singles";
  legs: SlipLegIn[];
}) {
  return fetchJson<SlipEvaluation>(
    "/api/v1/betting/evaluate",
    90_000,
    "POST",
    body,
  );
}

export { API_URL, API_FALLBACK };
