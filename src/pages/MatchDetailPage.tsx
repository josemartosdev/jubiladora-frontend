import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { getMatchDetail, type MatchDetail } from "../api/client";
import { ErrorAlert } from "../components/ErrorAlert";
import { MatchPlayerOutlook } from "../components/MatchPlayerOutlook";
import { ProbBars } from "../components/ProbBars";
import {
  formatKickoffTimeEs,
  formatMatchScheduleEs,
} from "../lib/datetimeEs";

const PICK_LABEL: Record<string, string> = {
  home: "Victoria local",
  draw: "Empate",
  away: "Victoria visitante",
};

export function MatchDetailPage() {
  const { fixtureId } = useParams<{ fixtureId: string }>();
  const [data, setData] = useState<MatchDetail | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [loading, setLoading] = useState(true);

  const loadDetail = useCallback(async () => {
    const id = Number(fixtureId);
    if (!id) {
      setError("ID inválido");
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      setData(await getMatchDetail(id));
      setError(null);
    } catch (e) {
      setError(e);
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [fixtureId]);

  useEffect(() => {
    loadDetail();
  }, [loadDetail]);

  if (loading) {
    return <p className="muted loading-dots">Cargando partido</p>;
  }
  if (error || !data || data.status !== "ok") {
    return (
      <div className="page">
        <nav className="match-detail-nav">
          <Link to="/">← Mundial</Link>
          {" · "}
          <Link to="/calendario">Calendario</Link>
        </nav>
        {error ? (
          <ErrorAlert error={error} />
        ) : (
          <div className="alert">Partido no encontrado</div>
        )}
        <div className="card empty-state">
          <p className="muted small">
            ID solicitado: {fixtureId}. Si el calendario muestra el partido pero la ficha falla,
            revisa Configuración o los logs del backend en <code>/matches/detail</code>.
          </p>
        </div>
      </div>
    );
  }

  const m = data.match;
  const pred = data.prediction;
  const pro = data.pro_analysis;
  const kickoff = formatKickoffTimeEs(m.date, m.kickoff_at);
  const live = data.live_feed;

  return (
    <div className="page match-detail">
      <nav className="match-detail-nav">
        <Link to="/">← Mundial</Link>
        {" · "}
        <Link to="/apuestas">Apuestas →</Link>
      </nav>

      <header className="page-hero">
        <span className="wc-badge">{m.tournament ?? "Partido"}</span>
        <h1>
          {m.home_team} <span className="featured-vs">vs</span> {m.away_team}
        </h1>
        <p className="muted small">
          {formatMatchScheduleEs(m.date, m.kickoff_at)}
          {kickoff && ` · ${kickoff} (España)`}
          {m.round && ` · ${m.round.replaceAll("|", " · ")}`}
        </p>
        {live?.has_score && live.score && (
          <p style={{ fontSize: "1.5rem", fontWeight: 700, color: "var(--gold)" }}>
            {live.score.home} – {live.score.away}
            {live.is_live && <span className="muted small"> EN DIRECTO</span>}
          </p>
        )}
      </header>

      <div className="detail-grid">
        <div>
          {pred && (
            <section className="card">
              <h2 style={{ margin: "0 0 0.75rem", fontSize: "1rem" }}>
                Pronóstico 1X2
              </h2>
              <p>
                Pick:{" "}
                <span className="pick-chip">
                  {PICK_LABEL[pred.pick] ?? pred.pick}
                </span>
                <span className="muted small">
                  {" "}
                  · {Math.round(pred.confidence * 100)}% confianza
                </span>
              </p>
              <ProbBars probs={pred.probabilities} highlight={pred.pick} />
            </section>
          )}

          {pro && (
            <section className="card" style={{ marginTop: "1rem" }}>
              <h2 style={{ margin: "0 0 0.75rem", fontSize: "1rem" }}>
                Simulación Poisson
              </h2>
              <div className="kpi-row">
                <div className="kpi">
                  <span>Goles local</span>
                  <strong>{pro.simulation.expected_home_goals}</strong>
                </div>
                <div className="kpi">
                  <span>Goles visit.</span>
                  <strong>{pro.simulation.expected_away_goals}</strong>
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
              </div>
              {pro.narrative?.[0] && (
                <p className="muted small">{pro.narrative[0].body}</p>
              )}
            </section>
          )}

          {data.player_outlook && (
            <section className="card" style={{ marginTop: "1rem" }}>
              <h2 style={{ margin: "0 0 0.75rem", fontSize: "1rem" }}>
                Jugadores — plantilla 2025-26
              </h2>
              <MatchPlayerOutlook outlook={data.player_outlook} />
            </section>
          )}

          {data.bet_suggestions.length > 0 && (
            <section className="card" style={{ marginTop: "1rem" }}>
              <h2 style={{ margin: "0 0 0.75rem", fontSize: "1rem" }}>
                Apuestas sugeridas
              </h2>
              <ul className="bet-suggestions-list">
                {data.bet_suggestions.slice(0, 6).map((b, i) => (
                  <li key={i}>
                    <strong>{b.selection}</strong>
                    <span className="muted small"> · {b.market}</span>
                    <div className="muted small">
                      {(b.model_probability * 100).toFixed(0)}% · {b.rationale}
                    </div>
                  </li>
                ))}
              </ul>
              <p style={{ marginTop: "0.75rem" }}>
                <Link to="/apuestas">Ver más en apuestas →</Link>
              </p>
            </section>
          )}
        </div>

        <aside>
          <section className="card">
            <h3 style={{ margin: "0 0 0.75rem", fontSize: "0.95rem" }}>Elo</h3>
            {data.teams.home.elo && (
              <p className="small">
                {m.home_team}:{" "}
                <strong>
                  {Math.round(Number((data.teams.home.elo as { rating?: number }).rating ?? 0))}
                </strong>
              </p>
            )}
            {data.teams.away.elo && (
              <p className="small">
                {m.away_team}:{" "}
                <strong>
                  {Math.round(Number((data.teams.away.elo as { rating?: number }).rating ?? 0))}
                </strong>
              </p>
            )}
            {!data.teams.home.elo && !data.teams.away.elo && (
              <p className="muted small">Sin ratings Elo</p>
            )}
          </section>

          {data.head_to_head.length > 0 && (
            <section className="card" style={{ marginTop: "1rem" }}>
              <h3 style={{ margin: "0 0 0.75rem", fontSize: "0.95rem" }}>
                Historial H2H
              </h3>
              <ul className="bet-suggestions-list">
                {data.head_to_head.slice(0, 5).map((h, i) => (
                  <li key={i}>
                    {h.home_team} {h.home_goals}–{h.away_goals} {h.away_team}
                    <div className="muted small">{h.date}</div>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </aside>
      </div>
    </div>
  );
}
