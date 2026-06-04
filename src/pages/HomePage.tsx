import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  API_FALLBACK,
  API_URL,
  getInterestingMatch,
  getOverview,
  loadHomePredictions,
  postOddsInitialLoad,
  postOddsUpdateResults,
  type CalendarSync,
  type ForecastDay,
  type InterestingMatchResponse,
  type Overview,
} from "../api/client";
import { MatchCard } from "../components/MatchCard";
import { useAppClock } from "../context/AppClockContext";
import {
  formatKickoffTimeEs,
  formatMatchDateShortEs,
} from "../lib/datetimeEs";

export function HomePage() {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [interesting, setInteresting] = useState<InterestingMatchResponse | null>(
    null,
  );
  const [byDay, setByDay] = useState<ForecastDay[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [predCount, setPredCount] = useState(0);
  const [message, setMessage] = useState<string | null>(null);
  const [apiHint, setApiHint] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [todayMatchCount, setTodayMatchCount] = useState(0);
  const [calendarSync, setCalendarSync] = useState<CalendarSync | null>(null);
  const [oddsBusy, setOddsBusy] = useState<"initial" | "results" | null>(null);
  const [oddsMessage, setOddsMessage] = useState<string | null>(null);
  const { todayIso, syncClock } = useAppClock();

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setMessage(null);

    const overviewResult = await Promise.allSettled([getOverview()]);
    if (overviewResult[0].status === "fulfilled") {
      setOverview(overviewResult[0].value);
    }

    try {
      const [data, interestingRes] = await Promise.all([
        loadHomePredictions(7),
        getInterestingMatch(7).catch(() => ({ status: "empty" as const })),
      ]);
      setByDay(data.byDay);
      setTotalCount(data.upcoming.length);
      setPredCount(data.countWithPrediction);
      setMessage(data.message);
      setApiHint(data.apiHint);
      setTodayMatchCount(data.todayMatchCount);
      setCalendarSync(data.calendarSync);
      if (data.appClock) syncClock(data.appClock);
      if (interestingRes.status === "ok") {
        setInteresting(interestingRes);
      } else {
        setInteresting(null);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al cargar");
      setInteresting(null);
      setByDay([]);
      setTotalCount(0);
      setPredCount(0);
    } finally {
      setLoading(false);
    }
  }, [syncClock]);

  useEffect(() => {
    load();
  }, [load]);

  const handleOddsInitial = async () => {
    setOddsBusy("initial");
    setOddsMessage(null);
    try {
      await postOddsInitialLoad();
      await load();
    } catch (e) {
      setOddsMessage(e instanceof Error ? e.message : "Error en volcado Odds API");
    } finally {
      setOddsBusy(null);
    }
  };

  const handleOddsResults = async () => {
    setOddsBusy("results");
    setOddsMessage(null);
    try {
      await postOddsUpdateResults(3);
      await load();
    } catch (e) {
      setOddsMessage(
        e instanceof Error ? e.message : "Error al actualizar resultados",
      );
    } finally {
      setOddsBusy(null);
    }
  };

  useEffect(() => {
    if (!oddsMessage) return;
    const id = window.setTimeout(() => setOddsMessage(null), 8000);
    return () => window.clearTimeout(id);
  }, [oddsMessage]);

  const featuredPrediction = useMemo(() => {
    if (!interesting?.match_id) return null;
    const all = byDay.flatMap((d) => d.items);
    return all.find((p) => p.match_id === interesting.match_id) ?? null;
  }, [byDay, interesting]);

  const apiLabel = API_URL || `(directo ${API_FALLBACK})`;

  return (
    <div className="page">
      <header className="page-head">
        <span className="page-badge">Centro pro</span>
        <h1>Centro de predicciones</h1>
        <p>
          Calendario completo por dia (7 dias). El partido destacado es el que el
          modelo marca como mas interesante hoy.
        </p>
        <div className="page-actions">
          {calendarSync && (
            <span
              className={`calendar-sync-badge ${calendarSync.stale ? "stale" : "ok"}`}
              title={
                calendarSync.last_sync_at
                  ? `Último sync: ${calendarSync.last_sync_at}`
                  : "Aún no se ha sincronizado el calendario"
              }
            >
              {calendarSync.in_progress
                ? "Sincronizando calendario…"
                : calendarSync.stale
                  ? "Calendario pendiente de sync"
                  : "Calendario en línea"}
            </span>
          )}
          <button
            type="button"
            className="btn-secondary"
            onClick={handleOddsInitial}
            disabled={loading || oddsBusy !== null}
            title="The Odds API: GET /sports/{torneo}/odds (1 crédito por torneo)"
          >
            {oddsBusy === "initial" ? "Cargando…" : "Cargar calendario (Odds API)"}
          </button>
          <button
            type="button"
            className="btn-primary"
            onClick={handleOddsResults}
            disabled={loading || oddsBusy !== null}
            title="The Odds API: GET /sports/{torneo}/scores (Mundial + amistosos)"
          >
            {oddsBusy === "results"
              ? "Actualizando…"
              : "Actualizar resultados (Mundial + amistosos)"}
          </button>
          <button type="button" className="btn-refresh" onClick={load} disabled={loading}>
            {loading ? "Recargando vista…" : "↻ Recargar"}
          </button>
        </div>
        {oddsMessage && (
          <p className="muted small odds-sync-msg odds-sync-msg--error">{oddsMessage}</p>
        )}
      </header>

      {loading && (
        <p className="muted loading-dots">Cargando calendario desde BD</p>
      )}

      {error && (
        <div className="alert">
          <strong>Error</strong>
          <p>{error}</p>
          <p className="muted">API: {apiLabel}</p>
        </div>
      )}

      {apiHint && totalCount === 0 && (
        <div className="alert subtle">
          <p>{apiHint}</p>
        </div>
      )}

      {message && !error && totalCount === 0 && (
        <div className="alert">
          <strong>Sin partidos en pantalla</strong>
          <p>{message}</p>
          <p className="muted">
            Calendario en BD vía football-data.org. En el backend:{" "}
            <code>.\scripts\sync-fixtures.ps1</code> (1 petición). Luego Actualizar.
          </p>
        </div>
      )}

      {!loading && (
        <>
          <section className="hero-pick hero-interesting">
            <div className="hero-label">Partido interesante del dia</div>
            {interesting?.status === "ok" ? (
              <>
                {interesting.reason && (
                  <p className="hero-interesting-reason">{interesting.reason}</p>
                )}
                <div className="hero-pick-inner">
                  {featuredPrediction ? (
                    <MatchCard p={featuredPrediction} featured />
                  ) : (
                    <article className="card match-card featured interesting-fallback">
                      <div className="match-card-top">
                        <time>
                          {formatMatchDateShortEs(
                            interesting.date ?? "",
                            interesting.kickoff_at,
                          )}
                          {interesting.kickoff_at && (
                            <span className="match-card-kickoff">
                              {formatKickoffTimeEs(
                                interesting.date ?? "",
                                interesting.kickoff_at,
                              )}
                            </span>
                          )}
                        </time>
                      </div>
                      <div className="match-spotlight compact">
                        <div className="team-block home">
                          <span className="team-crest">◆</span>
                          <span className="team-name">{interesting.home_team}</span>
                        </div>
                        <span className="vs-badge">VS</span>
                        <div className="team-block away">
                          <span className="team-crest">◆</span>
                          <span className="team-name">{interesting.away_team}</span>
                        </div>
                      </div>
                      <p className="muted small">
                        {interesting.tournament}
                        {interesting.pick_label &&
                          ` · Lectura: ${interesting.pick_label} (${interesting.confidence_pct}%)`}
                      </p>
                    </article>
                  )}
                </div>
                <div className="hero-interesting-actions">
                  <Link
                    to={`/partido/${interesting.match_id}`}
                    className="btn primary"
                  >
                    Ver ficha pro
                  </Link>
                  <Link to="/apuestas" className="btn ghost">
                    Apuestas y combinada
                  </Link>
                </div>
              </>
            ) : (
              <div className="card empty">
                No hay partido destacado. Sincroniza el calendario del Mundial.
              </div>
            )}
          </section>

          <section className="stats-row">
            <div className="stat accent-stat">
              <div className="stat-icon">⚽</div>
              <span>Partidos hoy ({todayIso})</span>
              <strong>{todayMatchCount}</strong>
            </div>
            <div className="stat">
              <div className="stat-icon">📆</div>
              <span>Partidos (7 dias)</span>
              <strong>{totalCount}</strong>
            </div>
            <div className="stat accent-stat">
              <div className="stat-icon">◎</div>
              <span>Con prediccion Elo</span>
              <strong>{predCount}</strong>
            </div>
            <div className="stat">
              <div className="stat-icon">✓</div>
              <span>Test accuracy modelo</span>
              <strong>
                {overview?.active_model?.metrics?.test_accuracy
                  ? `${(Number(overview.active_model.metrics.test_accuracy) * 100).toFixed(1)}%`
                  : "—"}
              </strong>
            </div>
          </section>

          {byDay.map((day) => (
            <section key={day.date} className="day-section">
              <h2>
                {day.label}{" "}
                <span className="muted">
                  ({formatMatchDateShortEs(day.date)}) — {day.count} partidos
                  {day.with_prediction > 0 &&
                    `, ${day.with_prediction} con prediccion`}
                </span>
              </h2>
              {day.items.length === 0 ? (
                <div className="card empty">Sin partidos este dia.</div>
              ) : (
                <div className="match-grid">
                  {day.items.map((p) => (
                    <MatchCard
                      key={p.external_fixture_id ?? p.match_id}
                      p={p}
                      compact
                    />
                  ))}
                </div>
              )}
            </section>
          ))}
        </>
      )}
    </div>
  );
}
