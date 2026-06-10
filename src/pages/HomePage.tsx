import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  fixtureToPrediction,
  getInterestingMatch,
  getOverview,
  getWorldCupCalendar,
  loadHomePredictions,
  MAX_PREDICTION_DAYS,
  type InterestingMatchResponse,
  type Overview,
  type Prediction,
} from "../api/client";
import { ErrorAlert } from "../components/ErrorAlert";
import { MatchCard } from "../components/MatchCard";
import { filterWorldCupPredictions } from "../lib/worldCup";

function isModelMissingError(msg: string): boolean {
  const m = msg.toLowerCase();
  return m.includes("modelo") || m.includes("train");
}

export function HomePage() {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [interesting, setInteresting] = useState<InterestingMatchResponse | null>(null);
  const [matches, setMatches] = useState<Prediction[]>([]);
  const [wcCount, setWcCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [setupHint, setSetupHint] = useState<string | null>(null);
  const [fallbackHint, setFallbackHint] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setSetupHint(null);
    setFallbackHint(null);
    try {
      const [ov, homeRes, inter, wc] = await Promise.all([
        getOverview().catch(() => null),
        loadHomePredictions(MAX_PREDICTION_DAYS).catch((e) => ({
          error: e instanceof Error ? e.message : String(e),
          upcoming: [] as Prediction[],
        })),
        getInterestingMatch(MAX_PREDICTION_DAYS).catch(() => ({
          status: "empty" as const,
        })),
        getWorldCupCalendar().catch(() => null),
      ]);

      setOverview(ov);

      if (inter.status === "ok") setInteresting(inter);
      else setInteresting(null);

      let all: Prediction[] = [];
      if ("error" in homeRes) {
        const wcUpcoming =
          wc?.by_date?.flatMap((d) => d.upcoming) ??
          wc?.phases?.flatMap((p) => p.groups?.flatMap((g) => g.matches) ?? p.matches ?? []) ??
          [];
        all = wcUpcoming.map(fixtureToPrediction);
        if (isModelMissingError(homeRes.error)) {
          setSetupHint("model");
        } else {
          setError(homeRes.error);
        }
      } else {
        all = homeRes.upcoming;
        if (homeRes.mode === "calendar_match_fallback" && homeRes.hint) {
          setFallbackHint(homeRes.hint);
        }
      }

      const wcMatches = filterWorldCupPredictions(all);
      setMatches(wcMatches.length > 0 ? wcMatches : []);
      setWcCount(wc?.total_matches ?? wcMatches.length);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al cargar");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const predWithModel = useMemo(
    () => matches.filter((m) => m.has_prediction !== false && m.confidence > 0).length,
    [matches],
  );

  const pickLabel =
    interesting?.pick === "home"
      ? "Victoria local"
      : interesting?.pick === "draw"
        ? "Empate"
        : interesting?.pick === "away"
          ? "Victoria visitante"
          : interesting?.pick_label ?? "—";

  return (
    <div className="page page--home">
      <header className="page-hero page-hero--home">
        <span className="wc-badge">Copa del Mundo 2026</span>
        <h1>Pronósticos y apuestas ficticias</h1>
        <p className="muted">
          Modelo 1X2 + simulación Poisson. Enfocado en partidos del Mundial.
        </p>
        <div className="hero-actions">
          <Link to="/calendario" className="btn btn-primary">
            Ver calendario
          </Link>
          <Link to="/apuestas" className="btn">
            Ir a apuestas
          </Link>
          <Link to="/configuracion" className="btn">
            Configuración
          </Link>
          <button type="button" className="btn" onClick={load} disabled={loading}>
            {loading ? "Actualizando…" : "Actualizar"}
          </button>
        </div>
      </header>

      {setupHint && (
        <div className="setup-banner">
          <strong>Configuración pendiente</strong>
          <p>
            El modelo 1X2 aún no está entrenado. Ve a{" "}
            <Link to="/configuracion">Configuración</Link> y ejecuta el pipeline
            (BD → CSV → Entrenar → Sync).
          </p>
        </div>
      )}
      {fallbackHint && (
        <p className="muted small info-banner">{fallbackHint}</p>
      )}
      {error && <ErrorAlert error={error} />}
      {loading && <p className="muted loading-dots">Cargando</p>}

      {!loading && (
        <div className="stats-row">
          <div className="stat-card">
            <span>Partidos Mundial</span>
            <strong>{wcCount}</strong>
          </div>
          <div className="stat-card">
            <span>Próximos con pick</span>
            <strong>{predWithModel}</strong>
          </div>
          <div className="stat-card">
            <span>Equipos en BD</span>
            <strong>{overview?.teams ?? "—"}</strong>
          </div>
          <div className="stat-card">
            <span>Modelo activo</span>
            <strong>{overview?.active_model?.version ?? "—"}</strong>
          </div>
        </div>
      )}

      {!loading && interesting?.match_id && (
        <section className="card featured-match">
          <h2 className="section-title section-title--gold">Partido destacado</h2>
          <div className="featured-teams">
            <div className="featured-team">
              <strong>{interesting.home_team}</strong>
            </div>
            <span className="featured-vs">VS</span>
            <div className="featured-team">
              <strong>{interesting.away_team}</strong>
            </div>
          </div>
          <p className="muted small featured-meta">
            {interesting.tournament}
            {interesting.round && ` · ${interesting.round}`}
          </p>
          <p className="featured-pick">
            Pick: <span className="pick-chip">{pickLabel}</span>
            {interesting.confidence_pct != null && (
              <span className="muted small"> · {interesting.confidence_pct}% confianza</span>
            )}
          </p>
          <p className="featured-links">
            <Link to={`/partido/${interesting.match_id}`} className="btn btn-sm btn-primary">
              Ver análisis
            </Link>
            <Link to="/apuestas" className="btn btn-sm">
              Ir a apuestas
            </Link>
          </p>
        </section>
      )}

      {!loading && matches.length > 0 && (
        <section>
          <h2 className="section-title">
            Próximos partidos
            {predWithModel === 0 && (
              <span className="muted small"> · sin predicciones aún</span>
            )}
          </h2>
          <div className="match-list">
            {matches.slice(0, 8).map((p) => (
              <MatchCard
                key={p.external_fixture_id ?? p.match_id}
                p={p}
                compact
              />
            ))}
          </div>
          {matches.length > 8 && (
            <p className="section-more">
              <Link to="/predicciones">Ver todos los pronósticos →</Link>
            </p>
          )}
        </section>
      )}

      {!loading && matches.length === 0 && !error && (
        <div className="card empty-state">
          <p>No hay partidos cargados.</p>
          <p className="muted small">
            <Link to="/configuracion">Configuración</Link> → sincroniza calendario, o ve al{" "}
            <Link to="/calendario">Calendario</Link>.
          </p>
        </div>
      )}
    </div>
  );
}
