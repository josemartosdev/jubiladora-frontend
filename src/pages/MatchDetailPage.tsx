import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { getMatchDetail, type MatchDetail } from "../api/client";
import { MatchLineups } from "../components/MatchLineups";
import { MatchLiveBar } from "../components/MatchLiveBar";
import { MatchPlayerOutlook } from "../components/MatchPlayerOutlook";
import { MatchProAnalysis } from "../components/MatchProAnalysis";
import { ProbBars } from "../components/ProbBars";
import {
  formatKickoffTimeEs,
  formatMatchDateShortEs,
  formatMatchScheduleEs,
} from "../lib/datetimeEs";

function teamInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return name.slice(0, 3).toUpperCase();
}

export function MatchDetailPage() {
  const { fixtureId } = useParams<{ fixtureId: string }>();
  const [data, setData] = useState<MatchDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const loadDetail = useCallback(async (silent = false) => {
    const id = Number(fixtureId);
    if (!id) {
      setError("ID de partido invalido");
      setLoading(false);
      return;
    }
    if (!silent) setLoading(true);
    try {
      setData(await getMatchDetail(id));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
      if (!silent) setData(null);
    } finally {
      if (!silent) setLoading(false);
    }
  }, [fixtureId]);

  useEffect(() => {
    loadDetail();
  }, [loadDetail]);

  useEffect(() => {
    if (!data?.live_feed?.is_live) return;
    const id = setInterval(() => loadDetail(true), 45_000);
    return () => clearInterval(id);
  }, [data?.live_feed?.is_live, loadDetail]);

  if (loading) {
    return (
      <p className="muted page loading-dots">Cargando analisis completo</p>
    );
  }
  if (error || !data || data.status !== "ok") {
    return (
      <div className="page">
        <Link to="/">← Volver</Link>
        <div className="alert">{error ?? "Partido no encontrado"}</div>
      </div>
    );
  }

  const pred = data.prediction;
  const pro = data.pro_analysis;
  const m = data.match;
  const kickoff = formatKickoffTimeEs(m.date, m.kickoff_at);
  const scheduleLine = formatMatchScheduleEs(m.date, m.kickoff_at);

  const modeLabel =
    pred?.inference_mode === "ml_elo"
      ? "Modelo ML + Elo"
      : pred?.inference_mode === "db_h2h"
        ? "Base de datos (forma + H2H)"
        : pred?.inference_mode === "db_form"
          ? "Base de datos (forma)"
          : pred?.inference_mode === "db_prior"
            ? "Prior internacional (poca historia)"
            : null;

  return (
    <div className="page match-detail">
      <nav className="match-detail-nav">
        <Link to="/">← Volver al inicio</Link>
      </nav>

      <header className="match-detail-hero card">
        <div className="match-detail-hero-top">
          <span className="page-badge">Ficha pro</span>
          {kickoff && (
            <span className="match-kickoff-badge" title="Hora en España (península)">
              {kickoff}
            </span>
          )}
        </div>
        <h1>
          {m.home_team} <span className="match-title-vs">vs</span> {m.away_team}
        </h1>
        <p className="match-schedule-line">{scheduleLine}</p>
        <p className="match-meta-line muted small">
          {m.tournament}
          {m.round && ` · ${m.round.replaceAll("|", " · ")}`}
          {modeLabel && (
            <>
              {" "}
              · <span className="mode-tag">{modeLabel}</span>
            </>
          )}
        </p>

        <div className="match-spotlight match-spotlight-inline">
          <div className="team-block home">
            <span className="team-crest">{teamInitials(m.home_team)}</span>
            <span className="team-name">{m.home_team}</span>
          </div>
          <span className="vs-badge">VS</span>
          <div className="team-block away">
            <span className="team-crest">{teamInitials(m.away_team)}</span>
            <span className="team-name">{m.away_team}</span>
          </div>
        </div>
      </header>

      {data.live_feed && <MatchLiveBar live={data.live_feed} />}

      <div className="match-detail-body">
        <div className="match-detail-main">
          {data.lineups &&
            (data.lineups.home.starters.length > 0 ||
              data.lineups.away.starters.length > 0) && (
              <MatchLineups lineups={data.lineups} />
            )}

          {pro && (
            <section className="card pro-hero">
              <h2 className="section-title">Resumen del modelo</h2>
              <div className="kpi-grid match-kpi-grid">
                <div className="kpi accent">
                  <span>Goles esperados</span>
                  <strong>{pro.simulation.expected_total_goals}</strong>
                </div>
                <div className="kpi">
                  <span>Over 2.5</span>
                  <strong>
                    {(pro.simulation.markets.over_25 * 100).toFixed(0)}%
                  </strong>
                </div>
                <div className="kpi">
                  <span>BTTS</span>
                  <strong>
                    {(pro.simulation.markets.btts_yes * 100).toFixed(0)}%
                  </strong>
                </div>
                <div className="kpi">
                  <span>Apuestas modelo</span>
                  <strong>{pro.all_bets.length}</strong>
                </div>
                <div className="kpi">
                  <span>xG local</span>
                  <strong>{pro.simulation.expected_home_goals}</strong>
                </div>
                <div className="kpi">
                  <span>xG visitante</span>
                  <strong>{pro.simulation.expected_away_goals}</strong>
                </div>
              </div>
            </section>
          )}

          {data.player_outlook && (
            <MatchPlayerOutlook outlook={data.player_outlook} />
          )}

          {pro ? (
            <section className="card match-analysis-card">
              <h2 className="section-title">Centro de analisis</h2>
              <MatchProAnalysis
                analysis={pro}
                probs1x2={pred?.probabilities}
              />
            </section>
          ) : (
            pred?.has_prediction !== false &&
            pred && (
              <section className="card">
                <h2 className="section-title">Prediccion 1X2</h2>
                <ProbBars probs={pred.probabilities} highlight={pred.pick} />
                <p className="muted">
                  Elo {Math.round(pred.home_elo ?? 0)} — {Math.round(pred.away_elo ?? 0)}
                </p>
              </section>
            )
          )}

          {!pro && data.bet_suggestions.length > 0 && (
            <section className="card">
              <h2 className="section-title">Apuestas sugeridas (basico)</h2>
              <div className="bet-tiers">
                {data.bet_suggestions.map((b) => (
                  <article key={b.tier} className={`bet-tier ${b.tier}`}>
                    <strong>{b.label}</strong>
                    <p>
                      {b.market}: {b.selection} ({(b.model_probability * 100).toFixed(0)}%)
                    </p>
                  </article>
                ))}
              </div>
            </section>
          )}
        </div>

        <aside className="match-detail-aside">
          <section className="card">
            <h2 className="section-title">Selecciones (Elo)</h2>
            <div className="aside-elo-grid">
              {(["home", "away"] as const).map((side) => {
                const t = data.teams[side];
                const elo = t.elo as Record<string, unknown> | null;
                return (
                  <div key={side} className="aside-elo-card">
                    <div className="team-block team-block-start">
                      <span className="team-crest">{teamInitials(t.name)}</span>
                      <h3 className="team-elo-title">{t.name}</h3>
                    </div>
                    {elo ? (
                      <ul className="form-stats">
                        <li>Elo: {String(elo.elo ?? "—")}</li>
                        <li>Ranking: {String(elo.global_rank ?? "—")}</li>
                        <li>
                          Historial: {String(elo.wins ?? 0)}V / {String(elo.draws ?? 0)}E /{" "}
                          {String(elo.losses ?? 0)}D
                        </li>
                      </ul>
                    ) : (
                      <p className="muted">Sin Elo</p>
                    )}
                  </div>
                );
              })}
            </div>
          </section>

          {data.head_to_head.length > 0 && (
            <section className="card">
              <h2 className="section-title">Historial directo</h2>
              <ul className="h2h-list">
                {data.head_to_head.map((h) => (
                  <li key={`${h.date}-${h.home_team}`}>
                    <strong>{formatMatchDateShortEs(h.date)}</strong> — {h.home_team}{" "}
                    <span className="h2h-score">
                      {h.home_goals ?? "?"}–{h.away_goals ?? "?"}
                    </span>{" "}
                    {h.away_team}
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section className="card subtle">
            <h2 className="section-title">Capas de datos</h2>
            <div className="layer-chips">
              {Object.entries(data.data_layers).map(([k, ok]) => (
                <span key={k} className={ok ? "layer on" : "layer"}>
                  {ok ? "✓" : "○"} {k.replaceAll("_", " ")}
                </span>
              ))}
            </div>
            <p className="muted small">{data.roadmap_note}</p>
          </section>
        </aside>
      </div>
    </div>
  );
}
