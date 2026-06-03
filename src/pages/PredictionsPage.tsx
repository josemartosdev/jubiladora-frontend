import { useEffect, useMemo, useState } from "react";
import { loadPredictionsList, type ForecastDay, type Prediction } from "../api/client";
import { MatchCard } from "../components/MatchCard";

export function PredictionsPage() {
  const [byDay, setByDay] = useState<ForecastDay[]>([]);
  const [items, setItems] = useState<Prediction[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const res = await loadPredictionsList();
        setByDay(res.byDay ?? []);
        setItems(
          [...res.items].sort(
            (a, b) => a.date.localeCompare(b.date) || b.confidence - a.confidence,
          ),
        );
        setError(res.items.length === 0 ? "No hay partidos en hoy, manana ni pasado." : null);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Error");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const totals = useMemo(() => {
    const total = byDay.reduce((s, d) => s + d.count, 0);
    const withPred = byDay.reduce((s, d) => s + d.with_prediction, 0);
    const days = byDay.length;
    return { total, withPred, days };
  }, [byDay]);

  return (
    <div className="page">
      <header className="page-head">
        <span className="page-badge">Modelo 1X2</span>
        <h1>Predicciones — 3 dias</h1>
        <p>
          Modelo 1X2 + simulacion Poisson. Pulsa un partido para analisis completo y
          apuestas por mercado.
        </p>
      </header>

      {error && <div className="alert">{error}</div>}
      {loading && <p className="muted loading-dots">Cargando calendario</p>}

      {!loading && byDay.length > 0 && (
        <div className="pred-summary">
          <div className="pred-summary-item">
            <span>Dias con partidos</span>
            <strong>{totals.days}</strong>
          </div>
          <div className="pred-summary-item">
            <span>Total partidos</span>
            <strong>{totals.total}</strong>
          </div>
          <div className="pred-summary-item">
            <span>Con prediccion</span>
            <strong>{totals.withPred}</strong>
          </div>
        </div>
      )}

      {!loading &&
        byDay.map((day) => (
          <section key={day.date} className="day-section">
            <h2>
              {day.label}{" "}
              <span className="muted">
                ({day.date}) — {day.with_prediction}/{day.count} con prediccion
              </span>
            </h2>
            <div className="match-list">
              {day.items.map((p) => (
                <MatchCard key={p.external_fixture_id ?? p.match_id} p={p} />
              ))}
            </div>
          </section>
        ))}

      {!loading && byDay.length === 0 && items.length > 0 && (
        <div className="match-list">
          {items.map((p) => (
            <MatchCard key={p.external_fixture_id ?? p.match_id} p={p} />
          ))}
        </div>
      )}
    </div>
  );
}
