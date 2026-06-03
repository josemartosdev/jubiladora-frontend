import { useState } from "react";
import type { MarketBet, ProAnalysis } from "../api/client";
import { ProbBars } from "./ProbBars";

const TABS = [
  { id: "Resumen", icon: "◈" },
  { id: "Simulacion", icon: "⚡" },
  { id: "Apuestas", icon: "◎" },
  { id: "Forma", icon: "▤" },
] as const;

type TabId = (typeof TABS)[number]["id"];

const TIER_CLASS: Record<string, string> = {
  safe: "bet-tier safe",
  balanced: "bet-tier balanced",
  risk: "bet-tier risk",
};

export function MatchProAnalysis({
  analysis,
  probs1x2,
}: {
  analysis: ProAnalysis;
  probs1x2?: { home: number; draw: number; away: number };
}) {
  const [tab, setTab] = useState<TabId>("Resumen");
  const sim = analysis.simulation;
  const markets = sim.markets;

  const betsByCat = analysis.all_bets.reduce<Record<string, MarketBet[]>>(
    (acc, b) => {
      (acc[b.category] ??= []).push(b);
      return acc;
    },
    {},
  );

  return (
    <div className="pro-analysis">
      <div className="tab-bar">
        {TABS.map(({ id, icon }) => (
          <button
            key={id}
            type="button"
            className={tab === id ? "tab active" : "tab"}
            onClick={() => setTab(id)}
          >
            <span aria-hidden>{icon} </span>
            {id}
          </button>
        ))}
      </div>

      {tab === "Resumen" && (
        <div className="tab-panel">
          <div className="kpi-grid">
            <div className="kpi">
              <span>xG local</span>
              <strong>{sim.expected_home_goals}</strong>
            </div>
            <div className="kpi">
              <span>xG visitante</span>
              <strong>{sim.expected_away_goals}</strong>
            </div>
            <div className="kpi accent">
              <span>Goles totales esp.</span>
              <strong>{sim.expected_total_goals}</strong>
            </div>
            <div className="kpi">
              <span>Mediana MC</span>
              <strong>{sim.monte_carlo.total_goals_median}</strong>
            </div>
          </div>
          {probs1x2 && (
            <div className="card inner">
              <h3>1X2 (modelo + Poisson)</h3>
              <ProbBars probs={probs1x2} />
              <p className="muted small">
                Poisson: {markets.home_win * 100}% / {markets.draw * 100}% /{" "}
                {markets.away_win * 100}%
              </p>
            </div>
          )}
          {analysis.narrative.length > 0 && (
            <div className="narrative-list">
              {analysis.narrative.map((n) => (
                <article key={n.title} className="narrative-block">
                  <h4>{n.title}</h4>
                  <p>{n.body}</p>
                </article>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === "Simulacion" && (
        <div className="tab-panel">
          <div className="kpi-grid">
            <div className="kpi">
              <span>Over 2.5</span>
              <strong>{(markets.over_25 * 100).toFixed(0)}%</strong>
            </div>
            <div className="kpi">
              <span>BTTS</span>
              <strong>{(markets.btts_yes * 100).toFixed(0)}%</strong>
            </div>
            <div className="kpi">
              <span>Corners esp.</span>
              <strong>{sim.corners.total_expected}</strong>
            </div>
            <div className="kpi">
              <span>Faltas esp.</span>
              <strong>{sim.discipline.fouls_total_expected}</strong>
            </div>
          </div>
          <h3>Marcadores mas probables</h3>
          <div className="score-chips">
            {sim.top_scores.map((s) => (
              <span key={`${s.home}-${s.away}`} className="score-chip">
                {s.home}-{s.away}{" "}
                <em>{(s.probability * 100).toFixed(1)}%</em>
              </span>
            ))}
          </div>
          <h3>Escenarios Monte Carlo (8.000)</h3>
          <ul className="mc-stats">
            <li>
              Goles totales: P10 {sim.monte_carlo.total_goals_p10} — mediana{" "}
              {sim.monte_carlo.total_goals_median} — P90{" "}
              {sim.monte_carlo.total_goals_p90}
            </li>
            <li>
              Partido cerrado (0-1 goles):{" "}
              {(sim.monte_carlo.prob_total_0_1 * 100).toFixed(0)}%
            </li>
            <li>
              Partido abierto (4+ goles):{" "}
              {(sim.monte_carlo.prob_total_4_plus * 100).toFixed(0)}%
            </li>
          </ul>
          <p className="muted small">
            Corners/faltas: {sim.corners.source} · {sim.discipline.source}
          </p>
        </div>
      )}

      {tab === "Apuestas" && (
        <div className="tab-panel">
          <p className="muted small">
            {analysis.all_bets.length} ideas de apuesta por mercado (probabilidad
            modelo, no cuotas reales).
          </p>
          {Object.entries(betsByCat).map(([cat, bets]) => (
            <section key={cat} className="market-group">
              <h3>{cat}</h3>
              <div className="market-bets">
                {bets.map((b) => (
                  <article
                    key={`${b.market}-${b.selection}-${b.tier}`}
                    className={TIER_CLASS[b.tier] ?? "bet-tier"}
                  >
                    <header>
                      <strong>{b.label}</strong>
                      <span>R{b.risk_level}</span>
                    </header>
                    <p className="bet-pick">
                      {b.market}: <strong>{b.selection}</strong> (
                      {(b.model_probability * 100).toFixed(0)}%)
                    </p>
                    <p className="muted small">{b.rationale}</p>
                  </article>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      {tab === "Forma" && (
        <div className="tab-panel two-col">
          {(["home", "away"] as const).map((side) => {
            const f = analysis.team_form[side];
            const label = side === "home" ? "Local" : "Visitante";
            if (!f) return (
              <div key={side} className="card inner">
                <h3>{label}</h3>
                <p className="muted">Sin historial suficiente</p>
              </div>
            );
            return (
              <div key={side} className="card inner">
                <h3>{label}</h3>
                <ul className="form-stats">
                  <li>Partidos: {f.matches_sampled}</li>
                  <li>GF/partido: {f.goals_for_avg}</li>
                  <li>GC/partido: {f.goals_against_avg}</li>
                  <li>Puntos/partido: {f.points_per_game}</li>
                  <li>BTTS: {(f.btts_rate * 100).toFixed(0)}%</li>
                  <li>Over 2.5: {(f.over_25_rate * 100).toFixed(0)}%</li>
                  <li>Porteria a cero: {(f.clean_sheet_rate * 100).toFixed(0)}%</li>
                </ul>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
