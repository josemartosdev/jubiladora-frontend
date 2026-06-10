import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  getForecastWithFallback,
  getFuturePredictions,
  getPickOfDay,
  getUpcomingPredictions,
  getWorldCupCalendar,
  MAX_PREDICTION_DAYS,
  type ForecastDay,
  type Prediction,
} from "../api/client";
import { ErrorAlert } from "../components/ErrorAlert";
import { MatchCard } from "../components/MatchCard";
import {
  filterDaysWithMatches,
  initialDayIndex,
  worldCupToForecastDays,
} from "../lib/forecastDays";
import { formatMatchDateShortEs } from "../lib/datetimeEs";
import {
  bestWorldCupPick,
  filterWorldCupPredictions,
} from "../lib/worldCup";

type Tab = "day" | "upcoming" | "future" | "pick";

export function PredictionsPage() {
  const [tab, setTab] = useState<Tab>("day");
  const [days, setDays] = useState<ForecastDay[]>([]);
  const [dayIndex, setDayIndex] = useState(0);
  const [items, setItems] = useState<Prediction[]>([]);
  const [pick, setPick] = useState<Prediction | null>(null);
  const [hint, setHint] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const visibleDays = useMemo(() => filterDaysWithMatches(days), [days]);
  const currentDay = visibleDays[dayIndex] ?? null;

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setHint(null);
    try {
      if (tab === "day") {
        try {
          const res = await getForecastWithFallback(MAX_PREDICTION_DAYS);
          const withMatches = filterDaysWithMatches(res.by_day ?? []);
          if (withMatches.length > 0) {
            const idx = initialDayIndex(withMatches);
            setDays(withMatches);
            setDayIndex(idx);
            setItems(withMatches[idx]?.items ?? []);
            setPick(
              bestWorldCupPick(
                withMatches.flatMap((d) => d.items),
              ) ?? (res.pick && filterWorldCupPredictions([res.pick])[0]) ?? null,
            );
            setHint(res.message ?? res.api_hint ?? null);
          } else {
            throw new Error("Sin partidos en el pronóstico");
          }
        } catch {
          const wc = await getWorldCupCalendar();
          const fromCal = worldCupToForecastDays(wc, MAX_PREDICTION_DAYS);
          const withMatches = filterDaysWithMatches(fromCal);
          setDays(withMatches);
          setDayIndex(initialDayIndex(withMatches));
          setItems(withMatches[initialDayIndex(withMatches)]?.items ?? []);
          setPick(null);
          setHint(
            withMatches.length > 0
              ? "Calendario del Mundial (sin predicciones del modelo aún)."
              : null,
          );
        }
      } else if (tab === "upcoming") {
        const res = await getUpcomingPredictions(40);
        const wcItems = filterWorldCupPredictions(res.items);
        setDays([]);
        setItems(wcItems);
        setPick(null);
        setHint(
          wcItems.length < res.items.length
            ? "Solo partidos del Mundial (se omitieron otras competiciones)."
            : res.hint ?? null,
        );
      } else if (tab === "future") {
        const res = await getFuturePredictions(40);
        const wcItems = filterWorldCupPredictions(res.items);
        setDays([]);
        setItems(wcItems);
        setPick(null);
        setHint(
          wcItems.length < res.items.length
            ? "Solo partidos del Mundial."
            : res.hint ?? null,
        );
      } else {
        const res = await getPickOfDay();
        const wcPick =
          (res.pick && filterWorldCupPredictions([res.pick])[0]) ??
          bestWorldCupPick(res.pick ? [res.pick] : []);
        setDays([]);
        setItems(wcPick ? [wcPick] : []);
        setPick(wcPick);
        setHint(res.message ?? res.hint ?? null);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Error";
      setError(msg);
      setDays([]);
      setItems([]);
      setPick(null);
      if (msg.toLowerCase().includes("modelo")) {
        setHint("Entrena el modelo en Configuración → pipeline (CSV + Entrenar).");
      }
    } finally {
      setLoading(false);
    }
  }, [tab]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (tab === "day" && currentDay) {
      setItems(currentDay.items);
    }
  }, [tab, dayIndex, currentDay]);

  const goPrev = () => setDayIndex((i) => Math.max(0, i - 1));
  const goNext = () =>
    setDayIndex((i) => Math.min(visibleDays.length - 1, i + 1));

  const tabs: { id: Tab; label: string }[] = [
    { id: "day", label: "Día a día" },
    { id: "upcoming", label: "Próximos" },
    { id: "future", label: "Futuro" },
    { id: "pick", label: "Pick del día" },
  ];

  return (
    <div className="page page--predictions">
      <header className="page-hero">
        <span className="wc-badge">Modelo 1X2</span>
        <h1>Pronósticos</h1>
        <p className="muted">
          Navega día a día (hasta {MAX_PREDICTION_DAYS} días). Si un día no tiene partidos,
          no aparece.
        </p>
      </header>

      <div className="tab-bar">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            className={tab === t.id ? "tab active" : "tab"}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
        <button type="button" className="btn" onClick={load} disabled={loading}>
          Actualizar
        </button>
      </div>

      {error && <ErrorAlert error={error} />}
      {hint && <div className="banner">{hint}</div>}
      {loading && <p className="muted loading-dots">Cargando pronósticos</p>}

      {!loading && tab === "day" && visibleDays.length > 0 && (
        <div className="day-nav">
          <button
            type="button"
            className="btn btn-day-arrow"
            onClick={goPrev}
            disabled={dayIndex <= 0}
            aria-label="Día anterior"
          >
            ←
          </button>
          <div className="day-nav-center">
            <div className="day-pills">
              {visibleDays.map((d, i) => (
                <button
                  key={d.date}
                  type="button"
                  className={`day-pill ${i === dayIndex ? "active" : ""}`}
                  onClick={() => setDayIndex(i)}
                  title={d.label}
                >
                  {formatMatchDateShortEs(d.date)}
                  <span className="day-pill-count">{d.count}</span>
                </button>
              ))}
            </div>
            {currentDay && (
              <p className="day-nav-label muted small">
                {currentDay.label}
                {" · "}
                {currentDay.with_prediction}/{currentDay.count} con predicción
              </p>
            )}
          </div>
          <button
            type="button"
            className="btn btn-day-arrow"
            onClick={goNext}
            disabled={dayIndex >= visibleDays.length - 1}
            aria-label="Día siguiente"
          >
            →
          </button>
        </div>
      )}

      {!loading && pick && tab === "day" && (
        <section className="card">
          <h2 className="section-title section-title--gold">Mejor pick del periodo</h2>
          <MatchCard p={pick} featured />
        </section>
      )}

      {!loading && tab === "day" && currentDay && items.length > 0 && (
        <section className="day-section">
          <div className="match-list">
            {items.map((p) => (
              <MatchCard key={p.external_fixture_id ?? p.match_id} p={p} />
            ))}
          </div>
        </section>
      )}

      {!loading && tab === "day" && visibleDays.length === 0 && !error && (
        <div className="card empty-state">
          <p>No hay partidos en los próximos días.</p>
          <p className="muted small">Sincroniza el calendario desde Inicio o Calendario.</p>
        </div>
      )}

      {!loading && tab !== "day" && items.length > 0 && (
        <div className="match-list">
          {items.map((p) => (
            <MatchCard key={p.external_fixture_id ?? p.match_id} p={p} />
          ))}
        </div>
      )}

      {!loading && tab !== "day" && items.length === 0 && !error && (
        <div className="card empty-state">
          <p>No hay pronósticos disponibles.</p>
          <p className="muted small">
            <Link to="/configuracion">Configuración</Link> → ejecuta el pipeline de datos.
          </p>
        </div>
      )}
    </div>
  );
}
