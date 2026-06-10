import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  getBettingDaily,
  getBettingPickOfDay,
  getBettingSafeCombo,
  getWorldCupCalendar,
  MAX_PREDICTION_DAYS,
  type BettingDailyPick,
  type BettingDailyDay,
  type BettingPickOfDayResponse,
  type BettingSafeComboResponse,
  type BettingSelection,
  type WorldCupCalendar,
} from "../api/client";
import { ErrorAlert } from "../components/ErrorAlert";
import { BetSlipPanel } from "../components/betting/BetSlipPanel";
import { MatchMarketPicker } from "../components/betting/MatchMarketPicker";
import { useAppClock } from "../context/AppClockContext";
import { useBetSlip } from "../context/BetSlipContext";
import {
  bestPickForDay,
  initialBettingDayIndex,
  mergeWorldCupMatchesIntoDays,
  picksOnDate,
  visibleBettingDays,
} from "../lib/bettingDays";
import { formatMatchDateShortEs } from "../lib/datetimeEs";
import { loadBalance, resetWallet } from "../lib/bettingWallet";

function PickRow({
  pick,
  label,
  inSlip,
  onAdd,
}: {
  pick: BettingDailyPick;
  label: string;
  inSlip: boolean;
  onAdd: () => void;
}) {
  const odds = pick.decimal_odds ?? 0;
  const prob = pick.model_probability ?? 0;
  return (
    <div className="bet-pick-row">
      <div>
        <span className="muted small">{label}</span>
        <strong>
          {pick.home_team} vs {pick.away_team}
        </strong>
        <div className="muted small">
          {pick.market} · {pick.selection}
          {pick.kickoff_at && ` · ${pick.kickoff_at.slice(11, 16)}`}
        </div>
      </div>
      <div className="bet-pick-actions">
        <span className="bet-odd">@{odds.toFixed(2)}</span>
        <div className="muted small">{(prob * 100).toFixed(0)}%</div>
        <button
          type="button"
          className={`bet-pick-btn ${inSlip ? "in-slip" : ""}`}
          onClick={onAdd}
        >
          {inSlip ? "En cupón" : "Añadir"}
        </button>
      </div>
    </div>
  );
}

function applyBettingDays(
  rawDays: BettingDailyDay[],
  wc: WorldCupCalendar | null,
  todayIso: string,
): { merged: BettingDailyDay[]; visible: BettingDailyDay[]; index: number } {
  const merged = wc
    ? mergeWorldCupMatchesIntoDays(rawDays, wc, todayIso, MAX_PREDICTION_DAYS)
    : rawDays;
  const visible = visibleBettingDays(merged, todayIso);
  return {
    merged,
    visible,
    index: initialBettingDayIndex(visible, todayIso),
  };
}

export function BettingPage() {
  const { todayIso, displayLabel } = useAppClock();
  const [balance, setBalance] = useState(loadBalance);
  const [pickOfDay, setPickOfDay] = useState<BettingPickOfDayResponse | null>(null);
  const [safeCombo, setSafeCombo] = useState<BettingSafeComboResponse | null>(null);
  const [bettingDays, setBettingDays] = useState<BettingDailyDay[]>([]);
  const [dayIndex, setDayIndex] = useState(0);
  const [loadingDays, setLoadingDays] = useState(true);
  const [loadingPicks, setLoadingPicks] = useState(true);
  const [errors, setErrors] = useState<unknown[]>([]);
  const { addLeg, replaceLegs, legs } = useBetSlip();
  const slipIds = new Set(legs.map((l) => l.selection_id));

  const visibleDays = useMemo(
    () => visibleBettingDays(bettingDays, todayIso),
    [bettingDays, todayIso],
  );
  const currentDay = visibleDays[dayIndex] ?? null;
  const selectedDate = currentDay?.date ?? todayIso;
  const isToday = selectedDate === todayIso;

  const dayPicks = currentDay?.picks ?? [];
  const dayMatches = currentDay?.matches ?? [];
  const dayFeaturedPick = useMemo(() => bestPickForDay(dayPicks), [dayPicks]);

  const pickOfDayLegs = useMemo(
    () => picksOnDate(pickOfDay?.legs ?? (pickOfDay?.pick ? [pickOfDay.pick] : []), selectedDate),
    [pickOfDay, selectedDate],
  );

  const safeComboLegs = useMemo(() => {
    if (!safeCombo?.legs?.length) return [];
    if (safeCombo.date && safeCombo.date.slice(0, 10) !== selectedDate) return [];
    return picksOnDate(safeCombo.legs, selectedDate);
  }, [safeCombo, selectedDate]);

  const refreshBalance = () => setBalance(loadBalance());

  const load = useCallback(async () => {
    setLoadingDays(true);
    setLoadingPicks(true);
    setErrors([]);
    const errs: unknown[] = [];

    const wcPromise = getWorldCupCalendar().catch((e) => {
      errs.push(e);
      return null;
    });
    const dailyPromise = getBettingDaily(MAX_PREDICTION_DAYS).catch((e) => {
      errs.push(e);
      return null;
    });

    const [wc, daily] = await Promise.all([wcPromise, dailyPromise]);
    const rawDays = daily?.by_day ?? [];
    const { merged, visible, index } = applyBettingDays(rawDays, wc, todayIso);
    setBettingDays(merged);
    setDayIndex(index);
    setLoadingDays(false);

    if (visible.length === 0 && !wc && !daily) {
      setErrors(errs);
    } else if (errs.length > 0 && visible.length === 0) {
      setErrors(errs);
    }

    const [pod, safe] = await Promise.allSettled([
      getBettingPickOfDay(MAX_PREDICTION_DAYS),
      getBettingSafeCombo(0.6, 6),
    ]);

    if (pod.status === "fulfilled") setPickOfDay(pod.value);
    else {
      setPickOfDay(null);
      if (visible.length > 0) errs.push(pod.reason);
    }

    if (safe.status === "fulfilled") setSafeCombo(safe.value);
    else {
      setSafeCombo(null);
      if (visible.length > 0) errs.push(safe.reason);
    }

    if (visible.length > 0) {
      setErrors(errs);
    } else if (errs.length > 0) {
      setErrors(errs);
    }
    setLoadingPicks(false);
  }, [todayIso]);

  useEffect(() => {
    load();
  }, [load]);

  const addPick = (pick: BettingDailyPick) => {
    addLeg(
      {
        match_id: pick.match_id,
        home_team: pick.home_team,
        away_team: pick.away_team,
      },
      pick,
    );
  };

  const addMarketSelection = (
    match: { match_id: number; home_team: string; away_team: string },
    sel: BettingSelection,
  ) => {
    addLeg(match, sel);
  };

  const loadLegsToSlip = (slipLegs: BettingDailyPick[]) => {
    if (slipLegs.length === 0) return;
    replaceLegs(
      slipLegs.map((p) => ({
        match: {
          match_id: p.match_id,
          home_team: p.home_team,
          away_team: p.away_team,
        },
        sel: p,
      })),
    );
  };

  const goPrev = () => setDayIndex((i) => Math.max(0, i - 1));
  const goNext = () => setDayIndex((i) => Math.min(visibleDays.length - 1, i + 1));

  const needsSetup =
    visibleDays.length === 0 &&
    errors.some((e) => {
      const msg = e instanceof Error ? e.message : String(e);
      return msg.includes("500") || msg.toLowerCase().includes("internal");
    });

  const featuredLegs =
    isToday && pickOfDayLegs.length > 0
      ? pickOfDayLegs
      : dayFeaturedPick
        ? [dayFeaturedPick]
        : [];

  const loading = loadingDays;

  return (
    <div className="page page--betting">
      <header className="page-hero">
        <span className="wc-badge">Apuestas ficticias</span>
        <h1>Centro de apuestas</h1>
        <p className="muted">
          Recomendaciones del modelo por día del Mundial. Saldo virtual 1000 € — sin dinero real.
        </p>
        <p className="muted small">Fecha de referencia: {displayLabel}</p>
        <div className="hero-actions">
          <button type="button" className="btn" onClick={load} disabled={loading}>
            {loading ? "Cargando…" : "Actualizar"}
          </button>
        </div>
      </header>

      <div className="wallet-bar">
        <span>
          Saldo: <strong className="wallet-balance">{balance.toFixed(2)} €</strong>
        </span>
        <button
          type="button"
          className="btn"
          onClick={() => {
            resetWallet();
            refreshBalance();
          }}
        >
          Reiniciar saldo
        </button>
      </div>

      {needsSetup && (
        <div className="setup-banner">
          <strong>Apuestas no disponibles</strong>
          <p>
            El backend necesita modelo entrenado y cuotas sincronizadas. Ve a{" "}
            <Link to="/configuracion">Configuración</Link> y ejecuta el pipeline completo
            (1→5) o cada paso por separado.
          </p>
        </div>
      )}
      {errors.length > 0 && !needsSetup && visibleDays.length === 0 && (
        <>
          <ErrorAlert error={errors[0]} />
          {errors.length > 1 && (
            <p className="muted small">
              {errors.length - 1} error(es) adicional(es) en otras peticiones.
            </p>
          )}
        </>
      )}
      {loading && <p className="muted loading-dots">Cargando partidos</p>}

      {!loading && visibleDays.length > 0 && (
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
                  className={`day-pill ${i === dayIndex ? "active" : ""} ${d.date === todayIso ? "today" : ""}`}
                  onClick={() => setDayIndex(i)}
                  title={d.label}
                >
                  {formatMatchDateShortEs(d.date)}
                  <span className="day-pill-count">
                    {d.picks.length > 0 ? d.picks.length : d.matches.length}
                  </span>
                </button>
              ))}
            </div>
            {currentDay && (
              <p className="day-nav-label muted small">
                {currentDay.label}
                {isToday ? " · Hoy" : ""}
                {" · "}
                {currentDay.picks.length} pick{currentDay.picks.length === 1 ? "" : "s"}
                {" · "}
                {currentDay.match_count ?? currentDay.matches.length} partido
                {(currentDay.match_count ?? currentDay.matches.length) === 1 ? "" : "s"}
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

      <div className="betting-layout">
        <div>
          {!loading && visibleDays.length === 0 && (
            <div className="card empty-state">
              <p>No hay partidos del Mundial en los próximos días.</p>
              <p className="muted small">
                Sincroniza el calendario en{" "}
                <Link to="/configuracion">Configuración</Link> o revisa la fecha de
                referencia arriba.
              </p>
            </div>
          )}

          {loadingPicks && !loading && visibleDays.length > 0 && (
            <p className="muted small loading-dots">Cargando recomendaciones del modelo</p>
          )}

          {!loading && currentDay && (
            <div className="bet-hero-grid">
              <section className="card bet-hero-card">
                <h3>{isToday ? "Apuesta del día" : `Mejor pick · ${currentDay.label}`}</h3>
                {!loadingPicks && featuredLegs.length > 0 ? (
                  <>
                    {featuredLegs.map((p) => (
                      <PickRow
                        key={p.selection_id}
                        pick={p}
                        label={
                          isToday
                            ? (pickOfDay?.rationale ?? "Recomendación del día")
                            : "Mayor probabilidad del modelo"
                        }
                        inSlip={slipIds.has(p.selection_id)}
                        onAdd={() => addPick(p)}
                      />
                    ))}
                    {isToday && pickOfDay?.combined_odds != null && pickOfDayLegs.length > 1 && (
                      <p className="muted small">
                        Cuota combinada @{pickOfDay.combined_odds.toFixed(2)}
                        {pickOfDay.combined_probability_pct != null &&
                          ` · ${pickOfDay.combined_probability_pct}% prob.`}
                      </p>
                    )}
                    <button
                      type="button"
                      className="btn btn-primary btn-block"
                      onClick={() => loadLegsToSlip(featuredLegs)}
                    >
                      Cargar en cupón
                    </button>
                  </>
                ) : (
                  <p className="muted small">
                    {loadingPicks
                      ? "Buscando recomendaciones…"
                      : isToday
                        ? (pickOfDay?.message ?? "Sin apuesta destacada para hoy")
                        : "Sin picks recomendados para este día"}
                    {!loadingPicks && dayMatches.length > 0 && (
                      <>
                        {" "}
                        Elige un partido abajo y apuesta a los mercados disponibles.
                      </>
                    )}
                  </p>
                )}
              </section>

              <section className="card bet-hero-card">
                <h3>Combinada segura</h3>
                {!loadingPicks && safeComboLegs.length > 0 ? (
                  <>
                    {safeComboLegs.map((p) => (
                      <PickRow
                        key={p.selection_id}
                        pick={p}
                        label={p.category}
                        inSlip={slipIds.has(p.selection_id)}
                        onAdd={() => addPick(p)}
                      />
                    ))}
                    {safeCombo?.combined_odds != null && (
                      <p className="muted small">
                        @{safeCombo.combined_odds.toFixed(2)}
                        {safeCombo.combined_probability_pct != null &&
                          ` · ${safeCombo.combined_probability_pct}%`}
                      </p>
                    )}
                    <button
                      type="button"
                      className="btn btn-primary btn-block"
                      onClick={() => loadLegsToSlip(safeComboLegs)}
                    >
                      Cargar combinada
                    </button>
                  </>
                ) : (
                  <p className="muted small">
                    {loadingPicks
                      ? "Buscando combinada…"
                      : (safeCombo?.message ??
                        (isToday
                          ? "Sin combinada segura hoy"
                          : "La combinada segura solo aplica al día en curso"))}
                  </p>
                )}
              </section>
            </div>
          )}

          {!loading && dayPicks.length > 0 && (
            <section className="card" style={{ marginTop: "1rem" }}>
              <h3 className="section-title">
                Todos los picks · {currentDay?.label}
              </h3>
              {dayPicks.map((p) => (
                <PickRow
                  key={p.selection_id}
                  pick={p}
                  label={p.category}
                  inSlip={slipIds.has(p.selection_id)}
                  onAdd={() => addPick(p)}
                />
              ))}
            </section>
          )}

          {!loading && currentDay && dayMatches.length > 0 && (
            <MatchMarketPicker
              matches={dayMatches}
              dayLabel={currentDay.label}
              slipIds={slipIds}
              onAdd={addMarketSelection}
            />
          )}

          {!loading && currentDay && dayMatches.length === 0 && (
            <div className="card empty-state" style={{ marginTop: "1rem" }}>
              <p>No hay partidos del Mundial para {currentDay.label}.</p>
              <p className="muted small">Prueba otro día con el selector de arriba.</p>
            </div>
          )}
        </div>

        <BetSlipPanel balance={balance} onBalanceChange={refreshBalance} />
      </div>
    </div>
  );
}
