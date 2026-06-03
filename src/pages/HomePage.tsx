import { useCallback, useEffect, useState } from "react";
import {
  API_FALLBACK,
  API_URL,
  getOverview,
  loadHomePredictions,
  type ForecastDay,
  type Overview,
  type Prediction,
} from "../api/client";
import { MatchCard } from "../components/MatchCard";

export function HomePage() {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [pick, setPick] = useState<Prediction | null>(null);
  const [byDay, setByDay] = useState<ForecastDay[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [predCount, setPredCount] = useState(0);
  const [message, setMessage] = useState<string | null>(null);
  const [apiHint, setApiHint] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setMessage(null);

    const overviewResult = await Promise.allSettled([getOverview()]);
    if (overviewResult[0].status === "fulfilled") {
      setOverview(overviewResult[0].value);
    }

    try {
      const data = await loadHomePredictions(3);
      setPick(data.pick);
      setByDay(data.byDay);
      setTotalCount(data.upcoming.length);
      setPredCount(data.countWithPrediction);
      setMessage(data.message);
      setApiHint(data.apiHint);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al cargar");
      setPick(null);
      setByDay([]);
      setTotalCount(0);
      setPredCount(0);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const apiLabel = API_URL || `(directo ${API_FALLBACK})`;

  return (
    <div className="page">
      <header className="page-head">
        <span className="page-badge">Centro pro</span>
        <h1>Centro de predicciones</h1>
        <p>
          Amistosos y selecciones: <strong>hoy</strong>, <strong>manana</strong> y{" "}
          <strong>pasado</strong>. Cada partido abre ficha pro: simulacion Poisson,
          goles, corners, faltas y 14+ mercados de apuesta.
        </p>
        <div className="page-actions">
          <button type="button" className="btn-refresh" onClick={load} disabled={loading}>
            {loading ? "Actualizando…" : "↻ Actualizar"}
          </button>
        </div>
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

      {apiHint && (
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
          <section className="hero-pick">
            <div className="hero-label">Apuesta del dia — max confianza</div>
            <div className="hero-pick-inner">
              {pick ? (
                <MatchCard p={pick} featured />
              ) : (
                <div className="card empty">Ningun partido con Elo para predecir.</div>
              )}
            </div>
          </section>

          <section className="stats-row">
            <div className="stat">
              <div className="stat-icon">📆</div>
              <span>Partidos (3 dias)</span>
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
                  ({day.date}) — {day.count} partidos, {day.with_prediction} con
                  prediccion
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
