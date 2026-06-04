import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  getBettingDaily,
  getBettingMatchBestCombo,
  getBettingMatchMarkets,
  getBettingOutrights,
  getBettingPickOfDay,
  getBettingSafeCombo,
  type BettingDailyPick,
  type BettingDayMatch,
  type BettingDailyResponse,
  type BettingMatchMarketsResponse,
  type BettingOutrightsResponse,
  type BettingSelection,
} from "../api/client";
import { BetSlipPanel } from "../components/betting/BetSlipPanel";
import { useAppClock } from "../context/AppClockContext";
import { useBetSlip } from "../context/BetSlipContext";
import {
  formatKickoffTimeEs,
  formatMatchDateShortEs,
} from "../lib/datetimeEs";
import { loadBalance, resetWallet } from "../lib/bettingWallet";

const CATEGORY_ORDER = [
  "Resultado",
  "Goles",
  "Ambos marcan",
  "Goles jugador",
  "Tiros",
  "Asistencias",
  "Pases",
  "Tarjetas",
  "Tarjetas jugador",
  "Faltas",
  "Faltas jugador",
  "Corners",
  "Primera parte",
  "Marcador",
  "Combinadas",
  "Especiales",
  "Torneo — Fase de grupos",
  "Torneo — Clasificacion",
  "Torneo — Fase final",
  "Torneo — Campeon",
  "Torneo — Goleador",
  "Torneo — Grupos",
  "Torneo — Especiales",
];

type Tab = "recomendadas" | "combinada" | "cuotas" | "generales";

function ComboByCategory({
  legsByCategory,
  activeIds,
  onPick,
}: {
  legsByCategory: Record<string, BettingDailyPick[]>;
  activeIds: Set<string>;
  onPick: (p: BettingDailyPick) => void;
}) {
  return (
    <div className="bet-combo-catalog">
      {sortCategories(Object.keys(legsByCategory)).map((cat) => (
        <div key={cat} className="bet-combo-cat-block">
          <h4>
            <CategoryTag cat={cat} /> {cat}
          </h4>
          <ul>
            {legsByCategory[cat].map((leg) => (
              <li key={leg.selection_id}>
                <button
                  type="button"
                  className={`bet-combo-leg-btn ${activeIds.has(leg.selection_id) ? "in-slip" : ""}`}
                  onClick={() => onPick(leg)}
                >
                  <span className="muted small">{leg.market}</span>
                  <strong>{leg.selection}</strong>
                  <span className="bet-odd-price">@{leg.decimal_odds.toFixed(2)}</span>
                  <span>{(leg.model_probability * 100).toFixed(0)}%</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

function groupLegsByCategory(
  legs: BettingDailyPick[],
): Record<string, BettingDailyPick[]> {
  const out: Record<string, BettingDailyPick[]> = {};
  for (const leg of legs) {
    const cat = leg.category || "Otros";
    (out[cat] ??= []).push(leg);
  }
  return out;
}

function sortCategories(keys: string[]): string[] {
  return [...keys].sort((a, b) => {
    const ia = CATEGORY_ORDER.indexOf(a);
    const ib = CATEGORY_ORDER.indexOf(b);
    return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
  });
}

function OddButton({
  sel,
  active,
  onPick,
}: {
  sel: BettingSelection;
  active: boolean;
  onPick: () => void;
}) {
  return (
    <button
      type="button"
      className={`bet-odd-btn ${active ? "active" : ""} ${sel.recommended ? "rec" : ""}`}
      onClick={onPick}
      title="Anadir al cupon"
    >
      <span className="bet-odd-sel">{sel.selection}</span>
      <span className="bet-odd-price">{sel.decimal_odds.toFixed(2)}</span>
      <span className="bet-odd-prob">{(sel.model_probability * 100).toFixed(0)}%</span>
    </button>
  );
}

function CategoryTag({ cat }: { cat?: string }) {
  if (!cat) return null;
  return <span className="bet-cat-tag">{cat}</span>;
}

export function BettingPage() {
  const [tab, setTab] = useState<Tab>("recomendadas");
  const [balance, setBalance] = useState(loadBalance);
  const [daily, setDaily] = useState<BettingDailyResponse | null>(null);
  const [loadingDaily, setLoadingDaily] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedMatchId, setSelectedMatchId] = useState<number | null>(null);
  const [markets, setMarkets] = useState<BettingMatchMarketsResponse | null>(
    null,
  );
  const [loadingMarkets, setLoadingMarkets] = useState(false);
  const [openCats, setOpenCats] = useState<Set<string>>(
    new Set([
      "Resultado",
      "Goles",
      "Goles jugador",
      "Tiros",
      "Asistencias",
      "Pases",
      "Corners",
      "Tarjetas",
      "Tarjetas jugador",
      "Faltas",
    ]),
  );
  const [matchComboLegs, setMatchComboLegs] = useState<Record<
    string,
    BettingDailyPick[]
  > | null>(null);
  const [matchComboMeta, setMatchComboMeta] = useState<{
    home: string;
    away: string;
    combined_odds?: number;
    combined_probability_pct?: number;
    rationale?: string;
  } | null>(null);
  const [generatingCombo, setGeneratingCombo] = useState(false);
  const [outrights, setOutrights] = useState<BettingOutrightsResponse | null>(
    null,
  );
  const [loadingOutrights, setLoadingOutrights] = useState(false);
  const [betOfDayLegs, setBetOfDayLegs] = useState<BettingDailyPick[] | null>(
    null,
  );
  const [betOfDayMeta, setBetOfDayMeta] = useState<{
    combined_odds?: number;
    combined_probability_pct?: number;
    rationale?: string;
  } | null>(null);
  const [generatingDay, setGeneratingDay] = useState(false);
  const [safeComboLegs, setSafeComboLegs] = useState<BettingDailyPick[] | null>(
    null,
  );
  const [safeComboMeta, setSafeComboMeta] = useState<{
    combined_odds?: number;
    combined_probability_pct?: number;
    rationale?: string;
    matches_today?: number;
    matches_in_combo?: number;
    min_probability_pct?: number;
  } | null>(null);
  const [generatingSafe, setGeneratingSafe] = useState(false);
  const { addLeg, replaceLegs, legs } = useBetSlip();
  const { syncClock, todayIso } = useAppClock();

  const refreshBalance = () => setBalance(loadBalance());

  const loadDaily = useCallback(async () => {
    setLoadingDaily(true);
    setError(null);
    try {
      const data = await getBettingDaily(7);
      setDaily(data);
      if (data.app_clock) syncClock(data.app_clock);
      const first = data.by_day[0]?.matches[0]?.match_id;
      if (first) setSelectedMatchId((prev) => prev ?? first);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al cargar apuestas");
    } finally {
      setLoadingDaily(false);
    }
  }, [syncClock]);

  useEffect(() => {
    loadDaily();
  }, [loadDaily]);

  useEffect(() => {
    if (!selectedMatchId) {
      setMarkets(null);
      return;
    }
    let cancelled = false;
    setLoadingMarkets(true);
    getBettingMatchMarkets(selectedMatchId)
      .then((m) => {
        if (!cancelled) setMarkets(m);
      })
      .catch(() => {
        if (!cancelled) setMarkets(null);
      })
      .finally(() => {
        if (!cancelled) setLoadingMarkets(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedMatchId]);

  const activeIds = useMemo(
    () => new Set(legs.map((l) => l.selection_id)),
    [legs],
  );

  const addToSlip = (
    match: { match_id: number; home_team: string; away_team: string },
    sel: BettingSelection,
  ) => {
    addLeg(match, sel);
  };

  const addManyToSlip = (items: BettingDailyPick[]) => {
    replaceLegs(
      items.map((p) => ({
        match: {
          match_id: p.match_id,
          home_team: p.home_team,
          away_team: p.away_team,
        },
        sel: p,
      })),
    );
  };

  const pickLeg = (p: BettingDailyPick) => {
    addToSlip(
      {
        match_id: p.match_id,
        home_team: p.home_team,
        away_team: p.away_team,
      },
      p,
    );
  };

  const generateMatchCombo = async () => {
    if (!selectedMatchId) return;
    setGeneratingCombo(true);
    setError(null);
    try {
      const res = await getBettingMatchBestCombo(selectedMatchId, 8);
      setMatchComboLegs(res.legs_by_category);
      setMatchComboMeta({
        home: res.home_team,
        away: res.away_team,
        combined_odds: res.combined_odds,
        combined_probability_pct: res.combined_probability_pct,
        rationale: res.rationale,
      });
      addManyToSlip(res.legs);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al generar combinada");
    } finally {
      setGeneratingCombo(false);
    }
  };

  useEffect(() => {
    if (tab !== "generales" || outrights) return;
    setLoadingOutrights(true);
    getBettingOutrights()
      .then(setOutrights)
      .catch(() => setOutrights(null))
      .finally(() => setLoadingOutrights(false));
  }, [tab, outrights]);

  const toggleCat = (cat: string) => {
    setOpenCats((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  };

  const allMatches = useMemo(() => {
    if (!daily) return [];
    return daily.by_day.flatMap((d) =>
      d.matches.map((m) => ({ ...m, dayLabel: d.label })),
    );
  }, [daily]);

  const generateSafeCombo = async () => {
    setGeneratingSafe(true);
    setError(null);
    try {
      const res = await getBettingSafeCombo(0.6, 12);
      if (res.status !== "ok" || !res.legs?.length) {
        setError(res.message ?? "No hay combinada segura disponible hoy");
        setSafeComboLegs(null);
        setSafeComboMeta(null);
        return;
      }
      setSafeComboLegs(res.legs);
      setSafeComboMeta({
        combined_odds: res.combined_odds,
        combined_probability_pct: res.combined_probability_pct,
        rationale: res.rationale,
        matches_today: res.matches_today,
        matches_in_combo: res.matches_in_combo,
        min_probability_pct: res.min_probability_pct,
      });
      addManyToSlip(res.legs);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al generar combinada segura");
      setSafeComboLegs(null);
      setSafeComboMeta(null);
    } finally {
      setGeneratingSafe(false);
    }
  };

  const generateBetOfDay = async () => {
    setGeneratingDay(true);
    setError(null);
    try {
      const res = await getBettingPickOfDay(5);
      const comboLegs = res.legs?.length ? res.legs : res.pick ? [res.pick] : [];
      if (res.status !== "ok" || comboLegs.length === 0) {
        setError(res.message ?? "No se pudo generar la apuesta del dia");
        setBetOfDayLegs(null);
        setBetOfDayMeta(null);
        return;
      }
      setBetOfDayLegs(comboLegs);
      setBetOfDayMeta({
        combined_odds: res.combined_odds,
        combined_probability_pct: res.combined_probability_pct,
        rationale: res.rationale,
      });
      addManyToSlip(comboLegs);
      setTab("recomendadas");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al generar");
    } finally {
      setGeneratingDay(false);
    }
  };

  const firstLeg = betOfDayLegs?.[0];

  return (
    <div className="page betting-page">
      <header className="betting-header">
        <div>
          <span className="page-badge bet-badge">Apuestas ficticias</span>
          <h1>Centro de apuestas</h1>
          <p className="muted">
            Pulsa una cuota para anadirla al cupon. Hoy ({todayIso}):{" "}
            <strong>{daily?.today_match_count ?? "—"}</strong> partidos.
          </p>
        </div>
        <div className="betting-header-actions">
          <button
            type="button"
            className="btn primary bet-generate-safe"
            disabled={generatingSafe || loadingDaily}
            onClick={generateSafeCombo}
            title="Cada pierna con probabilidad modelo ≥ 60%; optimiza prob. conjunta y cuota"
          >
            {generatingSafe ? "Calculando…" : "Combinada segura (≥60%)"}
          </button>
          <button
            type="button"
            className="btn ghost bet-generate-day"
            disabled={generatingDay || loadingDaily}
            onClick={generateBetOfDay}
          >
            {generatingDay ? "Generando…" : "Apuesta del dia"}
          </button>
          <div className="betting-wallet">
            <div className="betting-balance">
              <span>Saldo ficticio</span>
              <strong>{balance.toFixed(2)} €</strong>
            </div>
            <button
              type="button"
              className="btn ghost small"
              onClick={() => {
                resetWallet();
                refreshBalance();
              }}
            >
              Recargar 1000 €
            </button>
          </div>
        </div>
      </header>

      {safeComboLegs && safeComboLegs.length > 0 && (
        <section className="card bet-of-day-hero bet-safe-combo-hero">
          <div className="bet-of-day-badge bet-safe-badge">
            Combinada segura · cada pierna ≥{" "}
            {safeComboMeta?.min_probability_pct ?? 60}%
          </div>
          <p className="bet-safe-meta muted small">
            {safeComboMeta?.matches_in_combo ?? safeComboLegs.length} partido(s) ·{" "}
            {safeComboLegs.length} piernas de{" "}
            {safeComboMeta?.matches_today ?? "—"} hoy
          </p>
          {safeComboMeta?.combined_odds != null && (
            <p className="bet-of-day-combo-summary">
              Cuota combinada{" "}
              <strong className="bet-odd-price">
                @{safeComboMeta.combined_odds.toFixed(2)}
              </strong>
              {safeComboMeta.combined_probability_pct != null && (
                <>
                  {" "}
                  · Prob. conjunta {safeComboMeta.combined_probability_pct}%
                </>
              )}
              <span className="muted small"> — en tu cupon</span>
            </p>
          )}
          <ComboByCategory
            legsByCategory={groupLegsByCategory(safeComboLegs)}
            activeIds={activeIds}
            onPick={pickLeg}
          />
          {safeComboMeta?.rationale && (
            <p className="bet-of-day-rationale muted small">
              {safeComboMeta.rationale}
            </p>
          )}
          <button
            type="button"
            className="btn ghost small"
            onClick={generateSafeCombo}
            disabled={generatingSafe}
          >
            Recalcular
          </button>
        </section>
      )}

      {betOfDayLegs && betOfDayLegs.length > 0 && firstLeg && (
        <section className="card bet-of-day-hero">
          <div className="bet-of-day-badge">Apuesta del dia · combinada</div>
          <h2>
            {firstLeg.home_team} <span className="vs">vs</span> {firstLeg.away_team}
          </h2>
          {firstLeg.kickoff_at && (
            <p className="bet-of-day-time">
              {formatKickoffTimeEs(firstLeg.date ?? "", firstLeg.kickoff_at)}
            </p>
          )}
          {betOfDayMeta?.combined_odds != null && (
            <p className="bet-of-day-combo-summary">
              Cuota combinada{" "}
              <strong className="bet-odd-price">
                @{betOfDayMeta.combined_odds.toFixed(2)}
              </strong>
              {betOfDayMeta.combined_probability_pct != null && (
                <>
                  {" "}
                  · Prob. modelo {betOfDayMeta.combined_probability_pct}%
                </>
              )}
              <span className="muted small"> — ya en tu cupon</span>
            </p>
          )}
          <ComboByCategory
            legsByCategory={groupLegsByCategory(betOfDayLegs)}
            activeIds={activeIds}
            onPick={pickLeg}
          />
          {betOfDayMeta?.rationale && (
            <p className="bet-of-day-rationale muted small">{betOfDayMeta.rationale}</p>
          )}
          <button
            type="button"
            className="btn ghost small"
            onClick={generateBetOfDay}
            disabled={generatingDay}
          >
            Regenerar
          </button>
        </section>
      )}

      <div className="betting-tabs">
        {(
          [
            ["recomendadas", "Recomendadas"],
            ["combinada", "Combinada partido"],
            ["cuotas", "Todas las cuotas"],
            ["generales", "Apuestas generales"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            className={tab === id ? "active" : ""}
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
        <span className="betting-tab-slip muted">
          Cupon ({legs.length}) →
        </span>
      </div>

      {error && <div className="alert">{error}</div>}

      <div className="betting-layout">
        <div className="betting-main">
          {tab === "recomendadas" && (
            <section className="card betting-recs">
              {loadingDaily ? (
                <p className="muted loading-dots">Cargando recomendaciones</p>
              ) : daily ? (
                <>
                  {daily.top_picks.length > 0 && (
                    <div className="bet-top-picks">
                      <h2>Top del modelo (todos los mercados)</h2>
                      <div className="bet-picks-grid">
                        {daily.top_picks.slice(0, 12).map((p) => (
                          <article
                            key={`${p.match_id}-${p.selection_id}`}
                            className={`bet-pick-card ${activeIds.has(p.selection_id) ? "in-slip" : ""}`}
                            role="button"
                            tabIndex={0}
                            onClick={() =>
                              addToSlip(
                                {
                                  match_id: p.match_id,
                                  home_team: p.home_team,
                                  away_team: p.away_team,
                                },
                                p,
                              )
                            }
                            onKeyDown={(e) => {
                              if (e.key === "Enter" || e.key === " ") {
                                e.preventDefault();
                                addToSlip(
                                  {
                                    match_id: p.match_id,
                                    home_team: p.home_team,
                                    away_team: p.away_team,
                                  },
                                  p,
                                );
                              }
                            }}
                          >
                            <header>
                              <CategoryTag cat={p.category} />
                              <span className="bet-pick-match">
                                {p.home_team} vs {p.away_team}
                              </span>
                            </header>
                            <p className="bet-pick-market">{p.market}</p>
                            <strong>{p.selection}</strong>
                            <div className="bet-pick-foot">
                              <span className="bet-odd-price">
                                @{p.decimal_odds.toFixed(2)}
                              </span>
                              <span>{(p.model_probability * 100).toFixed(0)}%</span>
                            </div>
                          </article>
                        ))}
                      </div>
                    </div>
                  )}
                  {daily.by_day.map((day) => (
                    <div key={day.date} className="bet-day-block">
                      <h3>
                        {day.label || formatMatchDateShortEs(day.date)}{" "}
                        <span className="muted">
                          — {day.match_count ?? day.matches.length} partidos
                        </span>
                      </h3>
                      {day.matches.length > 0 ? (
                        <div className="bet-day-matches">
                          {day.matches.map((m: BettingDayMatch) => (
                            <article key={m.match_id} className="bet-day-match-card">
                              <div className="bet-day-match-main">
                                <strong>
                                  {m.home_team} vs {m.away_team}
                                </strong>
                                {m.kickoff_at && (
                                  <span className="match-card-kickoff">
                                    {formatKickoffTimeEs(m.date ?? day.date, m.kickoff_at)}{" "}
                                    ES
                                  </span>
                                )}
                                <span className="muted small">
                                  {m.tournament}
                                  {m.selections_count > 0 &&
                                    ` · ${m.selections_count} mercados`}
                                </span>
                              </div>
                              <div className="bet-day-match-actions">
                                <Link
                                  to={`/partido/${m.match_id}`}
                                  className="btn ghost small"
                                >
                                  Ficha
                                </Link>
                                <button
                                  type="button"
                                  className="btn small"
                                  onClick={() => {
                                    setSelectedMatchId(m.match_id);
                                    setTab("combinada");
                                  }}
                                >
                                  Combinada
                                </button>
                              </div>
                            </article>
                          ))}
                        </div>
                      ) : (
                        <p className="muted small">Sin partidos este dia.</p>
                      )}
                      {day.picks.length > 0 && (
                        <>
                          <h4 className="bet-day-picks-title">Mejores cuotas del dia</h4>
                          <ul className="bet-day-picks">
                            {day.picks.map((p) => (
                              <li key={`${p.match_id}-${p.selection_id}`}>
                                <button
                                  type="button"
                                  className={`bet-day-pick-btn ${activeIds.has(p.selection_id) ? "in-slip" : ""}`}
                                  onClick={() =>
                                    addToSlip(
                                      {
                                        match_id: p.match_id,
                                        home_team: p.home_team,
                                        away_team: p.away_team,
                                      },
                                      p,
                                    )
                                  }
                                >
                                  <CategoryTag cat={p.category} />
                                  <span>
                                    {p.home_team} – {p.away_team}
                                  </span>
                                  <span className="muted">
                                    {p.market}: {p.selection}
                                  </span>
                                  <strong>@{p.decimal_odds.toFixed(2)}</strong>
                                </button>
                              </li>
                            ))}
                          </ul>
                        </>
                      )}
                    </div>
                  ))}
                  <p className="muted small">{daily.disclaimer}</p>
                </>
              ) : null}
            </section>
          )}

          {tab === "combinada" && (
            <div className="betting-odds-split">
              <aside className="bet-match-list card">
                <h2>Elige partido</h2>
                <ul>
                  {allMatches.map((m) => (
                    <li key={m.match_id}>
                      <button
                        type="button"
                        className={
                          selectedMatchId === m.match_id ? "active" : ""
                        }
                        onClick={() => {
                          setSelectedMatchId(m.match_id);
                          setMatchComboLegs(null);
                          setMatchComboMeta(null);
                        }}
                      >
                        {m.home_team} vs {m.away_team}
                      </button>
                    </li>
                  ))}
                </ul>
                <button
                  type="button"
                  className="btn primary bet-generate-day"
                  disabled={!selectedMatchId || generatingCombo}
                  onClick={generateMatchCombo}
                >
                  {generatingCombo
                    ? "Calculando…"
                    : "Mejor combinada de este partido"}
                </button>
              </aside>
              <section className="card bet-combo-result">
                {matchComboMeta ? (
                  <>
                    <h2>
                      {matchComboMeta.home}{" "}
                      <span className="vs">vs</span> {matchComboMeta.away}
                    </h2>
                    {matchComboMeta.combined_odds != null && (
                      <p className="bet-of-day-combo-summary">
                        Cuota @{matchComboMeta.combined_odds.toFixed(2)}
                        {matchComboMeta.combined_probability_pct != null &&
                          ` · ${matchComboMeta.combined_probability_pct}% modelo`}
                        <span className="muted small"> — en cupon</span>
                      </p>
                    )}
                    {matchComboMeta.rationale && (
                      <p className="muted small">{matchComboMeta.rationale}</p>
                    )}
                    {matchComboLegs && (
                      <ComboByCategory
                        legsByCategory={matchComboLegs}
                        activeIds={activeIds}
                        onPick={pickLeg}
                      />
                    )}
                  </>
                ) : (
                  <p className="muted">
                    Selecciona un partido y genera la mejor combinada (resultado,
                    goles, tiros, asistencias, pases, tarjetas, faltas, corners…).
                  </p>
                )}
              </section>
            </div>
          )}

          {tab === "generales" && (
            <section className="card betting-outrights">
              {loadingOutrights ? (
                <p className="muted loading-dots">Cargando mercados de torneo</p>
              ) : outrights?.status === "ok" ? (
                <>
                  <h2>Apuestas generales — {outrights.tournament}</h2>
                  <p className="muted small">{outrights.disclaimer}</p>
                  {sortCategories(Object.keys(outrights.by_category)).map(
                    (cat) => (
                      <div key={cat} className="bet-market-group">
                        <h3 className="bet-outright-cat">
                          <CategoryTag cat={cat} /> {cat}
                        </h3>
                        <div className="bet-outright-grid">
                          {outrights.by_category[cat].map((sel) => (
                            <button
                              key={sel.selection_id}
                              type="button"
                              className={`bet-outright-btn ${activeIds.has(sel.selection_id) ? "in-slip" : ""}`}
                              onClick={() =>
                                addToSlip(
                                  {
                                    match_id: 0,
                                    home_team: "",
                                    away_team: "",
                                  },
                                  sel,
                                )
                              }
                            >
                              <span className="muted small">{sel.market}</span>
                              <strong>{sel.selection}</strong>
                              <span className="bet-odd-price">
                                @{sel.decimal_odds.toFixed(2)}
                              </span>
                            </button>
                          ))}
                        </div>
                      </div>
                    ),
                  )}
                </>
              ) : (
                <p className="muted">
                  {outrights?.message ?? "Sin mercados de torneo."}
                </p>
              )}
            </section>
          )}

          {tab === "cuotas" && (
            <div className="betting-odds-split">
              <aside className="bet-match-list card">
                <h2>Partidos</h2>
                {loadingDaily ? (
                  <p className="muted small">Cargando…</p>
                ) : (
                  <ul>
                    {allMatches.map((m) => (
                      <li key={m.match_id}>
                        <button
                          type="button"
                          className={
                            selectedMatchId === m.match_id ? "active" : ""
                          }
                          onClick={() => setSelectedMatchId(m.match_id)}
                        >
                          <span>
                            {m.home_team} vs {m.away_team}
                          </span>
                          <span className="muted small">
                            {m.selections_count} mercados
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </aside>

              <section className="bet-markets card">
                {loadingMarkets ? (
                  <p className="muted loading-dots">Cargando mercados</p>
                ) : markets ? (
                  <>
                    <header className="bet-markets-head">
                      <h2>
                        {markets.home_team}{" "}
                        <span className="vs">vs</span> {markets.away_team}
                      </h2>
                      {markets.kickoff_at && (
                        <span className="match-kickoff-badge">
                          {formatKickoffTimeEs(markets.date, markets.kickoff_at)}
                        </span>
                      )}
                    </header>
                    {sortCategories(Object.keys(markets.by_category)).map(
                      (cat) => {
                        const items = markets.by_category[cat] ?? [];
                        const open = openCats.has(cat);
                        return (
                          <div key={cat} className="bet-market-group">
                            <button
                              type="button"
                              className="bet-market-group-head"
                              onClick={() => toggleCat(cat)}
                            >
                              <span>{cat}</span>
                              <span className="muted">{items.length}</span>
                              <span aria-hidden>{open ? "▾" : "▸"}</span>
                            </button>
                            {open && (
                              <div className="bet-market-rows">
                                {items.map((sel) => (
                                  <div
                                    key={sel.selection_id}
                                    className="bet-market-row"
                                  >
                                    <span className="bet-market-name">
                                      {sel.market}
                                    </span>
                                    <OddButton
                                      sel={sel}
                                      active={activeIds.has(sel.selection_id)}
                                      onPick={() =>
                                        addToSlip(
                                          {
                                            match_id: markets.match_id,
                                            home_team: markets.home_team,
                                            away_team: markets.away_team,
                                          },
                                          sel,
                                        )
                                      }
                                    />
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      },
                    )}
                  </>
                ) : (
                  <p className="muted">Selecciona un partido.</p>
                )}
              </section>
            </div>
          )}
        </div>

        <BetSlipPanel balance={balance} onBalanceChange={refreshBalance} />
      </div>
    </div>
  );
}
