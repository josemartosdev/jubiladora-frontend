import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ErrorAlert } from "../components/ErrorAlert";
import {
  clearWorldCupCalendarCache,
  getWorldCupCalendar,
  syncWorldCup,
  type FixtureItem,
  type WorldCupCalendar,
} from "../api/client";
import {
  formatKickoffTimeEs,
  formatMatchDateEs,
} from "../lib/datetimeEs";

type TabId = "fechas" | "grupos" | "eliminatoria";

function formatDateLabel(iso: string): string {
  return formatMatchDateEs(iso);
}

function MatchRow({ m }: { m: FixtureItem }) {
  const finished = m.status === "finished" && m.home_goals != null;
  return (
    <div className={`wc-match-row ${m.status === "live" ? "live" : ""}`}>
      <time title="Hora de Espana (peninsula)">
        {formatKickoffTimeEs(m.date, m.kickoff_at) ?? "—"}
      </time>
      <span className="wc-teams">
        <strong>{m.home_team}</strong>
        {finished ? (
          <span className="h2h-score">
            {m.home_goals} – {m.away_goals}
          </span>
        ) : (
          <span className="vs-badge cal-vs-mini">VS</span>
        )}
        <strong>{m.away_team}</strong>
      </span>
      {m.round && <span className="wc-round muted">{m.round.split("|").join(" · ")}</span>}
      {finished && m.result_1x2 && <span className="tag">{m.result_1x2}</span>}
      {m.external_id && (
        <Link className="wc-link" to={`/partido/${m.external_id}`}>
          Ficha →
        </Link>
      )}
    </div>
  );
}

export function CalendarPage() {
  const [data, setData] = useState<WorldCupCalendar | null>(null);
  const [tab, setTab] = useState<TabId>("fechas");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState<string | null>(null);

  const load = useCallback(async (force = false) => {
    setLoading(true);
    setError(null);
    try {
      setData(await getWorldCupCalendar({ force }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleSync() {
    setSyncing(true);
    setSyncMsg(null);
    try {
      const res = await syncWorldCup();
      clearWorldCupCalendarCache();
      setSyncMsg(
        `Sincronizado: ${res.fixtures_fetched ?? 0} partidos (${res.inserted ?? 0} nuevos, ${res.updated ?? 0} actualizados)`,
      );
      await load(true);
    } catch (e) {
      setSyncMsg(e instanceof Error ? e.message : "Error al sincronizar");
    } finally {
      setSyncing(false);
    }
  }

  const groupPhase = data?.phases.find((p) => p.id === "GROUP_STAGE");

  return (
    <div className="page page--calendar">
      <header className="page-hero">
        <span className="wc-badge">Mundial 2026</span>
        <h1>Calendario</h1>
        <p className="muted">
          Grupos A–L, fechas y eliminatoria.
          {data && data.total_matches > 0 && (
            <> · {data.total_matches} partidos ({data.from} → {data.to})</>
          )}
        </p>
        <div style={{ marginTop: "0.75rem", display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleSync}
            disabled={syncing || loading}
          >
            {syncing ? "Sincronizando…" : "Sincronizar Mundial"}
          </button>
          <button type="button" className="btn" onClick={() => void load()} disabled={loading}>
            Actualizar
          </button>
        </div>
      </header>

      {syncMsg && <div className="banner">{syncMsg}</div>}
      {error && <ErrorAlert error={error} />}
      {data?.sync_hint && !error && <div className="banner">{data.sync_hint}</div>}
      {loading && <p className="muted loading-dots">Cargando Mundial</p>}

      {!loading && data && (
        <>
          <div className="wc-tabs tab-bar">
            {(
              [
                ["fechas", "Cronologia"],
                ["grupos", "Grupos A–L"],
                ["eliminatoria", "Eliminatoria"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                className={tab === id ? "tab active" : "tab"}
                onClick={() => setTab(id)}
              >
                {label}
              </button>
            ))}
          </div>

          {tab === "fechas" && (
            <section className="wc-section">
              {data.by_date.length === 0 ? (
                <div className="card empty">Sin fechas en BD. Sincroniza el Mundial.</div>
              ) : (
                data.by_date.map((day) => (
                  <div key={day.date} className="day-block wc-day-block">
                    <h3>{formatDateLabel(day.date)}</h3>
                    <span className="wc-day-count muted">
                      {day.upcoming.length + day.finished.length} partidos
                    </span>
                    {day.upcoming.length > 0 && (
                      <>
                        <h4>Proximos</h4>
                        {day.upcoming.map((m) => (
                          <MatchRow key={m.id} m={m} />
                        ))}
                      </>
                    )}
                    {day.finished.length > 0 && (
                      <>
                        <h4>Finalizados</h4>
                        {day.finished.map((m) => (
                          <MatchRow key={m.id} m={m} />
                        ))}
                      </>
                    )}
                  </div>
                ))
              )}
            </section>
          )}

          {tab === "grupos" && (
            <section className="wc-section">
              {groupPhase?.groups && groupPhase.groups.length > 0 ? (
                <div className="wc-groups-grid">
                  {groupPhase.groups.map((g) => (
                    <div key={g.group} className="card wc-group-card">
                      <h3>{g.label}</h3>
                      <p className="muted small">{g.matches.length} partidos</p>
                      {g.matches.map((m) => (
                        <MatchRow key={m.id} m={m} />
                      ))}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="card empty">
                  Sin grupos cargados. Sincroniza el Mundial desde football-data.
                </div>
              )}
            </section>
          )}

          {tab === "eliminatoria" && (
            <section className="wc-section">
              {data.bracket.map((round) => (
                <div key={round.round} className="card wc-bracket-round">
                  <h2>{round.label}</h2>
                  <div className="wc-bracket-grid">
                    {round.ties.map((tie) => (
                      <article
                        key={tie.code}
                        className={`wc-tie ${tie.resolved ? "resolved" : "slot"}`}
                      >
                        <span className="wc-tie-code">{tie.code}</span>
                        <div className="wc-tie-teams">
                          <span>{tie.home}</span>
                          <span className="vs-badge cal-vs-mini">VS</span>
                          <span>{tie.away}</span>
                        </div>
                        <p className="muted small">{tie.label}</p>
                        {tie.date && <time className="small">{tie.date}</time>}
                        {tie.external_id && (
                          <Link className="wc-link" to={`/partido/${tie.external_id}`}>
                            Ficha →
                          </Link>
                        )}
                      </article>
                    ))}
                  </div>
                </div>
              ))}
              {data.phases
                .filter((p) => p.id !== "GROUP_STAGE")
                .map((phase) =>
                  phase.matches && phase.matches.length > 0 ? (
                    <div key={phase.id} className="card wc-phase-card">
                      <h2>{phase.label} — partidos confirmados</h2>
                      {phase.matches.map((m) => (
                        <MatchRow key={m.id} m={m} />
                      ))}
                    </div>
                  ) : null,
                )}
            </section>
          )}
        </>
      )}
    </div>
  );
}
