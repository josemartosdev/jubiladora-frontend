import type { LiveFeed, TeamStatRow } from "../api/client";

function StatTable({ title, rows }: { title: string; rows: TeamStatRow[] }) {
  if (rows.length === 0) return null;
  return (
    <div className="live-stats-block">
      <h4>{title}</h4>
      <table className="live-stats-table">
        <thead>
          <tr>
            <th>Estadistica</th>
            <th>Valor</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.key}>
              <td>
                <span title={r.help}>{r.label}</span>
              </td>
              <td>
                <strong>{r.value}</strong>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function MatchLiveBar({ live }: { live: LiveFeed }) {
  const score = live.score;

  return (
    <section
      className={`card live-bar ${live.is_live ? "live-on" : ""} ${live.is_finished ? "live-finished" : ""}`}
    >
      <div className="live-bar-top">
        <span className={`live-status-pill ${live.status}`}>
          {live.is_live && <span className="live-dot" />}
          {live.status_label}
        </span>
        {score && (
          <div className="live-score">
            <strong className="live-score-num">
              {score.home} – {score.away}
            </strong>
            {score.result_1x2 && (
              <span className="tag">{score.result_1x2}</span>
            )}
          </div>
        )}
        {!score && !live.is_live && (
          <span className="muted">Sin marcador todavia</span>
        )}
      </div>
      <p className="live-note">{live.live_note}</p>

      {live.stats && (live.stats.home.length > 0 || live.stats.away.length > 0) && (
        <div className="live-stats-grid">
          <StatTable title="Estadisticas — local" rows={live.stats.home} />
          <StatTable title="Estadisticas — visitante" rows={live.stats.away} />
        </div>
      )}

      {live.stats_hint && !live.stats && (
        <p className="muted small">{live.stats_hint}</p>
      )}

      {live.can_refresh_live && live.is_live && (
        <p className="muted small">
          Tip: recarga la pagina para actualizar marcador y stats en directo.
        </p>
      )}
    </section>
  );
}
