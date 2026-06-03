import type { PlayerMatchOutlook, PlayerProjection } from "../api/client";

function levelClass(level?: string): string {
  if (!level) return "metric-level";
  const key = level.toLowerCase().replace(/\s+/g, "-");
  if (key.startsWith("muy")) return "metric-level level-muy";
  if (key === "alta") return "metric-level level-alta";
  if (key === "media") return "metric-level level-media";
  if (key === "baja") return "metric-level level-baja";
  return "metric-level";
}

function PlayerRow({ p }: { p: PlayerProjection }) {
  return (
    <article className={`player-row ${p.is_star ? "star" : ""}`}>
      <div className="player-row-main">
        <span className="player-row-num">{p.number ?? "—"}</span>
        <div className="player-row-info">
          <strong>{p.name}</strong>
          <span className="muted small">{p.position_label}</span>
        </div>
        <span className="player-row-impact" title="Impacto esperado">
          {p.impact_score}
        </span>
      </div>
      <div className="player-row-metrics">
        <span>
          Gol <strong className={levelClass(p.goal_level)}>{p.goal_level}</strong>{" "}
          <em>{p.goal_pct}%</em>
        </span>
        <span>
          Asist. <strong className={levelClass(p.assist_level)}>{p.assist_level}</strong>{" "}
          <em>{p.assist_pct}%</em>
        </span>
        <span>
          Tarjeta <strong className={levelClass(p.card_level)}>{p.card_level}</strong>{" "}
          <em>{p.card_pct}%</em>
        </span>
        <span>
          Min. <strong>{p.expected_minutes}&apos;</strong>
        </span>
      </div>
    </article>
  );
}

function TeamBlock({ block }: { block: PlayerMatchOutlook["home"] }) {
  return (
    <div className="player-team-block">
      <header className="player-team-head">
        <h3>{block.team}</h3>
        <span className="muted small">xG equipo: {block.team_xg}</span>
      </header>
      <div className="player-row-list">
        {block.players.map((p) => (
          <PlayerRow key={`${p.name}-${p.number}`} p={p} />
        ))}
      </div>
    </div>
  );
}

export function MatchPlayerOutlook({ outlook }: { outlook: PlayerMatchOutlook }) {
  const { legend } = outlook;
  return (
    <section className="card player-outlook-section">
      <h2>Proyeccion por jugador</h2>
      <p className="muted small player-method">{outlook.methodology}</p>
      <details className="player-legend-fold">
        <summary>Como leer las metricas</summary>
        <ul className="legend-list small">
          <li>
            <strong>Gol / asistencia:</strong> {legend.goal} {legend.assist}
          </li>
          <li>
            <strong>Tarjeta:</strong> {legend.card}
          </li>
          <li>
            <strong>Impacto:</strong> {legend.impact}
          </li>
        </ul>
      </details>
      <div className="player-outlook-cols">
        <TeamBlock block={outlook.home} />
        <TeamBlock block={outlook.away} />
      </div>
    </section>
  );
}
