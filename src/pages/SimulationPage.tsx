import { useCallback, useState } from "react";
import { getTournamentSimulation, type TournamentSimulationResponse } from "../api/client";
import { ErrorAlert } from "../components/ErrorAlert";
import { PlayerAchievements } from "../components/simulation/PlayerAchievements";
import { TournamentBracket } from "../components/simulation/TournamentBracket";

export function SimulationPage() {
  const [sim, setSim] = useState<TournamentSimulationResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const runSim = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const seed = Date.now() ^ Math.floor(Math.random() * 1_000_000);
      const res = await getTournamentSimulation(seed);
      if (res.status !== "ok") {
        throw new Error(res.message ?? "Error en simulacion");
      }
      setSim(res);
    } catch (e) {
      setSim(null);
      setError(e instanceof Error ? e.message : "Error al simular");
    } finally {
      setLoading(false);
    }
  }, []);

  const groups = sim?.groups ?? sim?.phases?.find((p) => p.id === "GROUPS")?.groups ?? [];

  return (
    <div className="page page--sim">
      <header className="page-hero page-hero--sim">
        <span className="wc-badge">Mundial 2026</span>
        <h1>Simulación del torneo</h1>
        <p className="muted">
          Calendario WC 2026, 48 selecciones con Elo oficial, plantillas 2025-26 y
          proyección Poisson por jugador.
        </p>
        <div className="hero-actions">
          <button
            type="button"
            className="btn btn-primary btn-sim-run"
            onClick={runSim}
            disabled={loading}
          >
            {loading ? "Simulando…" : sim ? "Volver a simular" : "Simular torneo"}
          </button>
        </div>
      </header>

      {error && <ErrorAlert error={error} />}

      {!sim && !loading && !error && (
        <div className="card empty-state sim-intro">
          <p>
            Pulsa <strong>Simular torneo</strong> para generar grupos, eliminatoria y
            premios individuales con nombres reales de plantilla.
          </p>
        </div>
      )}

      {sim && (
        <>
          <div className="banner">
            {sim.methodology}
            {sim.squads_with_real_names != null && (
              <>
                {" "}
                · {sim.squads_with_real_names}/48 plantillas con jugadores nombrados.
              </>
            )}
          </div>

          {groups.length > 0 && (
            <section>
              <h2 className="section-title section-title--gold">Fase de grupos</h2>
              {sim.calendar_matches_used != null && sim.calendar_matches_total != null && (
                <p className="muted small sim-calendar-hint">
                  {sim.calendar_matches_used} de {sim.calendar_matches_total} partidos usan
                  cruces y fechas del calendario oficial en BD.
                </p>
              )}
              <div className="sim-groups-grid">
                {groups.map((g) => (
                  <div key={g.group} className="card sim-group-card">
                    <h3>{g.label}</h3>
                    <table className="sim-standings">
                      <thead>
                        <tr>
                          <th>Equipo</th>
                          <th>PJ</th>
                          <th>GF</th>
                          <th>GC</th>
                          <th>Pts</th>
                        </tr>
                      </thead>
                      <tbody>
                        {g.standings.map((s) => (
                          <tr key={s.team} className={s.qualified ? "qualified" : ""}>
                            <td>{s.team}</td>
                            <td>{s.played ?? 0}</td>
                            <td>{s.gf}</td>
                            <td>{s.ga}</td>
                            <td>
                              <strong>{s.pts}</strong>
                              {s.qualified && " ✓"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {g.matches.length > 0 && (
                      <ul className="sim-group-matches muted small">
                        {g.matches.map((m) => (
                          <li key={m.code}>
                            {m.date && <span className="sim-match-date">{m.date} · </span>}
                            {m.home} {m.score} {m.away}
                            {m.from_calendar && (
                              <span className="sim-match-cal" title="Partido del calendario">
                                {" "}
                                📅
                              </span>
                            )}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}

          <section>
            <h2 className="section-title section-title--gold">Cuadro eliminatorio</h2>
            <TournamentBracket
              groupAllTeams={sim.groupAllTeams}
              groupQualifiers={sim.groupQualifiers}
              groupEliminated={sim.groupEliminated}
              bracket={sim.bracket}
              champion={sim.champion}
              runnerUp={sim.runnerUp}
            />
          </section>

          <section className="sim-achievements-section">
            <header className="sim-achievements-head">
              <h2 className="section-title section-title--gold">Logros personales</h2>
              <p className="muted small">
                Jugadores de plantilla 2025-26 — proyección del modelo (Poisson + Elo).
              </p>
            </header>
            <PlayerAchievements items={sim.playerAchievements} />
          </section>

          <p className="muted small sim-disclaimer">{sim.disclaimer}</p>
        </>
      )}
    </div>
  );
}
